import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function getSeverityIcon(severity) {
  if (severity === "critical" || severity === "warning") {
    return <AlertTriangle size={16} />;
  }

  if (severity === "success") {
    return <CheckCircle size={16} />;
  }

  return <Info size={16} />;
}

function RecommendationsPanel() {
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecommendations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/recommendations?lookbackDays=14`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Error cargando recomendaciones"
        );
      }

      setRecommendationsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecommendations();
  }, []);

  if (loading) {
    return (
      <article className="panel">
        <PanelTitle
          icon={<Zap size={18} />}
          title="Cost recommendations"
          subtitle="Loading real recommendations"
        />
        <p>Cargando recomendaciones...</p>
      </article>
    );
  }

  if (error) {
    return (
      <article className="panel">
        <PanelTitle
          icon={<AlertTriangle size={18} />}
          title="Cost recommendations"
          subtitle="Could not load recommendations"
        />
        <p>{error}</p>
      </article>
    );
  }

  const recommendations = recommendationsData?.recommendations || [];

  return (
    <article className="panel">
      <PanelTitle
        icon={<Zap size={18} />}
        title="Cost recommendations"
        subtitle="Rules generated from real MongoDB usage"
      />

      <div className="result-grid">
        <div className="result-card">
          <span>Total estimated saving</span>
          <strong>
            {formatCurrency(recommendationsData?.total_estimated_saving)}
          </strong>
        </div>

        <div className="result-card">
          <span>Cache hit rate</span>
          <strong>
            {Number(
              (recommendationsData?.summary?.cache_hit_rate || 0) * 100
            ).toFixed(2)}
            %
          </strong>
        </div>
      </div>

      <div className="recommendation-list">
        {recommendations.map((rec) => (
          <div className="recommendation-item" key={rec.id}>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center"
              }}
            >
              {getSeverityIcon(rec.severity)}
              <strong>{rec.title}</strong>
            </div>

            <p>{rec.description}</p>

            <span>
              Potential saving: {formatCurrency(rec.saving)}
            </span>

            {rec.action && (
              <p style={{ marginTop: "0.5rem" }}>
                Action: {rec.action}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        className="primary-button"
        onClick={loadRecommendations}
        style={{ marginTop: "1rem" }}
      >
        Refresh recommendations
      </button>
    </article>
  );
}

export default RecommendationsPanel;