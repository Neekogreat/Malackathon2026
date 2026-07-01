import { Zap } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

function RecommendationsPanel({ recommendations }) {
  return (
    <article className="panel">
      <PanelTitle
        icon={<Zap size={18} />}
        title="Cost recommendations"
        subtitle="Rules used to save money"
      />

      <div className="recommendation-list">
        {recommendations.map((rec) => (
          <div className="recommendation-item" key={rec.id}>
            <strong>{rec.title}</strong>
            <p>{rec.description}</p>
            <span>Potential saving: {formatCurrency(rec.saving)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default RecommendationsPanel;
