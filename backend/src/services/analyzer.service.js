const axios = require("axios");

const ALLOWED_TASK_TYPES = [
  "simple_qa",
  "summary",
  "translation",
  "classification",
  "rewriting",
  "creative_writing",
  "code_generation",
  "code_debugging",
  "technical_reasoning",
  "business_analysis",
  "long_context",
  "unknown"
];

const ALLOWED_LEVELS = ["low", "medium", "high"];

function getPromptText(messages = []) {
  return messages
    .map((message) => message.content || "")
    .join("\n")
    .trim();
}

function estimateInputTokens(messages = []) {
  const text = getPromptText(messages);

  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function extractJson(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No se encontró JSON en la respuesta del analyzer");
  }

  const jsonText = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonText);
}

function normalizeTaskType(value) {
  if (ALLOWED_TASK_TYPES.includes(value)) {
    return value;
  }

  return "unknown";
}

function normalizeLevel(value, fallback = "medium") {
  if (ALLOWED_LEVELS.includes(value)) {
    return value;
  }

  return fallback;
}

function clampConfidence(value) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return 0.6;
  }

  return Math.max(0, Math.min(1, numberValue));
}

function normalizeAnalysis(parsed, estimatedInputTokens) {
  const rawTaskTypes = Array.isArray(parsed.task_types)
    ? parsed.task_types
    : [];

  let taskTypes = rawTaskTypes
    .map((task) => ({
      type: normalizeTaskType(task.type),
      confidence: clampConfidence(task.confidence)
    }))
    .filter((task) => task.type !== "unknown" || task.confidence >= 0.4)
    .slice(0, 3);

  if (taskTypes.length === 0) {
    taskTypes = [
      {
        type: "unknown",
        confidence: 0.5
      }
    ];
  }

  let primaryTaskType = normalizeTaskType(parsed.primary_task_type);

  if (primaryTaskType === "unknown" && taskTypes.length > 0) {
    primaryTaskType = taskTypes[0].type;
  }

  const complexity = normalizeLevel(parsed.complexity, "medium");
  const qualityRequired = normalizeLevel(parsed.quality_required, "medium");
  const riskLevel = normalizeLevel(parsed.risk_level, "medium");

  return {
    task_types: taskTypes,
    primary_task_type: primaryTaskType,
    complexity,
    quality_required: qualityRequired,
    risk_level: riskLevel,
    estimated_input_tokens:
      Number(parsed.estimated_input_tokens) || estimatedInputTokens,
    reason:
      parsed.reason ||
      "Clasificación generada por Qwen como analyzer local.",
    analyzer: {
      type: "llm",
      model: process.env.ANALYZER_MODEL || "qwen2.5:1.5b"
    }
  };
}

/**
 * Fallback de seguridad.
 * Solo se usa si Qwen falla, no es el sistema principal.
 */
function fallbackAnalyzeRequest(messages = []) {
  const promptText = getPromptText(messages).toLowerCase();
  const estimatedInputTokens = estimateInputTokens(messages);

  const looksTechnical =
    promptText.includes("error") ||
    promptText.includes("bug") ||
    promptText.includes("código") ||
    promptText.includes("codigo") ||
    promptText.includes("javascript") ||
    promptText.includes("mongodb") ||
    promptText.includes("docker") ||
    promptText.includes("api");

  const asksPersonalContact =
    promptText.includes("instagram") ||
    promptText.includes("telefono") ||
    promptText.includes("teléfono") ||
    promptText.includes("email") ||
    promptText.includes("correo") ||
    promptText.includes("contacto");

  if (asksPersonalContact) {
    return {
      task_types: [
        {
          type: "unknown",
          confidence: 0.75
        }
      ],
      primary_task_type: "unknown",
      complexity: "medium",
      quality_required: "medium",
      risk_level: "high",
      estimated_input_tokens: estimatedInputTokens,
      reason:
        "Fallback: la petición parece solicitar datos personales o de contacto.",
      analyzer: {
        type: "fallback",
        model: null
      }
    };
  }

  if (looksTechnical) {
    return {
      task_types: [
        {
          type: "technical_reasoning",
          confidence: 0.7
        }
      ],
      primary_task_type: "technical_reasoning",
      complexity: "high",
      quality_required: "high",
      risk_level: "high",
      estimated_input_tokens: estimatedInputTokens,
      reason:
        "Fallback: se detecta una petición técnica porque el analyzer LLM no respondió correctamente.",
      analyzer: {
        type: "fallback",
        model: null
      }
    };
  }

  return {
    task_types: [
      {
        type: "simple_qa",
        confidence: 0.55
      }
    ],
    primary_task_type: "simple_qa",
    complexity: estimatedInputTokens > 1000 ? "medium" : "low",
    quality_required: "medium",
    risk_level: "low",
    estimated_input_tokens: estimatedInputTokens,
    reason:
      "Fallback: petición general usada porque el analyzer LLM no respondió correctamente.",
    analyzer: {
      type: "fallback",
      model: null
    }
  };
}

function buildClassifierPrompt(promptText, estimatedInputTokens) {
  return `
Eres un Request Analyzer para un sistema AI FinOps.

Tu tarea es clasificar la petición del usuario.
No respondas a la petición del usuario.
Devuelve SOLO JSON válido.
No uses markdown.
No añadas texto fuera del JSON.

Categorías permitidas:
simple_qa, summary, translation, classification, rewriting,
creative_writing, code_generation, code_debugging,
technical_reasoning, business_analysis, long_context, unknown.

Reglas de clasificación:
- Si pide una respuesta general o una explicación sencilla, usa simple_qa.
- Si pide resumir, usa summary.
- Si pide traducir, usa translation.
- Si pide clasificar, categorizar o etiquetar, usa classification.
- Si pide reescribir, reformular o mejorar un texto, usa rewriting.
- Si pide una historia, anuncio, slogan, campaña o texto creativo, usa creative_writing.
- Si pide escribir código nuevo, usa code_generation.
- Si pide corregir un error, bug, stacktrace o problema de programación, usa code_debugging.
- Si pide arquitectura, APIs, bases de datos, Docker, seguridad, infraestructura o rendimiento, usa technical_reasoning.
- Si pide analizar costes, presupuesto, gasto, ahorro, ROI, KPIs o forecast, usa business_analysis.
- Si el prompt es muy largo o tiene mucho contexto, añade también long_context.
- Si pide datos personales, redes sociales, teléfono, email, dirección o contacto de una persona concreta, usa unknown y risk_level high.
- Si hay varias categorías, devuelve máximo 3, ordenadas por importancia.
- La categoría principal debe ir en primary_task_type.

Devuelve exactamente este formato:
{
  "task_types": [
    {
      "type": "simple_qa",
      "confidence": 0.8
    }
  ],
  "primary_task_type": "simple_qa",
  "complexity": "low",
  "quality_required": "medium",
  "risk_level": "low",
  "estimated_input_tokens": ${estimatedInputTokens},
  "reason": "explicación breve de la clasificación"
}

Petición del usuario:
"""${promptText}"""
`;
}

async function analyzeRequestWithQwen(messages = []) {
  if (process.env.ANALYZER_ENABLED !== "true") {
    return fallbackAnalyzeRequest(messages);
  }

  const promptText = getPromptText(messages);
  const estimatedInputTokens = estimateInputTokens(messages);

  const analyzerBaseUrl =
    process.env.ANALYZER_BASE_URL || "http://localhost:11436/v1";

  const analyzerModel =
    process.env.ANALYZER_MODEL || "qwen2.5:1.5b";

  const classifierPrompt = buildClassifierPrompt(
    promptText,
    estimatedInputTokens
  );

  try {
    const response = await axios.post(
      `${analyzerBaseUrl}/chat/completions`,
      {
        model: analyzerModel,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: classifierPrompt
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    const content =
      response.data?.choices?.[0]?.message?.content || "";

    const parsed = extractJson(content);
    const normalized = normalizeAnalysis(parsed, estimatedInputTokens);

    console.log("[Analyzer Qwen]", {
      task: normalized.primary_task_type,
      risk: normalized.risk_level,
      complexity: normalized.complexity,
      model: analyzerModel
    });

    return normalized;
  } catch (error) {
    console.error("[Analyzer Qwen fallback]", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return fallbackAnalyzeRequest(messages);
  }
}

module.exports = {
  analyzeRequestWithQwen,
  fallbackAnalyzeRequest,
  estimateInputTokens
};