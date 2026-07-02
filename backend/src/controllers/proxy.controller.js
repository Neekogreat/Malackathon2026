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

const {
  isCacheableRequest,
  buildCacheKey,
  getCachedResponse,
  saveResponseToCache
} = require("../services/cache.service");

async function chatCompletions(req, res) {
  const consumerId = req.header("X-Consumer-ID");

  console.log("HEADERS RECIBIDOS:", req.headers);
  console.log("CONSUMER ID RECIBIDO:", consumerId);

  if (!consumerId) {
    return res.status(400).json({
      error: "Falta el header X-Consumer-ID"
    });
  }

  const messages = req.body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Body inválido: 'messages' debe ser un array no vacío",
      example: {
        messages: [
          {
            role: "user",
            content: "Resume qué es AI FinOps en una frase"
          }
        ]
      }
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

    /**
     * Caso 1:
     * Presupuesto superado y el consumidor NO permite degradación.
     * Se bloquea antes incluso de hacer routing.
     */
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
          reason: "Presupuesto superado y degradación no permitida",
          selected_provider_id: null,
          selected_model: null,
          scoring: [],
          cheapest_alternative: null,
          most_expensive_alternative: null,
          selected_estimated_cost: 0,
          estimated_saving_if_cheaper: 0,
          extra_cost_for_quality: 0
        }
      });

      return res.status(402).json({
        error: "Budget exceeded",
        consumer: consumerId,
        current_spend: budgetStatus.currentSpend,
        budget_limit: budgetStatus.budgetLimit
      });
    }

    /**
     * Routing:
     * Qwen analiza la petición y routing.service decide Provider A o B.
     */
    const routingDecision = await chooseProvider({
      consumer,
      budgetStatus,
      messages: req.body.messages || []
    });

    /**
     * Caso 2:
     * El routing decide bloquear.
     */
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
          reason: routingDecision.reason,
          selected_provider_id: null,
          selected_model: null,

          scoring: routingDecision.scoring || [],
          cheapest_alternative: routingDecision.cheapest_alternative || null,
          most_expensive_alternative:
            routingDecision.most_expensive_alternative || null,

          selected_estimated_cost:
            routingDecision.selected_estimated_cost || 0,

          estimated_saving_if_cheaper: 0,
          extra_cost_for_quality: 0
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

    /**
     * CACHE CHECKER
     */
    let cacheKey = null;

    if (isCacheableRequest(req.body)) {
      cacheKey = buildCacheKey({
        consumerId,
        providerId: provider._id,
        model: provider.model,
        body: req.body
      });

      const cached = await getCachedResponse(cacheKey);

      if (cached) {
        const estimatedSaving = cached.original_cost?.total_cost || 0;

        await AiRequest.create({
          consumer_id: consumerId,
          provider_id: provider._id,
          provider_name: provider.name,
          model: provider.model,
          status: "cache_hit",

          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },

          cost: {
            input_cost: 0,
            output_cost: 0,
            total_cost: 0
          },

          budget: {
            spend_before: budgetStatus.currentSpend,
            spend_after: budgetStatus.currentSpend,
            budget_limit: budgetStatus.budgetLimit,
            budget_percentage_after: budgetStatus.percentage * 100
          },

          analysis: routingDecision.analysis,

          routing: {
            strategy: "cache_hit",
            reason: "Misma petición exacta encontrada en caché. Coste 0.",
            selected_provider_id: selectedProviderId,
            selected_model: provider.model,

            scoring: routingDecision.scoring || [],
            cheapest_alternative: routingDecision.cheapest_alternative || null,
            most_expensive_alternative:
              routingDecision.most_expensive_alternative || null,

            selected_estimated_cost: 0,

            estimated_saving_if_cheaper:
              estimatedSaving ||
              routingDecision.selected_estimated_cost ||
              routingDecision.cheapest_alternative?.estimated_cost ||
              0,

            extra_cost_for_quality: 0
          },

          cache: {
            hit: true,
            cache_key: cacheKey,
            estimated_saving: estimatedSaving
          },

          latency_ms: 0
        });

        return res.json({
          ...cached.response_data,

          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },

          finops: {
            consumer_id: consumerId,
            provider: provider.name,
            model: provider.model,
            strategy: "cache_hit",
            reason:
              "Respuesta servida desde caché porque la petición completa ya existía.",

            analysis: routingDecision.analysis,

            scoring: routingDecision.scoring || [],

            cheapest_alternative: routingDecision.cheapest_alternative || null,
            most_expensive_alternative:
              routingDecision.most_expensive_alternative || null,

            selected_estimated_cost: 0,

            estimated_saving_if_cheaper:
              estimatedSaving ||
              routingDecision.selected_estimated_cost ||
              routingDecision.cheapest_alternative?.estimated_cost ||
              0,

            extra_cost_for_quality: 0,

            cache: {
              hit: true,
              cache_key: cacheKey,
              estimated_saving: estimatedSaving,

              original_usage: cached.original_usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
              },

              original_cost: cached.original_cost || {
                input_cost: 0,
                output_cost: 0,
                total_cost: 0
              }
            },

            cost: {
              input_cost: 0,
              output_cost: 0,
              total_cost: 0
            },

            budget: {
              spend_before: budgetStatus.currentSpend,
              spend_after: budgetStatus.currentSpend,
              budget_limit: budgetStatus.budgetLimit,
              budget_percentage_after: budgetStatus.percentage * 100
            }
          }
        });
      }
    }

    /**
     * Llamada real al proveedor seleccionado.
     */
    const providerResult = await callProvider(provider, req.body);

    /**
     * Si el proveedor falla, registramos petición con status "error" y coste 0.
     */
    if (!providerResult.success) {
      await AiRequest.create({
        consumer_id: consumerId,
        provider_id: provider._id,
        provider_name: provider.name,
        model: provider.model,
        status: "error",

        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },

        cost: {
          total_cost: 0,
          input_cost: 0,
          output_cost: 0,
          currency: "USD"
        },

        budget: {
          spend_before: budgetStatus.currentSpend,
          spend_after: budgetStatus.currentSpend,
          budget_limit: budgetStatus.budgetLimit,
          budget_percentage_after: budgetStatus.percentage * 100
        },

        analysis: routingDecision.analysis,

        routing: {
          strategy,
          reason: `Error llamando al proveedor: ${providerResult.error}`,
          selected_provider_id: selectedProviderId,
          selected_model: provider.model,

          scoring: routingDecision.scoring || [],
          cheapest_alternative: routingDecision.cheapest_alternative || null,
          most_expensive_alternative:
            routingDecision.most_expensive_alternative || null,

          selected_estimated_cost:
            routingDecision.selected_estimated_cost || 0,

          estimated_saving_if_cheaper: 0,
          extra_cost_for_quality: 0
        },

        latency_ms: providerResult.latencyMs
      });

      return res.status(502).json({
        error: "Provider error",
        provider: provider.name,
        details: providerResult.error
      });
    }

    const usage = providerResult.data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };

    const cost = calculateCost(provider, usage);

    /**
     * Guardamos en caché solo después de tener una respuesta real.
     */
    if (cacheKey) {
      await saveResponseToCache({
        cacheKey,
        consumerId,
        provider,
        body: req.body,
        responseData: providerResult.data,
        usage,
        cost
      });
    }

    const spendAfter = budgetStatus.currentSpend + cost.total_cost;
    const budgetPercentageAfter = spendAfter / budgetStatus.budgetLimit;

    let finalStatus = "success";

    /**
     * Audit log principal.
     */
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
        selected_provider_id: selectedProviderId,
        selected_model: routingDecision.selected_model || provider.model,

        scoring: routingDecision.scoring || [],
        cheapest_alternative: routingDecision.cheapest_alternative || null,
        most_expensive_alternative:
          routingDecision.most_expensive_alternative || null,

        selected_estimated_cost:
          routingDecision.selected_estimated_cost || 0,

        estimated_saving_if_cheaper:
          routingDecision.estimated_saving_if_cheaper || 0,

        extra_cost_for_quality:
          routingDecision.extra_cost_for_quality || 0
      },

      latency_ms: providerResult.latencyMs
    });

    /**
     * Alerta si se supera el umbral configurado.
     */
    if (budgetPercentageAfter >= consumer.alert_threshold) {
      await createBudgetAlertIfNeeded({
        consumerId,
        currentSpend: spendAfter,
        budgetLimit: budgetStatus.budgetLimit,
        status: budgetPercentageAfter >= 1 ? "budget_exceeded" : "warning"
      });
    }

    /**
     * Respuesta final compatible con OpenAI + bloque finops.
     */
    return res.json({
      ...providerResult.data,

      finops: {
        consumer_id: consumerId,
        provider: provider.name,
        model: provider.model,
        strategy,
        reason,

        analysis: routingDecision.analysis,

        scoring: routingDecision.scoring || [],

        cheapest_alternative: routingDecision.cheapest_alternative || null,
        most_expensive_alternative:
          routingDecision.most_expensive_alternative || null,

        selected_estimated_cost:
          routingDecision.selected_estimated_cost || 0,

        estimated_saving_if_cheaper:
          routingDecision.estimated_saving_if_cheaper || 0,

        extra_cost_for_quality:
          routingDecision.extra_cost_for_quality || 0,

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