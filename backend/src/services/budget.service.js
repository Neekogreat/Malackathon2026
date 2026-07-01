const Consumer = require("../models/Consumer");
const AiRequest = require("../models/AiRequest");
const Alert = require("../models/Alert");

async function getConsumerSpend(consumerId) {
  const result = await AiRequest.aggregate([
    {
      $match: {
        consumer_id: consumerId,
        status: "success"
      }
    },
    {
      $group: {
        _id: "$consumer_id",
        total_spend: {
          $sum: "$cost.total_cost"
        },
        total_requests: {
          $sum: 1
        },
        total_tokens: {
          $sum: "$usage.total_tokens"
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      total_spend: 0,
      total_requests: 0,
      total_tokens: 0
    };
  }

  return {
    total_spend: result[0].total_spend || 0,
    total_requests: result[0].total_requests || 0,
    total_tokens: result[0].total_tokens || 0
  };
}

async function getBudgetStatus(consumerId) {
  const consumer = await Consumer.findById(consumerId);

  if (!consumer) {
    throw new Error(`Consumidor no encontrado: ${consumerId}`);
  }

  const spendData = await getConsumerSpend(consumerId);
  const currentSpend = spendData.total_spend;

  const percentage =
    consumer.budget_limit > 0 ? currentSpend / consumer.budget_limit : 0;

  let status = "normal";

  if (percentage >= 1) {
    status = "budget_exceeded";
  } else if (percentage >= consumer.alert_threshold) {
    status = "warning";
  }

  return {
    consumer,
    currentSpend,
    totalRequests: spendData.total_requests,
    totalTokens: spendData.total_tokens,
    budgetLimit: consumer.budget_limit,
    percentage,
    status
  };
}

async function getConsumersWithBudgetStatus() {
  const consumers = await Consumer.find().sort({ _id: 1 });

  const enrichedConsumers = await Promise.all(
    consumers.map(async (consumer) => {
      const spendData = await getConsumerSpend(consumer._id);

      const percentage =
        consumer.budget_limit > 0
          ? spendData.total_spend / consumer.budget_limit
          : 0;

      let status = "normal";

      if (percentage >= 1) {
        status = "budget_exceeded";
      } else if (percentage >= consumer.alert_threshold) {
        status = "warning";
      }

      return {
        _id: consumer._id,
        name: consumer.name,
        budget_limit: consumer.budget_limit,
        alert_threshold: consumer.alert_threshold,
        allow_degradation: consumer.allow_degradation,
        enabled: consumer.enabled,
        current_spend: spendData.total_spend,
        total_requests: spendData.total_requests,
        total_tokens: spendData.total_tokens,
        budget_percentage: percentage * 100,
        status
      };
    })
  );

  return enrichedConsumers;
}

async function createBudgetAlertIfNeeded({
  consumerId,
  currentSpend,
  budgetLimit,
  status
}) {
  if (status === "normal") return null;

  const severity = status === "budget_exceeded" ? "critical" : "warning";

  const message =
    status === "budget_exceeded"
      ? `El consumidor ${consumerId} ha superado su presupuesto`
      : `El consumidor ${consumerId} ha superado el umbral de alerta`;

  const existingAlert = await Alert.findOne({
    consumer_id: consumerId,
    type: status,
    read: false
  }).sort({ createdAt: -1 });

  if (existingAlert) {
    existingAlert.current_spend = currentSpend;
    existingAlert.budget_limit = budgetLimit;
    existingAlert.message = message;
    await existingAlert.save();
    return existingAlert;
  }

  return Alert.create({
    consumer_id: consumerId,
    type: status,
    severity,
    message,
    current_spend: currentSpend,
    budget_limit: budgetLimit,
    read: false
  });
}

async function updateConsumerBudget(consumerId, budgetLimit) {
  const consumer = await Consumer.findByIdAndUpdate(
    consumerId,
    {
      budget_limit: budgetLimit
    },
    {
      new: true
    }
  );

  if (!consumer) {
    throw new Error(`Consumidor no encontrado: ${consumerId}`);
  }

  return consumer;
}

module.exports = {
  getConsumerSpend,
  getBudgetStatus,
  getConsumersWithBudgetStatus,
  createBudgetAlertIfNeeded,
  updateConsumerBudget
};