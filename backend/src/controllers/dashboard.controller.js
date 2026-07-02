const AiRequest = require("../models/AiRequest");
const Alert = require("../models/Alert");
const Consumer = require("../models/Consumer");

const {
  getCostRecommendations
} = require("../services/recommendation.service");


const FORECAST_STATUSES = ["success", "cache_hit"];

function roundNumber(value, decimals = 8) {
  return Number((Number(value || 0)).toFixed(decimals));
}

function average(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));

  if (cleanValues.length === 0) {
    return 0;
  }

  return cleanValues.reduce((acc, value) => acc + value, 0) / cleanValues.length;
}

function calculateWeightedDailyAverage(series) {
  if (!series.length) {
    return 0;
  }

  let weightedSum = 0;
  let weightTotal = 0;

  series.forEach((item, index) => {
    const weight = index + 1; // los días recientes pesan más
    weightedSum += (item.cost || 0) * weight;
    weightTotal += weight;
  });

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function calculateTrend(series) {
  if (series.length < 4) {
    return {
      factor: 1,
      direction: "stable",
      first_half_average: 0,
      second_half_average: 0,
      reason: "No hay suficientes días para calcular tendencia; se usa factor neutro"
    };
  }

  const middle = Math.floor(series.length / 2);

  const firstHalf = series.slice(0, middle);
  const secondHalf = series.slice(middle);

  const firstHalfAverage = average(firstHalf.map((item) => item.cost || 0));
  const secondHalfAverage = average(secondHalf.map((item) => item.cost || 0));

  let rawFactor = 1;

  if (firstHalfAverage > 0) {
    rawFactor = secondHalfAverage / firstHalfAverage;
  } else if (secondHalfAverage > 0) {
    rawFactor = 1.25;
  }

  // Evitamos predicciones exageradas con pocos datos
  const factor = Math.min(Math.max(rawFactor, 0.7), 1.5);

  let direction = "stable";

  if (factor > 1.05) {
    direction = "increasing";
  } else if (factor < 0.95) {
    direction = "decreasing";
  }

  return {
    factor,
    direction,
    first_half_average: firstHalfAverage,
    second_half_average: secondHalfAverage,
    reason:
      direction === "increasing"
        ? "El gasto reciente es mayor que el gasto inicial del periodo"
        : direction === "decreasing"
          ? "El gasto reciente es menor que el gasto inicial del periodo"
          : "El gasto se mantiene estable"
  };
}

function getForecastConfidence({ activeDays, totalRequests }) {
  if (totalRequests === 0) {
    return "no_data";
  }

  if (activeDays < 3 || totalRequests < 5) {
    return "low";
  }

  if (activeDays < 7 || totalRequests < 20) {
    return "medium";
  }

  return "high";
}

function getDaysUntilBudgetExceeded({
  currentSpend,
  budgetLimit,
  projectedDailySpend
}) {
  if (!budgetLimit || budgetLimit <= 0) {
    return null;
  }

  if (currentSpend >= budgetLimit) {
    return 0;
  }

  if (!projectedDailySpend || projectedDailySpend <= 0) {
    return null;
  }

  const remainingBudget = budgetLimit - currentSpend;

  return Math.ceil(remainingBudget / projectedDailySpend);
}

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

async function getForecast(req, res) {
  try {
    const lookbackDays = Math.max(Number(req.query.lookbackDays) || 14, 1);
    const horizonDays = Math.max(Number(req.query.horizonDays) || 30, 1);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - lookbackDays);
    fromDate.setHours(0, 0, 0, 0);

    const dailyRows = await AiRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate },
          status: { $in: FORECAST_STATUSES }
        }
      },
      {
        $group: {
          _id: {
            consumer_id: "$consumer_id",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            }
          },
          cost: {
            $sum: "$cost.total_cost"
          },
          requests: {
            $sum: 1
          },
          tokens: {
            $sum: "$usage.total_tokens"
          },
          cache_hits: {
            $sum: {
              $cond: [{ $eq: ["$status", "cache_hit"] }, 1, 0]
            }
          },
          cache_savings: {
            $sum: {
              $ifNull: ["$cache.estimated_saving", 0]
            }
          }
        }
      },
      {
        $sort: {
          "_id.consumer_id": 1,
          "_id.date": 1
        }
      },
      {
        $project: {
          _id: 0,
          consumer_id: "$_id.consumer_id",
          date: "$_id.date",
          cost: 1,
          requests: 1,
          tokens: 1,
          cache_hits: 1,
          cache_savings: 1
        }
      }
    ]);

    const currentSpendRows = await AiRequest.aggregate([
      {
        $match: {
          status: { $in: FORECAST_STATUSES }
        }
      },
      {
        $group: {
          _id: "$consumer_id",
          current_spend: {
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

    const consumers = await Consumer.find({
      enabled: true
    }).sort({ _id: 1 });

    const currentSpendMap = new Map(
      currentSpendRows.map((item) => [item._id, item])
    );

    const rowsByConsumer = new Map();

    dailyRows.forEach((row) => {
      if (!rowsByConsumer.has(row.consumer_id)) {
        rowsByConsumer.set(row.consumer_id, []);
      }

      rowsByConsumer.get(row.consumer_id).push(row);
    });

    const dailyTotalsMap = new Map();

    dailyRows.forEach((row) => {
      if (!dailyTotalsMap.has(row.date)) {
        dailyTotalsMap.set(row.date, {
          date: row.date,
          cost: 0,
          requests: 0,
          tokens: 0,
          cache_hits: 0,
          cache_savings: 0
        });
      }

      const day = dailyTotalsMap.get(row.date);

      day.cost += row.cost || 0;
      day.requests += row.requests || 0;
      day.tokens += row.tokens || 0;
      day.cache_hits += row.cache_hits || 0;
      day.cache_savings += row.cache_savings || 0;
    });

    const overallSeries = [...dailyTotalsMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const overallWeightedDailyAverage =
      calculateWeightedDailyAverage(overallSeries);

    const overallTrend = calculateTrend(overallSeries);

    const overallProjectedDailySpend =
      overallWeightedDailyAverage * overallTrend.factor;

    const totalSpendInPeriod = overallSeries.reduce(
      (acc, item) => acc + (item.cost || 0),
      0
    );

    const totalCacheSavingsInPeriod = overallSeries.reduce(
      (acc, item) => acc + (item.cache_savings || 0),
      0
    );

    let cumulativeRealCost = 0;

    const history = overallSeries.map((item) => {
      cumulativeRealCost += item.cost || 0;

      return {
        date: item.date,
        real_cost: roundNumber(item.cost),
        cumulative_real_cost: roundNumber(cumulativeRealCost),
        forecast_cost: null,
        requests: item.requests,
        tokens: item.tokens,
        cache_hits: item.cache_hits,
        cache_savings: roundNumber(item.cache_savings)
      };
    });

    const future = [];
let cumulativeForecastCost = cumulativeRealCost;

const lastHistoryDate =
  history.length > 0
    ? new Date(`${history[history.length - 1].date}T12:00:00`)
    : new Date();

for (let i = 1; i <= horizonDays; i += 1) {
  const futureDate = new Date(lastHistoryDate);
  futureDate.setDate(lastHistoryDate.getDate() + i);

      cumulativeForecastCost += overallProjectedDailySpend;

      future.push({
        date: futureDate.toISOString().slice(0, 10),
        real_cost: null,
        cumulative_real_cost: null,
        forecast_cost: roundNumber(cumulativeForecastCost),
        requests: null,
        tokens: null,
        cache_hits: null,
        cache_savings: null
      });
    }

    const consumerForecast = consumers.map((consumer) => {
      const series = rowsByConsumer.get(consumer._id) || [];

      const currentSpendData = currentSpendMap.get(consumer._id) || {
        current_spend: 0,
        total_requests: 0,
        total_tokens: 0
      };

      const activeDays = series.length;

      const totalRequestsInPeriod = series.reduce(
        (acc, item) => acc + (item.requests || 0),
        0
      );

      const totalTokensInPeriod = series.reduce(
        (acc, item) => acc + (item.tokens || 0),
        0
      );

      const periodSpend = series.reduce(
        (acc, item) => acc + (item.cost || 0),
        0
      );

      const periodCacheSavings = series.reduce(
        (acc, item) => acc + (item.cache_savings || 0),
        0
      );

      const weightedDailyAverage = calculateWeightedDailyAverage(series);
      const trend = calculateTrend(series);

      const projectedDailySpend = weightedDailyAverage * trend.factor;
      const forecastSpend = projectedDailySpend * horizonDays;
      const projectedBudgetSpend =
        (currentSpendData.current_spend || 0) + forecastSpend;

      const forecastBudgetPercentage =
        consumer.budget_limit > 0
          ? (projectedBudgetSpend / consumer.budget_limit) * 100
          : 0;

      const projectedCacheSavings =
        activeDays > 0
          ? (periodCacheSavings / activeDays) * horizonDays
          : 0;

      const daysUntilBudgetExceeded = getDaysUntilBudgetExceeded({
        currentSpend: currentSpendData.current_spend || 0,
        budgetLimit: consumer.budget_limit,
        projectedDailySpend
      });

      const confidence = getForecastConfidence({
        activeDays,
        totalRequests: totalRequestsInPeriod
      });

      return {
        consumer_id: consumer._id,
        name: consumer.name,
        budget_limit: roundNumber(consumer.budget_limit),
        current_budget_spend: roundNumber(currentSpendData.current_spend),
        period_spend: roundNumber(periodSpend),
        active_days: activeDays,
        requests_in_period: totalRequestsInPeriod,
        tokens_in_period: totalTokensInPeriod,

        weighted_daily_average: roundNumber(weightedDailyAverage),
        trend_factor: roundNumber(trend.factor, 4),
        trend_direction: trend.direction,
        trend_reason: trend.reason,
        first_half_average: roundNumber(trend.first_half_average),
        second_half_average: roundNumber(trend.second_half_average),

        projected_daily_spend: roundNumber(projectedDailySpend),
        forecast_additional_spend: roundNumber(forecastSpend),
        projected_budget_spend: roundNumber(projectedBudgetSpend),
        forecast_budget_percentage: roundNumber(forecastBudgetPercentage, 2),
        will_exceed_budget: projectedBudgetSpend >= consumer.budget_limit,
        days_until_budget_exceeded: daysUntilBudgetExceeded,

        cache_savings_in_period: roundNumber(periodCacheSavings),
        projected_cache_savings: roundNumber(projectedCacheSavings),

        confidence
      };
    });

    const forecastTotalSpend =
      overallProjectedDailySpend * horizonDays;

    const projectedCacheSavingsTotal =
      overallSeries.length > 0
        ? (totalCacheSavingsInPeriod / overallSeries.length) * horizonDays
        : 0;

    return res.json({
      method: "weighted_trend_forecast_v1",
      explanation: {
        formula:
          "forecast_spend = weighted_daily_average × trend_factor × horizon_days",
        weighted_daily_average:
          "Los días recientes pesan más que los días antiguos",
        trend_factor:
          "Compara la primera mitad del periodo con la segunda mitad y limita el resultado entre 0.7 y 1.5",
        cache:
          "Los cache_hit cuentan como coste real 0 y su estimated_saving se usa para estimar ahorro"
      },

      lookback_days: lookbackDays,
      horizon_days: horizonDays,

      total_spend_in_period: roundNumber(totalSpendInPeriod),
      weighted_daily_average: roundNumber(overallWeightedDailyAverage),
      trend_factor: roundNumber(overallTrend.factor, 4),
      trend_direction: overallTrend.direction,
      projected_daily_spend: roundNumber(overallProjectedDailySpend),
      forecast_additional_spend: roundNumber(forecastTotalSpend),

      cache_savings_in_period: roundNumber(totalCacheSavingsInPeriod),
      projected_cache_savings: roundNumber(projectedCacheSavingsTotal),

      chart_data: [...history, ...future],
      consumer_forecast: consumerForecast
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error calculando forecast",
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

async function getRecommendations(req, res) {
  try {
    const lookbackDays = Number(req.query.lookbackDays) || 14;

    const result = await getCostRecommendations({
      lookbackDays
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Error generando recomendaciones",
      details: error.message
    });
  }
}

module.exports = {
  getOverview,
  getForecast,
  getRecommendations,
  getRequests,
  getConsumers,
  getAlerts,
  patchConsumerBudget,
  markAlertAsRead
};