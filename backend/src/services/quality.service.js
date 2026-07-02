function getAssistantContent(responseData = {}) {
  return responseData?.choices?.[0]?.message?.content || "";
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function getQualityLabel(score) {
  if (score >= 0.85) {
    return "high";
  }

  if (score >= 0.65) {
    return "acceptable";
  }

  if (score >= 0.45) {
    return "medium";
  }

  return "low";
}

function isTechnicalTask(taskType) {
  return [
    "code_generation",
    "code_debugging",
    "technical_reasoning"
  ].includes(taskType);
}

function evaluateResponseQuality({
  responseData,
  analysis = {},
  provider = {},
  strategy = "",
  usage = {}
}) {
  const content = getAssistantContent(responseData);
  const responseChars = content.length;
  const completionTokens = Number(usage.completion_tokens || 0);

  const taskType = analysis.primary_task_type || "unknown";
  const riskLevel = analysis.risk_level || "medium";
  const qualityRequired = analysis.quality_required || "medium";

  const reasons = [];
  let score = 0.65;

  if (!content.trim()) {
    return {
      score: 0.1,
      label: "low",
      method: "heuristic_v1",
      reason: "La respuesta está vacía o no contiene contenido útil.",
      signals: {
        task_type: taskType,
        risk_level: riskLevel,
        quality_required: qualityRequired,
        response_chars: responseChars,
        completion_tokens: completionTokens,
        provider: provider.name,
        model: provider.model,
        strategy
      }
    };
  }

  if (responseChars >= 100) {
    score += 0.08;
    reasons.push("La respuesta tiene una longitud mínima razonable.");
  } else {
    score -= 0.12;
    reasons.push("La respuesta es corta para evaluar calidad con confianza.");
  }

  if (responseChars >= 350) {
    score += 0.05;
    reasons.push("La respuesta aporta suficiente detalle.");
  }

  if (qualityRequired === "high" && completionTokens < 80) {
    score -= 0.12;
    reasons.push("La tarea requiere alta calidad pero la respuesta es breve.");
  }

  if (isTechnicalTask(taskType)) {
    const looksStructured =
      content.includes("```") ||
      content.includes("function") ||
      content.includes("const ") ||
      content.includes("router") ||
      content.includes("endpoint") ||
      content.includes("paso") ||
      content.includes("1.");

    if (looksStructured) {
      score += 0.08;
      reasons.push("La tarea técnica tiene una respuesta estructurada o con señales de código.");
    } else {
      score -= 0.08;
      reasons.push("La tarea técnica no muestra demasiada estructura técnica.");
    }
  }

  if (
    taskType === "summary" ||
    taskType === "translation" ||
    taskType === "classification" ||
    taskType === "simple_qa" ||
    taskType === "rewriting"
  ) {
    if (riskLevel === "low" && strategy === "cheap_model") {
      score += 0.06;
      reasons.push("Tarea de bajo riesgo resuelta con modelo barato: calidad suficiente esperada.");
    }
  }

  if (strategy === "quality_priority") {
    score += 0.06;
    reasons.push("La estrategia prioriza calidad para una tarea compleja o técnica.");
  }

  if (String(provider._id) === "provider-b") {
    score += 0.05;
    reasons.push("Provider B tiene mayor capacidad configurada para tareas complejas.");
  }

  if (strategy === "fallback") {
    score -= 0.05;
    reasons.push("Se usó fallback; puede existir degradación respecto al proveedor elegido inicialmente.");
  }

  if (content.toLowerCase().includes("no puedo") || content.toLowerCase().includes("no sé")) {
    score -= 0.08;
    reasons.push("La respuesta contiene señales de incertidumbre o incapacidad.");
  }

  score = clamp(score);

  return {
    score: Number(score.toFixed(2)),
    label: getQualityLabel(score),
    method: "heuristic_v1",
    reason: reasons.join(" "),
    signals: {
      task_type: taskType,
      risk_level: riskLevel,
      quality_required: qualityRequired,
      response_chars: responseChars,
      completion_tokens: completionTokens,
      provider: provider.name,
      model: provider.model,
      strategy
    }
  };
}

module.exports = {
  evaluateResponseQuality
};