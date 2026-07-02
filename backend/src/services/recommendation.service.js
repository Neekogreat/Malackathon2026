const AiRequest = require("../models/AiRequest");
const Consumer = require("../models/Consumer");

const VALID_COST_STATUSES = ["success", "cache_hit"];

const LOW_RISK_TASKS = [
  "summary",
  "translation",
  "classification",
  "simple_qa",
  "rewriting"
];

function roundNumber(value, decimals = 8) {
  return Number(Number(value || 0).toFixed(decimals));
}

function buildRecommendation({
  id,
  title,
  description,
  saving = 0,
  severity = "info",
  evidence = {},
  action = ""
}) {
  return {
    id,
    title,
    description,
    saving: roundNumber(saving),
    severity,
    evidence,
    action
  };
}

async function getCostRecommendations({ lookbackDays = 14 } = {}) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - lookbackDays);
  fromDate.setHours(0, 0, 0, 0);

  const recommendations = [];

  const totalsResult = await AiRequest.aggregate([
    {
      $match: {
        createdAt: { $gte: fromDate },
        status: { $in: VALID_COST_STATUSES }
      }
    },
    {
      $group: {
        _id: null,
        total_cost: {
          $sum: "$cost.total_cost"
        },
        total_tokens: {
          $sum: "$usage.total_tokens"
        },
        total_requests: {
          $sum: 1
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
        },
        avg_tokens_per_request: {
          $avg: "$usage.total_tokens"
        }
      }
    }
  ]);

  const totals = totalsResult[0] || {
    total_cost: 0,
    total_tokens: 0,
    total_requests: 0,
    cache_hits: 0,
    cache_savings: 0,
    avg_tokens_per_request: 0
  };

  const cacheHitRate =
    totals.total_requests > 0
      ? totals.cache_hits / totals.total_requests
      : 0;

  if (totals.cache_savings > 0) {
    const projectedCacheSaving =
      totals.cache_savings * (30 / lookbackDays);

    recommendations.push(
      buildRecommendation({
        id: "cache_savings",
        title: "Cache is already reducing provider cost",
        description:
          `Cache hits avoided repeated provider calls. Current cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%.`,
        saving: projectedCacheSaving,
        severity: "success",
        evidence: {
          cache_hits: totals.cache_hits,
          cache_hit_rate: roundNumber(cacheHitRate, 4),
          saving_in_period: roundNumber(totals.cache_savings),
          projected_30_day_saving: roundNumber(projectedCacheSaving)
        },
        action:
          "Keep caching exact repeated prompts and increase TTL for stable prompts."
      })
    );
  }

  if (totals.avg_tokens_per_request >= 700) {
    const estimatedSaving = totals.total_cost * 0.15;

    recommendations.push(
      buildRecommendation({
        id: "token_reduction",
        title: "Reduce prompt and completion tokens",
        description:
          `Average tokens per request are high: ${Math.round(totals.avg_tokens_per_request)} tokens/request. A 15% reduction would lower spend.`,
        saving: estimatedSaving,
        severity: "warning",
        evidence: {
          avg_tokens_per_request: Math.round(totals.avg_tokens_per_request),
          total_tokens: totals.total_tokens,
          total_cost: roundNumber(totals.total_cost)
        },
        action:
          "Add max_tokens limits, ask users for shorter prompts, and summarize long context before sending it to the model."
      })
    );
  }

  const consumers = await Consumer.find({
    enabled: true
  });

  const spendByConsumer = await AiRequest.aggregate([
    {
      $match: {
        status: { $in: VALID_COST_STATUSES }
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
        }
      }
    }
  ]);

  const spendMap = new Map(
    spendByConsumer.map((item) => [item._id, item])
  );

  consumers.forEach((consumer) => {
    const spendData = spendMap.get(consumer._id) || {
      total_spend: 0,
      total_requests: 0
    };

    const budgetPercentage =
      consumer.budget_limit > 0
        ? spendData.total_spend / consumer.budget_limit
        : 0;

    if (budgetPercentage >= 0.8) {
      const severity = budgetPercentage >= 1 ? "critical" : "warning";

      recommendations.push(
        buildRecommendation({
          id: `budget_risk_${consumer._id}`,
          title: `Budget risk detected for ${consumer._id}`,
          description:
            `This consumer has used ${(budgetPercentage * 100).toFixed(2)}% of its budget. Apply stricter routing before blocking.`,
          saving: spendData.total_spend * 0.2,
          severity,
          evidence: {
            consumer_id: consumer._id,
            current_spend: roundNumber(spendData.total_spend),
            budget_limit: roundNumber(consumer.budget_limit),
            budget_percentage: roundNumber(budgetPercentage * 100, 2),
            total_requests: spendData.total_requests
          },
          action:
            "Route low-risk prompts to the cheapest model, enforce cache, and reduce max_tokens for this consumer."
        })
      );
    }
  });

  const providerSpend = await AiRequest.aggregate([
    {
      $match: {
        createdAt: { $gte: fromDate },
        status: "success"
      }
    },
    {
      $group: {
        _id: "$provider_name",
        total_cost: {
          $sum: "$cost.total_cost"
        },
        total_requests: {
          $sum: 1
        }
      }
    },
    {
      $sort: {
        total_cost: -1
      }
    }
  ]);

  const expensiveProvider = providerSpend[0];

  if (expensiveProvider && expensiveProvider.total_cost > 0) {
    const estimatedSaving = expensiveProvider.total_cost * 0.25;

    recommendations.push(
      buildRecommendation({
        id: "provider_mix_optimization",
        title: "Optimize provider/model mix",
        description:
          `${expensiveProvider._id} is the highest-cost provider in the selected period. Some low-risk traffic could be moved to the cheaper provider.`,
        saving: estimatedSaving,
        severity: "info",
        evidence: {
          provider_name: expensiveProvider._id,
          provider_cost: roundNumber(expensiveProvider.total_cost),
          provider_requests: expensiveProvider.total_requests
        },
        action:
          "Keep high-quality models for complex/code tasks, but route summaries, translations and simple Q&A to the cheap model."
      })
    );
  }

  const lowRiskExpensiveRequests = await AiRequest.aggregate([
    {
      $match: {
        createdAt: { $gte: fromDate },
        status: "success",
        "analysis.primary_task_type": { $in: LOW_RISK_TASKS },
        "routing.strategy": {
          $nin: ["cheap_model", "cache_hit"]
        }
      }
    },
    {
      $group: {
        _id: "$analysis.primary_task_type",
        total_cost: {
          $sum: "$cost.total_cost"
        },
        total_requests: {
          $sum: 1
        }
      }
    }
  ]);

  const lowRiskExpensiveCost = lowRiskExpensiveRequests.reduce(
    (acc, item) => acc + (item.total_cost || 0),
    0
  );

  if (lowRiskExpensiveCost > 0) {
    recommendations.push(
      buildRecommendation({
        id: "low_risk_to_cheap_model",
        title: "Route low-risk tasks to the cheap model",
        description:
          "Some simple tasks were not routed through the cheapest strategy. Moving them can reduce cost with minimal quality impact.",
        saving: lowRiskExpensiveCost * 0.5,
        severity: "warning",
        evidence: {
          affected_tasks: lowRiskExpensiveRequests,
          affected_cost: roundNumber(lowRiskExpensiveCost)
        },
        action:
          "Force summary, translation, classification and simple Q&A to Provider A unless quality_required is high."
      })
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      buildRecommendation({
        id: "system_healthy",
        title: "No major cost risks detected",
        description:
          "Current usage does not show strong optimization issues. Keep monitoring traffic and budget trends.",
        saving: 0,
        severity: "success",
        evidence: {
          total_requests: totals.total_requests,
          total_cost: roundNumber(totals.total_cost)
        },
        action:
          "Continue monitoring cache hit rate, routing decisions and budget usage."
      })
    );
  }

  const totalEstimatedSaving = recommendations.reduce(
    (acc, item) => acc + (item.saving || 0),
    0
  );

  return {
    generated_at: new Date().toISOString(),
    lookback_days: lookbackDays,
    total_estimated_saving: roundNumber(totalEstimatedSaving),
    summary: {
      total_cost: roundNumber(totals.total_cost),
      total_tokens: totals.total_tokens,
      total_requests: totals.total_requests,
      cache_hits: totals.cache_hits,
      cache_hit_rate: roundNumber(cacheHitRate, 4),
      cache_savings: roundNumber(totals.cache_savings)
    },
    recommendations
  };
}


module.exports = {
  getCostRecommendations
};