require("dotenv").config();
const mongoose = require("mongoose");
const AiRequest = require("../models/AiRequest");

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado a:", process.env.MONGO_URI);

    await AiRequest.collection.deleteMany({
      demo_forecast: true
    });

    const baseDate = new Date();
    baseDate.setHours(12, 0, 0, 0);

    const days = [
      { offset: 6, cost: 0.00010, tokens: 400, requests: 2 },
      { offset: 5, cost: 0.00013, tokens: 500, requests: 3 },
      { offset: 4, cost: 0.00018, tokens: 650, requests: 4 },
      { offset: 3, cost: 0.00025, tokens: 800, requests: 5 },
      { offset: 2, cost: 0.00034, tokens: 1000, requests: 6 },
      { offset: 1, cost: 0.00043, tokens: 1250, requests: 7 },
      { offset: 0, cost: 0.00055, tokens: 1500, requests: 8 }
    ];

    const docs = [];

    for (const day of days) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - day.offset);

      for (let i = 0; i < day.requests; i += 1) {
        const requestCost = day.cost / day.requests;
        const requestTokens = Math.round(day.tokens / day.requests);

        docs.push({
          demo_forecast: true,
          consumer_id: "equipo-marketing",
          provider_id: "provider-a",
          provider_name: "Provider A",
          model: "llama3.2:3b",
          status: "success",

          usage: {
            prompt_tokens: Math.round(requestTokens * 0.6),
            completion_tokens: Math.round(requestTokens * 0.4),
            total_tokens: requestTokens
          },

          cost: {
            input_cost: requestCost * 0.6,
            output_cost: requestCost * 0.4,
            total_cost: requestCost
          },

          budget: {
            spend_before: 0,
            spend_after: 0,
            budget_limit: 0.01,
            budget_percentage_after: 0
          },

          analysis: {
            primary_task_type: "summary",
            risk_level: "low",
            complexity: "low",
            quality_required: "low"
          },

          routing: {
            strategy: "cheap_model",
            reason: "Dato histórico simulado para demo de forecast"
          },

          cache: {
            hit: false,
            estimated_saving: 0
          },

          latency_ms: 300,
          createdAt: date,
          updatedAt: date
        });
      }
    }

    const cacheDate = new Date(baseDate);

    docs.push({
      demo_forecast: true,
      consumer_id: "equipo-marketing",
      provider_id: "provider-a",
      provider_name: "Provider A",
      model: "llama3.2:3b",
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
        spend_before: 0,
        spend_after: 0,
        budget_limit: 0.01,
        budget_percentage_after: 0
      },

      analysis: {
        primary_task_type: "summary",
        risk_level: "low",
        complexity: "low",
        quality_required: "low"
      },

      routing: {
        strategy: "cache_hit",
        reason: "Cache hit simulado para demostrar ahorro"
      },

      cache: {
        hit: true,
        cache_key: "demo-cache-key",
        estimated_saving: 0.0002
      },

      latency_ms: 0,
      createdAt: cacheDate,
      updatedAt: cacheDate
    });

    await AiRequest.collection.insertMany(docs);

    console.log(`Insertados ${docs.length} registros históricos de forecast`);

    const check = await AiRequest.collection
      .aggregate([
        {
          $match: {
            demo_forecast: true
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            total_cost: {
              $sum: "$cost.total_cost"
            },
            requests: {
              $sum: 1
            }
          }
        },
        {
          $sort: {
            _id: 1
          }
        }
      ])
      .toArray();

    console.table(check);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error generando datos de forecast:", error);
    process.exit(1);
  }
}

main();