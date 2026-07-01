import { Brain } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { groupTokensByCategory } from "../utils";

const CATEGORY_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#4f46e5"
];

function buildConicGradient(data, totalTokens) {
  let currentPercentage = 0;

  const segments = data.map((item, index) => {
    const percentage = totalTokens > 0 ? (item.tokens / totalTokens) * 100 : 0;
    const start = currentPercentage;
    const end = currentPercentage + percentage;

    currentPercentage = end;

    return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function CategoryBreakdown({ requests }) {
  const rawData = groupTokensByCategory(requests);

  const data = rawData.map((item, index) => ({
    ...item,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
  }));

  const totalTokens = data.reduce((acc, item) => acc + item.tokens, 0);

  const donutBackground = buildConicGradient(data, totalTokens);

  return (
    <article className="panel">
      <PanelTitle
        icon={<Brain size={18} />}
        title="Tokens by category"
        subtitle="Future LLM-based prompt classification"
      />

      <div className="css-donut-layout">
        <div
          className="css-donut"
          style={{
            background: donutBackground
          }}
        >
          <div className="css-donut-hole">
            <strong>{totalTokens.toLocaleString()}</strong>
            <span>tokens</span>
          </div>
        </div>
      </div>

      <div className="custom-legend">
        {data.map((item) => {
          const percentage =
            totalTokens > 0
              ? Math.round((item.tokens / totalTokens) * 100)
              : 0;

          return (
            <div className="legend-item" key={item.category}>
              <span
                className="legend-color"
                style={{ backgroundColor: item.color }}
              />

              <div className="legend-text">
                <strong>{item.category}</strong>
                <small>
                  {item.tokens.toLocaleString()} tokens · {percentage}%
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default CategoryBreakdown;