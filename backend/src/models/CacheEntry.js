const mongoose = require("mongoose");

const CacheEntrySchema = new mongoose.Schema(
  {
    cache_key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    consumer_id: {
      type: String,
      required: true,
      index: true
    },

    provider_id: String,
    provider_name: String,
    model: String,

    request_snapshot: {
      type: Object,
      default: {}
    },

    response_data: {
      type: Object,
      required: true
    },

    original_usage: {
      prompt_tokens: Number,
      completion_tokens: Number,
      total_tokens: Number
    },

    original_cost: {
      input_cost: Number,
      output_cost: Number,
      total_cost: Number
    },

    hits: {
      type: Number,
      default: 0
    },

    last_hit_at: Date,

    expires_at: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// MongoDB borrará automáticamente la caché cuando pase expires_at
CacheEntrySchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CacheEntry", CacheEntrySchema);