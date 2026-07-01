const mongoose = require("mongoose");

const ConsumerSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    budget_limit: {
      type: Number,
      required: true
    },
    alert_threshold: {
      type: Number,
      default: 0.8
    },
    allow_degradation: {
      type: Boolean,
      default: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Consumer", ConsumerSchema);