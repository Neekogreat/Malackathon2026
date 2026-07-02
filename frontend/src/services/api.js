const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.details || data.error || "Error llamando al backend");
  }

  return data;
}

export async function getOverview() {
  return requestJson("/api/dashboard/overview");
}

export async function getRequests(limit = 100) {
  return requestJson(`/api/requests?limit=${limit}`);
}

export async function getConsumers() {
  return requestJson("/api/consumers");
}

export async function getAlerts() {
  return requestJson("/api/alerts");
}

export async function updateConsumerBudget(consumerId, budgetLimit) {
  return requestJson(`/api/consumers/${consumerId}/budget`, {
    method: "PATCH",
    body: JSON.stringify({
      budget_limit: budgetLimit
    })
  });
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toISOString().slice(0, 10);
}

export function mapBackendRequest(req) {
  const inputTokens = Number(req.usage?.prompt_tokens || 0);
  const outputTokens = Number(req.usage?.completion_tokens || 0);
  const totalTokens =
    Number(req.usage?.total_tokens || 0) || inputTokens + outputTokens;

  return {
    id: req._id || "-",
    date: formatDate(req.createdAt),
    consumer: req.consumer_id || "-",
    provider: req.provider_name || req.provider_id || "-",
    model: req.model || "-",
    promptCategory:
      req.analysis?.primary_task_type ||
      req.analysis?.task_types?.[0]?.type ||
      "unknown",
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Number(req.cost?.total_cost || 0),
    status: req.status === "success" ? "allowed" : req.status || "unknown",
    routingReason:
      req.routing?.reason ||
      req.error_message ||
      "Sin motivo registrado",
    estimatedSaving: Number(
      req.routing?.estimated_saving_if_cheaper ||
        req.routing?.estimated_saving_vs_expensive ||
        0
    )
  };
}

export function mapBackendConsumerToBudget(consumer) {
  const alertThreshold = Number(consumer.alert_threshold || 0.8);

  return {
    consumer: consumer._id || consumer.name || "-",
    limit: Number(consumer.budget_limit || 0),
    spent: Number(consumer.current_spend || 0),
    threshold: alertThreshold <= 1 ? alertThreshold * 100 : alertThreshold
  };
}

export function mapBackendAlert(alert) {
  return {
    id: alert._id || crypto.randomUUID(),
    type:
      alert.severity === "critical" || alert.type === "budget_exceeded"
        ? "blocked"
        : "warning",
    consumer: alert.consumer_id || "-",
    message: alert.message || "Alerta sin mensaje"
  };
}