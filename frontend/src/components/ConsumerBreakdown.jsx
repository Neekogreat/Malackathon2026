import { Coins } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { groupCostByConsumer, formatCurrency } from "../utils";

function ConsumerBreakdown({ requests }) {
  const data = groupCostByConsumer(requests);
  const maxCost = Math.max(...data.map((item) => item.cost), 0);

  return (
    <article className="panel">
      <PanelTitle
        icon={<Coins size={18} />}
        title="Cost by consumer"
        subtitle="Spend split by internal team"
      />

      <div className="css-bar-chart">
        {data.map((item, index) => {
          const percentage = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;

          return (
            <div className="css-bar-item" key={item.consumer}>
              <div className="css-bar-header">
                <span>{item.consumer}</span>
                <strong>{formatCurrency(item.cost)}</strong>
              </div>

              <div className="css-bar-track">
                <div
                  className={`css-bar-fill bar-color-${index % 8}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <small>{item.tokens.toLocaleString()} tokens</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default ConsumerBreakdown;