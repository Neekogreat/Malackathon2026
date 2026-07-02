const Provider = require("../models/Provider");
const { analyzeRequestWithQwen } = require("./analyzer.service");

const STRATEGIES = {
  CHEAP_MODEL: "cheap_model",
  BALANCED: "balanced",
  QUALITY_PRIORITY: "quality_priority",
  BUDGET_SAVING: "budget_saving",
  BUDGET_DEGRADATION: "budget_degradation",
  BUDGET_BLOCKED: "budget_blocked"
};

const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
};

const TASK_TYPES = {
  SUMMARY: "summary",
  SIMPLE_QA: "simple_qa",
  TRANSLATION: "translation",
  CLASSIFICATION: "classification",
  REWRITING: "rewriting",
  CREATIVE_WRITING: "creative_writing",
  CODE_GENERATION: "code_generation",
  CODE_DEBUGGING: "code_debugging",
  TECHNICAL_REASONING: "technical_reasoning",
  BUSINESS_ANALYSIS: "business_analysis",
  LONG_CONTEXT: "long_context",
  UNKNOWN: "unknown",
  GENERAL_CHAT: "simple_qa"
};

const TECHNICAL_TASK_TYPES = [
  TASK_TYPES.CODE_DEBUGGING,
  TASK_TYPES.CODE_GENERATION,
  TASK_TYPES.TECHNICAL_REASONING
];

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPromptText(messages = []) {
  return messages
    .map((message) => message.content || "")
    .join(" ");
}

function estimateInputTokens(messages = []) {
  const text = getPromptText(messages).trim();

  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => {
    return total + (text.includes(pattern) ? 1 : 0);
  }, 0);
}

/**
 * Detecta si el análisis corresponde a una tarea técnica.
 * Esta función es clave:
 * aunque Qwen devuelva risk_level = low, si la categoría es técnica,
 * el routing debe priorizar calidad.
 */
function isTechnicalAnalysis(analysis = {}) {
  const taskTypes = analysis.task_types?.map((task) => task.type) || [];

  return (
    TECHNICAL_TASK_TYPES.includes(analysis.primary_task_type) ||
    taskTypes.some((type) => TECHNICAL_TASK_TYPES.includes(type))
  );
}

function normalizeAnalysisForRouting(analysis = {}) {
  const normalizedAnalysis = {
    ...analysis
  };

  if (isTechnicalAnalysis(normalizedAnalysis)) {
    normalizedAnalysis.risk_level = RISK_LEVELS.HIGH;
    normalizedAnalysis.complexity = "high";
    normalizedAnalysis.quality_required = "high";

    normalizedAnalysis.reason = `${
      normalizedAnalysis.reason || "Clasificación generada por Qwen."
    } Regla FinOps aplicada: las tareas técnicas requieren mayor calidad.`;
  }

  return normalizedAnalysis;
}

/**
 * Analyzer local antiguo.
 * Ahora el sistema principal usa Qwen, pero dejamos este analyzer como utilidad
 * o fallback exportado si más adelante lo necesitáis.
 */
function analyzeRequest(messages = []) {
  const rawText = getPromptText(messages);
  const text = normalizeText(rawText);
  const estimatedInputTokens = estimateInputTokens(messages);

  const taskSignals = {
    [TASK_TYPES.SUMMARY]: [
      "resume",
      "resumen",
      "summarize",
      "sintetiza",
      "sintetizar",
      "haz un resumen",
      "extrae las ideas",
      "puntos clave"
    ],

    [TASK_TYPES.SIMPLE_QA]: [
      "que es",
      "explica",
      "definicion",
      "diferencia entre",
      "como funciona",
      "ayudame a entender",
      "dime que significa"
    ],

    [TASK_TYPES.TRANSLATION]: [
      "traduce",
      "traducir",
      "translate",
      "en ingles",
      "en español",
      "al ingles",
      "al español"
    ],

    [TASK_TYPES.CLASSIFICATION]: [
      "clasifica",
      "categoria",
      "categoriza",
      "agrupa",
      "detecta el tipo",
      "identifica si"
    ],

    [TASK_TYPES.REWRITING]: [
      "reescribe",
      "reformula",
      "mejora este texto",
      "corrige este texto",
      "hazlo mas profesional",
      "cambia el tono",
      "redacta mejor"
    ],

    [TASK_TYPES.CREATIVE_WRITING]: [
      "crea una historia",
      "idea creativa",
      "copy",
      "anuncio",
      "campana",
      "slogan",
      "post para redes"
    ],

    [TASK_TYPES.CODE_GENERATION]: [
      "crea una funcion",
      "crea una función",
      "hazme una funcion",
      "hazme una función",
      "implementa",
      "escribe codigo",
      "escribe código",
      "genera codigo",
      "genera código",
      "componente react",
      "endpoint",
      "controlador",
      "servicio"
    ],

    [TASK_TYPES.CODE_DEBUGGING]: [
      "codigo",
      "código",
      "programa",
      "funcion",
      "función",
      "bug",
      "error",
      "stacktrace",
      "debug",
      "depura",
      "corrige el codigo",
      "corrige el código",
      "no funciona",
      "falla",
      "javascript",
      "node",
      "react",
      "python",
      "java",
      "sql",
      "mongodb",
      "docker",
      "api",
      "endpoint",
      "npm",
      "git"
    ],

    [TASK_TYPES.TECHNICAL_REASONING]: [
      "arquitectura",
      "seguridad",
      "vulnerabilidad",
      "produccion",
      "producción",
      "latencia",
      "rendimiento",
      "optimizacion",
      "optimización",
      "escalabilidad",
      "infraestructura",
      "base de datos",
      "backend",
      "proxy",
      "finops"
    ],

    [TASK_TYPES.BUSINESS_ANALYSIS]: [
      "coste",
      "costo",
      "presupuesto",
      "gasto",
      "ahorro",
      "forecast",
      "prediccion",
      "predicción",
      "analisis de negocio",
      "roi",
      "kpi",
      "metricas",
      "métricas"
    ]
  };

  const scoredTasks = Object.entries(taskSignals).map(([taskType, patterns]) => {
    let score = countMatches(text, patterns);

    if (
      taskType === TASK_TYPES.CODE_DEBUGGING &&
      /```|function|const|let|class|select|insert|update|delete|npm|git|docker/.test(text)
    ) {
      score += 2;
    }

    if (
      taskType === TASK_TYPES.CODE_GENERATION &&
      /function|const|let|class|router|controller|service|component|export default/.test(text)
    ) {
      score += 2;
    }

    if (
      taskType === TASK_TYPES.TECHNICAL_REASONING &&
      estimatedInputTokens > 1200
    ) {
      score += 1;
    }

    if (
      taskType === TASK_TYPES.SIMPLE_QA &&
      estimatedInputTokens < 250 &&
      text.includes("?")
    ) {
      score += 0.5;
    }

    return {
      type: taskType,
      score
    };
  });

  scoredTasks.sort((a, b) => b.score - a.score);

  const bestTask = scoredTasks[0];

  const primaryTaskType =
    bestTask && bestTask.score > 0
      ? bestTask.type
      : TASK_TYPES.SIMPLE_QA;

  const taskTypes = scoredTasks
    .filter((task) => task.score > 0)
    .slice(0, 3)
    .map((task) => ({
      type: task.type,
      confidence: calculateConfidence(task.score)
    }));

  if (taskTypes.length === 0) {
    taskTypes.push({
      type: TASK_TYPES.SIMPLE_QA,
      confidence: 0.55
    });
  }

  const riskLevel = calculateRiskLevel({
    primaryTaskType,
    estimatedInputTokens,
    text
  });

  const complexity = calculateComplexity({
    primaryTaskType,
    estimatedInputTokens,
    riskLevel
  });

  const qualityRequired =
    riskLevel === RISK_LEVELS.HIGH
      ? "high"
      : riskLevel === RISK_LEVELS.MEDIUM
        ? "medium"
        : "low";

  return {
    task_types: taskTypes,
    primary_task_type: primaryTaskType,
    complexity,
    quality_required: qualityRequired,
    risk_level: riskLevel,
    estimated_input_tokens: estimatedInputTokens,
    reason: buildAnalysisReason(primaryTaskType, riskLevel, estimatedInputTokens)
  };
}

function calculateConfidence(score) {
  if (score >= 4) {
    return 0.9;
  }

  if (score >= 2) {
    return 0.75;
  }

  if (score >= 1) {
    return 0.62;
  }

  return 0.55;
}

function calculateRiskLevel({ primaryTaskType, estimatedInputTokens, text }) {
  const highRiskTasks = [
    TASK_TYPES.CODE_DEBUGGING,
    TASK_TYPES.CODE_GENERATION,
    TASK_TYPES.TECHNICAL_REASONING
  ];

  const mediumRiskTasks = [
    TASK_TYPES.BUSINESS_ANALYSIS,
    TASK_TYPES.CREATIVE_WRITING
  ];

  if (highRiskTasks.includes(primaryTaskType)) {
    return RISK_LEVELS.HIGH;
  }

  if (mediumRiskTasks.includes(primaryTaskType)) {
    return RISK_LEVELS.MEDIUM;
  }

  if (
    text.includes("produccion") ||
    text.includes("seguridad") ||
    text.includes("vulnerabilidad") ||
    text.includes("datos sensibles")
  ) {
    return RISK_LEVELS.HIGH;
  }

  if (estimatedInputTokens > 4500) {
    return RISK_LEVELS.HIGH;
  }

  if (estimatedInputTokens > 1800) {
    return RISK_LEVELS.MEDIUM;
  }

  return RISK_LEVELS.LOW;
}

function calculateComplexity({ primaryTaskType, estimatedInputTokens, riskLevel }) {
  if (riskLevel === RISK_LEVELS.HIGH) {
    return "high";
  }

  if (
    estimatedInputTokens > 1800 ||
    primaryTaskType === TASK_TYPES.BUSINESS_ANALYSIS
  ) {
    return "medium";
  }

  return "low";
}

function buildAnalysisReason(primaryTaskType, riskLevel, estimatedInputTokens) {
  return `Se clasifica como ${primaryTaskType}, con riesgo ${riskLevel} y una estimación de ${estimatedInputTokens} tokens de entrada`;
}

function getStrategyFromAnalysis(analysis, budgetStatus) {
  /**
   * Si el consumidor está cerca del presupuesto, FinOps prioriza ahorro.
   * Esta regla puede hacer que incluso tareas técnicas se degraden si estáis
   * en modo ahorro. Si queréis que Provider B gane siempre para código,
   * poned este bloque después de isTechnicalAnalysis.
   */
  if (budgetStatus.status === "warning") {
    return STRATEGIES.BUDGET_SAVING;
  }

  /**
   * Regla fuerte:
   * si Qwen detecta debugging, generación de código o razonamiento técnico,
   * se prioriza calidad, aunque el risk_level venga como low.
   */
  if (isTechnicalAnalysis(analysis)) {
    return STRATEGIES.QUALITY_PRIORITY;
  }

  if (
    analysis.risk_level === RISK_LEVELS.HIGH ||
    analysis.complexity === RISK_LEVELS.HIGH ||
    analysis.quality_required === RISK_LEVELS.HIGH
  ) {
    return STRATEGIES.QUALITY_PRIORITY;
  }

  if (
    analysis.risk_level === RISK_LEVELS.LOW &&
    analysis.estimated_input_tokens < 1200
  ) {
    return STRATEGIES.CHEAP_MODEL;
  }

  return STRATEGIES.BALANCED;
}

function getWeights(strategy) {
  if (
    strategy === STRATEGIES.CHEAP_MODEL ||
    strategy === STRATEGIES.BUDGET_SAVING ||
    strategy === STRATEGIES.BUDGET_DEGRADATION
  ) {
    return {
      cost: 0.7,
      quality: 0.3
    };
  }

  if (strategy === STRATEGIES.QUALITY_PRIORITY) {
    return {
      cost: 0.2,
      quality: 0.8
    };
  }

  return {
    cost: 0.45,
    quality: 0.55
  };
}

function getAveragePricePer1M(provider) {
  return (
    ((provider.input_price_per_1m || 0) +
      (provider.output_price_per_1m || 0)) /
    2
  );
}

function getCostScore(provider, providers) {
  const prices = providers.map(getAveragePricePer1M);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const providerPrice = getAveragePricePer1M(provider);

  if (maxPrice === minPrice) {
    return 1;
  }

  return 1 - (providerPrice - minPrice) / (maxPrice - minPrice);
}

function getQualityScore(provider, taskType) {
  const rawCapability = provider.capabilities?.[taskType];

  if (typeof rawCapability === "number") {
    return rawCapability / 10;
  }

  /**
   * Fallback importante:
   * si no hay capability explícita en MongoDB, asumimos que Provider B
   * es mejor para tareas técnicas y Provider A mejor para tareas sencillas.
   */
  if (TECHNICAL_TASK_TYPES.includes(taskType)) {
    if (String(provider._id) === "provider-b") {
      return 0.9;
    }

    if (String(provider._id) === "provider-a") {
      return 0.55;
    }
  }

  if (String(provider._id) === "provider-a") {
    return 0.7;
  }

  return 0.6;
}

function estimateOutputTokens(estimatedInputTokens) {
  return Math.max(100, Math.ceil(estimatedInputTokens * 0.4));
}

function estimateProviderCost(provider, analysis) {
  const inputTokens = analysis.estimated_input_tokens || 0;
  const outputTokens = estimateOutputTokens(inputTokens);

  const inputCost =
    (inputTokens * provider.input_price_per_1m) / 1_000_000;

  const outputCost =
    (outputTokens * provider.output_price_per_1m) / 1_000_000;

  return Number((inputCost + outputCost).toFixed(8));
}

function scoreProvider(provider, providers, analysis, strategy) {
  const weights = getWeights(strategy);

  const costScore = getCostScore(provider, providers);
  const qualityScore = getQualityScore(provider, analysis.primary_task_type);

  let adjustedQualityScore = qualityScore;

  if (
    strategy === STRATEGIES.QUALITY_PRIORITY &&
    isTechnicalAnalysis(analysis) &&
    String(provider._id) === "provider-b"
  ) {
    adjustedQualityScore += 0.1;
  }

  if (
    analysis.risk_level === RISK_LEVELS.HIGH &&
    adjustedQualityScore < 0.7
  ) {
    adjustedQualityScore -= 0.2;
  }

  adjustedQualityScore = Math.max(0, Math.min(1, adjustedQualityScore));

  const totalScore =
    costScore * weights.cost +
    adjustedQualityScore * weights.quality;

  return {
    provider_id: provider._id,
    provider_name: provider.name,
    model: provider.model,
    strategy,
    cost_score: Number(costScore.toFixed(3)),
    quality_score: Number(adjustedQualityScore.toFixed(3)),
    total_score: Number(totalScore.toFixed(3)),
    estimated_cost: estimateProviderCost(provider, analysis),
    capability_for_task:
      provider.capabilities?.[analysis.primary_task_type] ?? null
  };
}

function getCheapestAlternative(providers, analysis) {
  if (!providers.length) {
    return null;
  }

  const sortedByCost = providers
    .map((provider) => ({
      provider_id: provider._id,
      provider_name: provider.name,
      model: provider.model,
      estimated_cost: estimateProviderCost(provider, analysis)
    }))
    .sort((a, b) => a.estimated_cost - b.estimated_cost);

  return sortedByCost[0];
}

function getProviderBFromScoring(scoring = []) {
  return scoring.find((providerScore) => {
    return String(providerScore.provider_id) === "provider-b";
  });
}

function buildFinalReason(strategy, analysis, selectedProvider, cheapestAlternative) {
  if (strategy === STRATEGIES.CHEAP_MODEL) {
    return "Tarea de bajo riesgo; el modelo barato es suficiente";
  }

  if (
    strategy === STRATEGIES.QUALITY_PRIORITY &&
    isTechnicalAnalysis(analysis)
  ) {
    return "Tarea técnica detectada por Qwen; se prioriza calidad usando Provider B";
  }

  if (strategy === STRATEGIES.QUALITY_PRIORITY) {
    return "Tarea de alto riesgo o complejidad; se prioriza calidad";
  }

  if (strategy === STRATEGIES.BUDGET_SAVING) {
    return "Consumidor cerca del límite de presupuesto; se prioriza coste";
  }

  if (strategy === STRATEGIES.BUDGET_DEGRADATION) {
    return "Presupuesto superado; se degrada al modelo más barato";
  }

  if (
    cheapestAlternative &&
    selectedProvider &&
    cheapestAlternative.provider_id !== selectedProvider.provider_id
  ) {
    return `Se elige equilibrio entre coste y calidad. Alternativa más barata: ${cheapestAlternative.provider_id}`;
  }

  return "Se elige el proveedor con mejor equilibrio entre coste y calidad";
}

async function chooseProvider({ consumer, budgetStatus, messages }) {
  let analysis = await analyzeRequestWithQwen(messages);
  analysis = normalizeAnalysisForRouting(analysis);

  const providers = await Provider.find({
    enabled: true
  }).lean();

  if (!providers.length) {
    throw new Error("No hay proveedores habilitados");
  }

  /**
   * Caso 1: presupuesto superado.
   */
  if (budgetStatus.status === "budget_exceeded") {
    if (!consumer.allow_degradation) {
      return {
        action: "block",
        selected_provider_id: null,
        strategy: STRATEGIES.BUDGET_BLOCKED,
        reason: "Presupuesto superado y degradación no permitida",
        analysis
      };
    }

    const cheapestAlternative = getCheapestAlternative(providers, analysis);

    return {
      action: "route",
      selected_provider_id: cheapestAlternative.provider_id,
      selected_model: cheapestAlternative.model,
      strategy: STRATEGIES.BUDGET_DEGRADATION,
      reason: "Presupuesto superado; se degrada al modelo más barato",
      analysis,
      scoring: [],
      cheapest_alternative: cheapestAlternative
    };
  }

  /**
   * Caso 2: presupuesto normal o warning.
   */
  const strategy = getStrategyFromAnalysis(analysis, budgetStatus);

  const scoring = providers
    .map((provider) => scoreProvider(provider, providers, analysis, strategy))
    .sort((a, b) => b.total_score - a.total_score);

  /**
   * Regla fuerte:
   * si es tarea técnica y la estrategia es quality_priority,
   * elegimos Provider B directamente si está disponible.
   *
   * Esto evita el caso que os pasó:
   * Qwen clasifica code_debugging, pero risk_level sale low,
   * y el scoring acaba eligiendo Provider A por coste.
   */
  const providerBScore = getProviderBFromScoring(scoring);

  const selectedProvider =
    strategy === STRATEGIES.QUALITY_PRIORITY &&
    isTechnicalAnalysis(analysis) &&
    providerBScore
      ? providerBScore
      : scoring[0];

  const cheapestAlternative = getCheapestAlternative(providers, analysis);

  return {
    action: "route",
    selected_provider_id: selectedProvider.provider_id,
    selected_model: selectedProvider.model,
    strategy,
    reason: buildFinalReason(
      strategy,
      analysis,
      selectedProvider,
      cheapestAlternative
    ),
    analysis,
    scoring,
    cheapest_alternative: cheapestAlternative
  };
}

module.exports = {
  chooseProvider,
  analyzeRequest,
  estimateInputTokens,
  TASK_TYPES,
  RISK_LEVELS,
  STRATEGIES
};