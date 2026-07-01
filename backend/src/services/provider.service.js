const axios = require("axios");

async function callProvider(provider, originalBody) {
  const url = `${provider.base_url}/chat/completions`;

  const body = {
    ...originalBody,
    model: provider.model
  };

  const start = Date.now();

  const response = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  const latencyMs = Date.now() - start;

  return {
    data: response.data,
    latencyMs
  };
}

module.exports = {
  callProvider
};