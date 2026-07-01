import { PiggyBank } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

function BudgetsPanel({ budgets }) {
  return (
    <article className="panel">
      <PanelTitle
        icon={<PiggyBank size={18} />}
        title="Budgets"
        subtitle="Per-consumer limits"
      />

      <div className="budget-list">
        {budgets.map((budget) => {
          const percentage = Math.round((budget.spent / budget.limit) * 100);

          return (
            <div className="budget-item" key={budget.consumer}>
              <div className="budget-header">
                <strong>{budget.consumer}</strong>
                <span>
                  {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                </span>
              </div>

              <div className="progress">
                <div
                  className={percentage >= budget.threshold ? "progress-fill danger" : "progress-fill"}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <small>{percentage}% used</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default BudgetsPanel;
