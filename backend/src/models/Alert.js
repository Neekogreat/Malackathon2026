const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    consumer_id: String,
    type: String,
    severity: String,
    message: String,
    current_spend: Number,
    budget_limit: Number,
    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Alert", AlertSchema);