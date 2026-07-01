export const requests = [
  {
    id: "REQ-001",
    date: "2026-06-25",
    consumer: "equipo-marketing",
    provider: "Provider A",
    model: "llama3.2:3b",
    promptCategory: "resumir",
    inputTokens: 850,
    outputTokens: 240,
    totalTokens: 1090,
    cost: 0.0218,
    status: "allowed",
    routingReason: "Tarea simple: modelo barato",
    estimatedSaving: 0.038
  },
  {
    id: "REQ-002",
    date: "2026-06-26",
    consumer: "equipo-producto",
    provider: "Provider B",
    model: "mistral:7b",
    promptCategory: "generar código",
    inputTokens: 1800,
    outputTokens: 900,
    totalTokens: 2700,
    cost: 0.081,
    status: "allowed",
    routingReason: "Tarea compleja: modelo de mayor calidad",
    estimatedSaving: 0
  },
  {
    id: "REQ-003",
    date: "2026-06-27",
    consumer: "equipo-marketing",
    provider: "Provider A",
    model: "llama3.2:3b",
    promptCategory: "traducir",
    inputTokens: 1200,
    outputTokens: 500,
    totalTokens: 1700,
    cost: 0.034,
    status: "allowed",
    routingReason: "Traducción simple: modelo barato",
    estimatedSaving: 0.041
  },
  {
    id: "REQ-004",
    date: "2026-06-28",
    consumer: "equipo-soporte",
    provider: "Provider A",
    model: "llama3.2:3b",
    promptCategory: "chat general",
    inputTokens: 430,
    outputTokens: 180,
    totalTokens: 610,
    cost: 0.0122,
    status: "allowed",
    routingReason: "Consulta corta: modelo barato",
    estimatedSaving: 0.023
  },
  {
    id: "REQ-005",
    date: "2026-06-29",
    consumer: "equipo-producto",
    provider: "Provider B",
    model: "mistral:7b",
    promptCategory: "analizar documento",
    inputTokens: 3000,
    outputTokens: 1200,
    totalTokens: 4200,
    cost: 0.126,
    status: "allowed",
    routingReason: "Documento largo: modelo de mayor calidad",
    estimatedSaving: 0
  },
  {
    id: "REQ-006",
    date: "2026-06-30",
    consumer: "equipo-marketing",
    provider: "Provider A",
    model: "llama3.2:3b",
    promptCategory: "crear imagen",
    inputTokens: 600,
    outputTokens: 0,
    totalTokens: 600,
    cost: 0.045,
    status: "allowed",
    routingReason: "Proveedor más barato compatible",
    estimatedSaving: 0.07
  },
  {
    id: "REQ-007",
    date: "2026-07-01",
    consumer: "equipo-marketing",
    provider: "Blocked",
    model: "-",
    promptCategory: "generar código",
    inputTokens: 2200,
    outputTokens: 0,
    totalTokens: 2200,
    cost: 0,
    status: "blocked",
    routingReason: "Presupuesto superado",
    estimatedSaving: 0
  },
  {
    id: "REQ-008",
    date: "2026-07-01",
    consumer: "equipo-soporte",
    provider: "Provider A",
    model: "llama3.2:3b",
    promptCategory: "chat general",
    inputTokens: 320,
    outputTokens: 160,
    totalTokens: 480,
    cost: 0.0096,
    status: "allowed",
    routingReason: "Consulta corta: modelo barato",
    estimatedSaving: 0.018
  },
  {
    id: "REQ-009",
    date: "2026-07-01",
    consumer: "equipo-producto",
    provider: "Provider B",
    model: "mistral:7b",
    promptCategory: "analizar documento",
    inputTokens: 2600,
    outputTokens: 950,
    totalTokens: 3550,
    cost: 0.1065,
    status: "allowed",
    routingReason: "Alta complejidad: modelo potente",
    estimatedSaving: 0
  }
];

export const budgets = [
  {
    consumer: "equipo-marketing",
    limit: 0.15,
    spent: 0.1008,
    threshold: 80
  },
  {
    consumer: "equipo-producto",
    limit: 0.35,
    spent: 0.3135,
    threshold: 80
  },
  {
    consumer: "equipo-soporte",
    limit: 0.1,
    spent: 0.0218,
    threshold: 80
  }
];

export const alerts = [
  {
    id: "ALT-001",
    type: "warning",
    consumer: "equipo-producto",
    message: "El equipo producto ha superado el 80% de su presupuesto mensual."
  },
  {
    id: "ALT-002",
    type: "blocked",
    consumer: "equipo-marketing",
    message: "Una solicitud fue bloqueada por superar el límite configurado."
  }
];

export const recommendations = [
  {
    id: "REC-001",
    title: "Usar modelo barato para prompts cortos",
    description:
      "Las solicitudes con menos de 1.500 tokens y categoría simple pueden enrutarse a Provider A.",
    saving: 0.102
  },
  {
    id: "REC-002",
    title: "Reducir tokens de entrada",
    description:
      "El equipo producto concentra la mayoría de tokens en análisis de documentos largos.",
    saving: 0.064
  },
  {
    id: "REC-003",
    title: "Aplicar caché en traducciones repetidas",
    description:
      "Varias solicitudes de traducción podrían reutilizar respuestas previas.",
    saving: 0.041
  }
];
