const axios = require("axios");

async function callProvider(provider, originalBody) {
  const url = `${provider.base_url}/chat/completions`;

  const body = {
    ...originalBody,
    model: provider.model
  };

  const start = Date.now();

  try {
    const apiKeyByProviderId = {
  "provider-a": process.env.PROVIDER_A_API_KEY,
  "provider-b": process.env.PROVIDER_B_API_KEY
};

const apiKey = apiKeyByProviderId[String(provider._id)];

const headers = {
  "Content-Type": "application/json"
};

if (apiKey) {
  headers.Authorization = `Bearer ${apiKey}`;
}

const response = await axios.post(url, body, {
  headers,
  timeout: 120000
});

    const latencyMs = Date.now() - start;

    return {
      success: true,
      data: response.data,
      latencyMs
    };
  } catch (error) {
    const latencyMs = Date.now() - start;

    console.error("[Provider error]", {
      provider: provider.name,
      url,
      message: error.message
    });

    return {
      success: false,
      error: error.message,
      latencyMs
    };
  }
}

module.exports = {
  callProvider
};