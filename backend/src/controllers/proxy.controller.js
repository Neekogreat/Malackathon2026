const Consumer = require("../models/Consumer");
const Provider = require("../models/Provider");
const AiRequest = require("../models/AiRequest");
const { chooseProvider } = require("../services/routing.service");

const { callProvider } = require("../services/provider.service");
const { calculateCost } = require("../services/cost.service");
const {
  getBudgetStatus,
  createBudgetAlertIfNeeded
} = require("../services/budget.service");

async function chatCompletions(req, res) {
  const consumerId = req.header("X-Consumer-ID");

console.log("HEADERS RECIBIDOS:", req.headers);
console.log("CONSUMER ID RECIBIDO:", consumerId);

  if (!consumerId) {
    return res.status(400).json({
      error: "Falta el header X-Consumer-ID"
    });
  }

  try {
    const consumer = await Consumer.findById(consumerId);

    console.log("CONSUMER ENCONTRADO:", consumer);

    if (!consumer || !consumer.enabled) {
      return res.status(403).json({
        error: "Consumidor no válido o deshabilitado"
      });
    }

    const budgetStatus = await getBudgetStatus(consumerId);

    if (
      budgetStatus.status === "budget_exceeded" &&
      !consumer.allow_degradation
    ) {
      await createBudgetAlertIfNeeded({
        consumerId,
        currentSpend: budgetStatus.currentSpend,
        budgetLimit: budgetStatus.budgetLimit,
        status: budgetStatus.status
      });

      await AiRequest.create({
        consumer_id: consumerId,
        status: "blocked",
        budget: {
          spend_before: budgetStatus.currentSpend,
          spend_after: budgetStatus.currentSpend,
          budget_limit: budgetStatus.budgetLimit,
          budget_percentage_after: budgetStatus.percentage * 100
        },
        routing: {
          strategy: "budget_blocked",
          reason: "Presupuesto superado y degradación no permitida"
        }
      });

      return res.status(402).json({
        error: "Budget exceeded",
        consumer: consumerId,
        current_spend: budgetStatus.currentSpend,
        budget_limit: budgetStatus.budgetLimit
      });
    }

    const routingDecision = chooseProvider({
  consumer,
  budgetStatus,
  messages: req.body.messages || []
});

if (routingDecision.action === "block") {
  await createBudgetAlertIfNeeded({
    consumerId,
    currentSpend: budgetStatus.currentSpend,
    budgetLimit: budgetStatus.budgetLimit,
    status: budgetStatus.status
  });

  await AiRequest.create({
    consumer_id: consumerId,
    status: "blocked",
    budget: {
      spend_before: budgetStatus.currentSpend,
      spend_after: budgetStatus.currentSpend,
      budget_limit: budgetStatus.budgetLimit,
      budget_percentage_after: budgetStatus.percentage * 100
    },
    analysis: routingDecision.analysis,
    routing: {
      strategy: routingDecision.strategy,
      reason: routingDecision.reason
    }
  });

  return res.status(402).json({
    error: "Budget exceeded",
    consumer: consumerId,
    reason: routingDecision.reason
  });
}

let selectedProviderId = routingDecision.selected_provider_id;
let strategy = routingDecision.strategy;
let reason = routingDecision.reason;

    const provider = await Provider.findById(selectedProviderId);

    if (!provider) {
      return res.status(500).json({
        error: "Proveedor no encontrado"
      });
    }

    const providerResult = await callProvider(provider, req.body);

    const usage = providerResult.data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };

    const cost = calculateCost(provider, usage);

    const spendAfter = budgetStatus.currentSpend + cost.total_cost;
    const budgetPercentageAfter = spendAfter / budgetStatus.budgetLimit;

    let finalStatus = "success";

    await AiRequest.create({
      consumer_id: consumerId,
      provider_id: provider._id,
      provider_name: provider.name,
      model: provider.model,
      status: finalStatus,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens:
          usage.total_tokens ||
          (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      },
      cost,
      budget: {
        spend_before: budgetStatus.currentSpend,
        spend_after: spendAfter,
        budget_limit: budgetStatus.budgetLimit,
        budget_percentage_after: budgetPercentageAfter * 100
      },
      analysis: routingDecision.analysis,
routing: {
  strategy,
  reason,
  selected_provider_id: selectedProviderId
},
      latency_ms: providerResult.latencyMs
    });

    if (budgetPercentageAfter >= consumer.alert_threshold) {
      await createBudgetAlertIfNeeded({
        consumerId,
        currentSpend: spendAfter,
        budgetLimit: budgetStatus.budgetLimit,
        status: budgetPercentageAfter >= 1 ? "budget_exceeded" : "warning"
      });
    }

    return res.json({
      ...providerResult.data,
      finops: {
  consumer_id: consumerId,
  provider: provider.name,
  model: provider.model,
  strategy,
  reason,
  analysis: routingDecision.analysis,
  cost,
  budget: {
    spend_before: budgetStatus.currentSpend,
    spend_after: spendAfter,
    budget_limit: budgetStatus.budgetLimit,
    budget_percentage_after: budgetPercentageAfter * 100
  }
}
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error procesando la petición",
      details: error.message
    });
  }
}

module.exports = {
  chatCompletions
};