const crypto = require("crypto");
const CacheEntry = require("../models/CacheEntry");

const DEFAULT_CACHE_TTL_HOURS = 24;

/**
 * Esto convierte objetos a texto siempre en el mismo orden.
 * Así evitamos que dos objetos iguales generen hashes distintos.
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

/**
 * Solo cogemos los parámetros que pueden cambiar la respuesta.
 */
function getGenerationParams(body = {}) {
  return {
    temperature: body.temperature ?? null,
    max_tokens: body.max_tokens ?? null,
    top_p: body.top_p ?? null,
    stop: body.stop ?? null,
    response_format: body.response_format ?? null
  };
}

/**
 * Normalizamos los mensajes, pero NO quitamos el contenido.
 * El texto completo forma parte de la clave.
 */
function getSafeMessages(messages = []) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

/**
 * Evita cachear casos ambiguos como:
 * "resúmelo"
 * "tradúcelo"
 * "hazlo"
 *
 * Si el frontend no manda el texto anterior dentro de messages,
 * no sabemos qué significa "lo", así que no cacheamos.
 */
function hasEnoughContext(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  const lastMessage = messages[messages.length - 1];
  const lastContent = String(lastMessage?.content || "")
    .trim()
    .toLowerCase();

  const ambiguousCommands = [
    "resúmelo",
    "resumelo",
    "resume",
    "tradúcelo",
    "traducelo",
    "hazlo",
    "corrígelo",
    "corrigelo",
    "mejóralo",
    "mejoralo"
  ];

  if (messages.length === 1 && ambiguousCommands.includes(lastContent)) {
    return false;
  }

  return true;
}

function isCacheableRequest(body = {}) {
  const messages = body.messages || [];

  if (body.stream === true) {
    return false;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  if (!hasEnoughContext(messages)) {
    return false;
  }

  return messages.every(
    (message) =>
      typeof message.role === "string" &&
      typeof message.content === "string"
  );
}

/**
 * Esta es la clave de todo:
 * la cache key se genera con:
 * - consumidor
 * - proveedor/modelo elegido
 * - mensajes completos
 * - parámetros que afectan a la respuesta
 */
function buildCacheKey({
  consumerId,
  providerId,
  model,
  body
}) {
  const raw = {
    version: "cache-v1",
    consumer_id: consumerId,
    provider_id: String(providerId),
    model,
    messages: getSafeMessages(body.messages || []),
    generation_params: getGenerationParams(body)
  };

  return crypto
    .createHash("sha256")
    .update(stableStringify(raw))
    .digest("hex");
}

async function getCachedResponse(cacheKey) {
  const cached = await CacheEntry.findOne({
    cache_key: cacheKey,
    expires_at: { $gt: new Date() }
  });

  if (!cached) {
    return null;
  }

  cached.hits += 1;
  cached.last_hit_at = new Date();
  await cached.save();

  return cached;
}

async function saveResponseToCache({
  cacheKey,
  consumerId,
  provider,
  body,
  responseData,
  usage,
  cost
}) {
  const ttlHours = Number(process.env.CACHE_TTL_HOURS || DEFAULT_CACHE_TTL_HOURS);

  const expiresAt = new Date(
    Date.now() + ttlHours * 60 * 60 * 1000
  );

  await CacheEntry.findOneAndUpdate(
    { cache_key: cacheKey },
    {
      cache_key: cacheKey,
      consumer_id: consumerId,
      provider_id: String(provider._id),
      provider_name: provider.name,
      model: provider.model,
      request_snapshot: {
        messages: getSafeMessages(body.messages || []),
        generation_params: getGenerationParams(body)
      },
      response_data: responseData,
      original_usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens:
          usage.total_tokens ||
          (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      },
      original_cost: {
        input_cost: cost.input_cost || 0,
        output_cost: cost.output_cost || 0,
        total_cost: cost.total_cost || 0
      },
      expires_at: expiresAt
    },
    {
      upsert: true,
      new: true
    }
  );
}

module.exports = {
  isCacheableRequest,
  buildCacheKey,
  getCachedResponse,
  saveResponseToCache
};