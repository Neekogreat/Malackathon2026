function calculateCost(provider, usage) {
  const promptTokens = usage?.prompt_tokens || 0;
  const completionTokens = usage?.completion_tokens || 0;

  const inputCost =
    (promptTokens * provider.input_price_per_1m) / 1_000_000;

  const outputCost =
    (completionTokens * provider.output_price_per_1m) / 1_000_000;

  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost
  };
}

module.exports = {
  calculateCost
};