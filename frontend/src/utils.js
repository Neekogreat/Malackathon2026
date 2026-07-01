export function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

export function getTotalCost(data) {
  return data.reduce((acc, req) => acc + req.cost, 0);
}

export function getTotalTokens(data) {
  return data.reduce((acc, req) => acc + req.totalTokens, 0);
}

export function getTotalSavings(data) {
  return data.reduce((acc, req) => acc + req.estimatedSaving, 0);
}

export function groupCostByDate(data) {
  const grouped = {};

  data.forEach((req) => {
    if (!grouped[req.date]) {
      grouped[req.date] = {
        date: req.date,
        cost: 0,
        tokens: 0
      };
    }

    grouped[req.date].cost += req.cost;
    grouped[req.date].tokens += req.totalTokens;
  });

  return Object.values(grouped);
}

export function groupCostByConsumer(data) {
  const grouped = {};

  data.forEach((req) => {
    if (!grouped[req.consumer]) {
      grouped[req.consumer] = {
        consumer: req.consumer,
        cost: 0,
        tokens: 0
      };
    }

    grouped[req.consumer].cost += req.cost;
    grouped[req.consumer].tokens += req.totalTokens;
  });

  return Object.values(grouped);
}

export function groupTokensByCategory(data) {
  const grouped = {};

  data.forEach((req) => {
    if (!grouped[req.promptCategory]) {
      grouped[req.promptCategory] = {
        category: req.promptCategory,
        tokens: 0
      };
    }

    grouped[req.promptCategory].tokens += req.totalTokens;
  });

  return Object.values(grouped);
}

export function getUniqueValues(data, field) {
  return [...new Set(data.map((item) => item[field]))];
}

export function getForecastData(costByDate) {
  const total = costByDate.reduce((acc, item) => acc + item.cost, 0);
  const avg = costByDate.length > 0 ? total / costByDate.length : 0;

  return costByDate.map((item, index) => ({
    date: item.date,
    realCost: item.cost,
    forecastCost: Number((avg * (index + 1)).toFixed(4))
  }));
}
