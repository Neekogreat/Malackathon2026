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
        }
      }
    }
  ]);

  return result.length > 0 ? result[0].total_spend : 0;
}

async function getBudgetStatus(consumerId) {
  const consumer = await Consumer.findById(consumerId);

  if (!consumer) {
    throw new Error(`Consumidor no encontrado: ${consumerId}`);
  }

  const currentSpend = await getConsumerSpend(consumerId);
  const percentage = currentSpend / consumer.budget_limit;

  let status = "normal";

  if (percentage >= 1) {
    status = "budget_exceeded";
  } else if (percentage >= consumer.alert_threshold) {
    status = "warning";
  }

  return {
    consumer,
    currentSpend,
    budgetLimit: consumer.budget_limit,
    percentage,
    status
  };
}

async function createBudgetAlertIfNeeded({ consumerId, currentSpend, budgetLimit, status }) {
  if (status === "normal") return null;

  const severity = status === "budget_exceeded" ? "critical" : "warning";

  const message =
    status === "budget_exceeded"
      ? `El consumidor ${consumerId} ha superado su presupuesto`
      : `El consumidor ${consumerId} ha superado el umbral de alerta`;

  return Alert.create({
    consumer_id: consumerId,
    type: status,
    severity,
    message,
    current_spend: currentSpend,
    budget_limit: budgetLimit
  });
}

module.exports = {
  getConsumerSpend,
  getBudgetStatus,
  createBudgetAlertIfNeeded
};