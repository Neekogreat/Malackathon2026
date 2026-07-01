function getPromptText(messages = []) {
  return messages
    .map((m) => m.content || "")
    .join(" ")
    .toLowerCase();
}

function estimateInputTokens(messages = []) {
  const text = getPromptText(messages);
  return Math.ceil(text.length / 4);
}

function analyzeRequest(messages = []) {
  const text = getPromptText(messages);
  const estimatedInputTokens = estimateInputTokens(messages);

  const technicalSignals = [
    "error",
    "código",
    "codigo",
    "python",
    "java",
    "javascript",
    "sql",
    "mongodb",
    "docker",
    "api",
    "bug",
    "stacktrace",
    "corrige",
    "depura",
    "debug",
    "paso a paso"
  ];

  const simpleSignals = [
    "resume",
    "resumen",
    "traduce",
    "clasifica",
    "reformula",
    "una frase",
    "hazlo corto"
  ];

  const isTechnical = technicalSignals.some((word) => text.includes(word));
  const isSimple = simpleSignals.some((word) => text.includes(word));

  if (isTechnical) {
    return {
      task_types: [
        {
          type: "technical_reasoning",
          confidence: 0.85
        }
      ],
      complexity: "high",
      quality_required: "high",
      risk_level: "high",
      estimated_input_tokens: estimatedInputTokens,
      reason: "Se detecta una tarea técnica o de razonamiento complejo"
    };
  }

  if (isSimple) {
    return {
      task_types: [
        {
          type: "summary",
          confidence: 0.85
        }
      ],
      complexity: "low",
      quality_required: "low",
      risk_level: "low",
      estimated_input_tokens: estimatedInputTokens,
      reason: "Se detecta una tarea simple de resumen, traducción o reformulación"
    };
  }

  return {
    task_types: [
      {
        type: "simple_qa",
        confidence: 0.6
      }
    ],
    complexity: estimatedInputTokens > 1000 ? "medium" : "low",
    quality_required: "medium",
    risk_level: "medium",
    estimated_input_tokens: estimatedInputTokens,
    reason: "No se detecta una tarea crítica; se usa análisis general"
  };
}

function chooseProvider({ consumer, budgetStatus, messages }) {
  const analysis = analyzeRequest(messages);

  let selectedProviderId = "provider-a";
  let strategy = "cheap_model";
  let reason = "Tarea simple o de bajo riesgo; se usa el modelo más barato";

  if (budgetStatus.status === "budget_exceeded") {
    if (consumer.allow_degradation) {
      return {
        action: "route",
        selected_provider_id: "provider-a",
        strategy: "budget_degradation",
        reason: "Presupuesto superado; se degrada al modelo más barato",
        analysis
      };
    }

    return {
      action: "block",
      selected_provider_id: null,
      strategy: "budget_blocked",
      reason: "Presupuesto superado y degradación no permitida",
      analysis
    };
  }

  if (budgetStatus.status === "warning") {
    return {
      action: "route",
      selected_provider_id: "provider-a",
      strategy: "budget_saving",
      reason: "Consumidor cerca del límite de presupuesto; se prioriza coste",
      analysis
    };
  }

  if (
    analysis.risk_level === "high" ||
    analysis.complexity === "high" ||
    analysis.quality_required === "high"
  ) {
    selectedProviderId = "provider-b";
    strategy = "quality_priority";
    reason = "Tarea técnica o de alta complejidad; se prioriza calidad";
  }

  return {
    action: "route",
    selected_provider_id: selectedProviderId,
    strategy,
    reason,
    analysis
  };
}

module.exports = {
  chooseProvider,
  analyzeRequest,
  estimateInputTokens
};