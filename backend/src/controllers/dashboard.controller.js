const AiRequest = require("../models/AiRequest");
const Alert = require("../models/Alert");
const Consumer = require("../models/Consumer");

const {
  getConsumersWithBudgetStatus,
  updateConsumerBudget
} = require("../services/budget.service");

async function getOverview(req, res) {
  try {
    const totals = await AiRequest.aggregate([
      {
        $match: {
          status: "success"
        }
      },
      {
        $group: {
          _id: null,
          total_spend: {
            $sum: "$cost.total_cost"
          },
          total_requests: {
            $sum: 1
          },
          total_tokens: {
            $sum: "$usage.total_tokens"
          },
          avg_cost_per_request: {
            $avg: "$cost.total_cost"
          }
        }
      }
    ]);

    const spendByConsumer = await AiRequest.aggregate([
      {
        $match: {
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
      },
      {
        $sort: {
          total_spend: -1
        }
      }
    ]);

    const spendByProvider = await AiRequest.aggregate([
      {
        $match: {
          status: "success"
        }
      },
      {
        $group: {
          _id: "$provider_name",
          total_spend: {
            $sum: "$cost.total_cost"
          },
          total_requests: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          total_spend: -1
        }
      }
    ]);

    const spendByModel = await AiRequest.aggregate([
      {
        $match: {
          status: "success"
        }
      },
      {
        $group: {
          _id: "$model",
          total_spend: {
            $sum: "$cost.total_cost"
          },
          total_requests: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          total_spend: -1
        }
      }
    ]);

    const activeAlerts = await Alert.countDocuments({
      read: false
    });

    const blockedRequests = await AiRequest.countDocuments({
      status: "blocked"
    });

    const totalData = totals[0] || {
      total_spend: 0,
      total_requests: 0,
      total_tokens: 0,
      avg_cost_per_request: 0
    };

    return res.json({
      total_spend: totalData.total_spend || 0,
      total_requests: totalData.total_requests || 0,
      total_tokens: totalData.total_tokens || 0,
      avg_cost_per_request: totalData.avg_cost_per_request || 0,
      active_alerts: activeAlerts,
      blocked_requests: blockedRequests,
      spend_by_consumer: spendByConsumer,
      spend_by_provider: spendByProvider,
      spend_by_model: spendByModel
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo overview",
      details: error.message
    });
  }
}

async function getRequests(req, res) {
  try {
    const limit = Number(req.query.limit) || 50;

    const requests = await AiRequest.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(requests);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo requests",
      details: error.message
    });
  }
}

async function getConsumers(req, res) {
  try {
    const consumers = await getConsumersWithBudgetStatus();
    return res.json(consumers);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo consumidores",
      details: error.message
    });
  }
}

async function getAlerts(req, res) {
  try {
    const limit = Number(req.query.limit) || 50;

    const alerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(alerts);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo alertas",
      details: error.message
    });
  }
}

async function patchConsumerBudget(req, res) {
  try {
    const consumerId = req.params.id;
    const { budget_limit } = req.body;

    if (budget_limit === undefined || Number(budget_limit) <= 0) {
      return res.status(400).json({
        error: "budget_limit debe ser un número mayor que 0"
      });
    }

    const updatedConsumer = await updateConsumerBudget(
      consumerId,
      Number(budget_limit)
    );

    return res.json({
      message: "Presupuesto actualizado correctamente",
      consumer: updatedConsumer
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error actualizando presupuesto",
      details: error.message
    });
  }
}

async function markAlertAsRead(req, res) {
  try {
    const alertId = req.params.id;

    const alert = await Alert.findByIdAndUpdate(
      alertId,
      {
        read: true
      },
      {
        new: true
      }
    );

    if (!alert) {
      return res.status(404).json({
        error: "Alerta no encontrada"
      });
    }

    return res.json({
      message: "Alerta marcada como leída",
      alert
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error actualizando alerta",
      details: error.message
    });
  }
}

module.exports = {
  getOverview,
  getRequests,
  getConsumers,
  getAlerts,
  patchConsumerBudget,
  markAlertAsRead
};