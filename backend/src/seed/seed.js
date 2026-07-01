require("dotenv").config();

const mongoose = require("mongoose");
const Consumer = require("../models/Consumer");
const Provider = require("../models/Provider");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await Consumer.deleteMany({});
    await Provider.deleteMany({});

    await Consumer.insertMany([
      {
        _id: "equipo-marketing",
        name: "Equipo Marketing",
        budget_limit: 0.01,
        alert_threshold: 0.8,
        allow_degradation: true,
        enabled: true
      },
      {
        _id: "equipo-producto",
        name: "Equipo Producto",
        budget_limit: 0.03,
        alert_threshold: 0.8,
        allow_degradation: false,
        enabled: true
      }
    ]);

    await Provider.insertMany([
      {
        _id: "provider-a",
        name: "Provider A",
        model: "llama3.2:3b",
        base_url: process.env.PROVIDER_A_URL,
        input_price_per_1m: 0.06,
        output_price_per_1m: 0.06,
        enabled: true,
        capabilities: {
          summary: 8,
          simple_qa: 7,
          classification: 8,
          rewriting: 7,
          creative_writing: 6,
          code_debugging: 4,
          technical_reasoning: 5,
          business_analysis: 6
        }
      },
      {
        _id: "provider-b",
        name: "Provider B",
        model: "mistral:7b",
        base_url: process.env.PROVIDER_B_URL,
        input_price_per_1m: 0.24,
        output_price_per_1m: 0.24,
        enabled: true,
        capabilities: {
          summary: 8,
          simple_qa: 8,
          classification: 8,
          rewriting: 8,
          creative_writing: 8,
          code_debugging: 8,
          technical_reasoning: 8,
          business_analysis: 8
        }
      }
    ]);

    console.log("Seed ejecutado correctamente");
    process.exit(0);
  } catch (error) {
    console.error("Error en seed:", error);
    process.exit(1);
  }
}

seed();