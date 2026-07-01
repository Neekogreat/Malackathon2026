const mongoose = require("mongoose");

const ProviderSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    base_url: {
      type: String,
      required: true
    },
    input_price_per_1m: {
      type: Number,
      required: true
    },
    output_price_per_1m: {
      type: Number,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    capabilities: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Provider", ProviderSchema);