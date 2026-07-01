const mongoose = require("mongoose");

const AiRequestSchema = new mongoose.Schema(
  {
    consumer_id: String,
    provider_id: String,
    provider_name: String,
    model: String,
    status: String,

    usage: {
      prompt_tokens: Number,
      completion_tokens: Number,
      total_tokens: Number
    },

    cost: {
      input_cost: Number,
      output_cost: Number,
      total_cost: Number
    },

    budget: {
      spend_before: Number,
      spend_after: Number,
      budget_limit: Number,
      budget_percentage_after: Number
    },

    analysis: {
      type: Object,
      default: {}
    },

    routing: {
      type: Object,
      default: {}
    },

    cache: {
  hit: {
    type: Boolean,
    default: false
  },
  cache_key: String,
  estimated_saving: {
    type: Number,
    default: 0
  }
},

    quality_evaluation: {
      type: Object,
      default: {}
    },

    latency_ms: Number,
    error_message: String
  },
  {
    timestamps: true
  }
);

AiRequestSchema.index({ consumer_id: 1, createdAt: -1 });
AiRequestSchema.index({ provider_id: 1, createdAt: -1 });
AiRequestSchema.index({ model: 1, createdAt: -1 });
AiRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AiRequest", AiRequestSchema);

