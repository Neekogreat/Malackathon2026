import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function ForecastChart({refreshKey}) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadForecast() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/dashboard/forecast?lookbackDays=14&horizonDays=30`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Error cargando forecast");
      }

      setForecast(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForecast();
  }, [refreshKey]);

  if (loading) {
    return (
      <article className="panel wide">
        <PanelTitle
          icon={<TrendingUp size={18} />}
          title="Real cost forecast"
          subtitle="Loading MongoDB-based projection"
        />
        <p>Cargando forecast real...</p>
      </article>
    );
  }

  if (error) {
    return (
      <article className="panel wide">
        <PanelTitle
          icon={<AlertTriangle size={18} />}
          title="Real cost forecast"
          subtitle="Could not load forecast"
        />
        <p>{error}</p>
      </article>
    );
  }

  return (
    <article className="panel wide">
      <PanelTitle
        icon={<TrendingUp size={18} />}
        title="Real cost forecast"
        subtitle="Weighted trend projection calculated from ai_requests in MongoDB"
      />

      <div className="result-grid">
        <div className="result-card">
          <span>Method</span>
          <strong>{forecast.method}</strong>
        </div>

        <div className="result-card">
          <span>Weighted daily avg</span>
          <strong>{formatCurrency(forecast.weighted_daily_average)}</strong>
        </div>

        <div className="result-card">
          <span>Trend factor</span>
          <strong>
            ×{Number(forecast.trend_factor || 1).toFixed(2)} ·{" "}
            {forecast.trend_direction}
          </strong>
        </div>

        <div className="result-card">
          <span>30-day forecast</span>
          <strong>{formatCurrency(forecast.forecast_additional_spend)}</strong>
        </div>

        <div className="result-card">
          <span>Projected cache savings</span>
          <strong>{formatCurrency(forecast.projected_cache_savings)}</strong>
        </div>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={forecast.chart_data || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulative_real_cost"
              name="Real cumulative cost ($)"
              strokeWidth={2}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast_cost"
              name="Projected cumulative cost ($)"
              strokeWidth={2}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: "1rem", overflowX: "auto" }}>
        <table className="requests-table">
          <thead>
            <tr>
              <th>Consumer</th>
              <th>Current budget spend</th>
              <th>Budget</th>
              <th>Projected budget spend</th>
              <th>Budget %</th>
              <th>Days to exceed</th>
              <th>Cache savings</th>
              <th>Confidence</th>
              <th>Risk</th>
            </tr>
          </thead>

          <tbody>
            {(forecast.consumer_forecast || []).map((item) => (
              <tr key={item.consumer_id}>
                <td>{item.consumer_id}</td>
                <td>{formatCurrency(item.current_budget_spend)}</td>
                <td>{formatCurrency(item.budget_limit)}</td>
                <td>{formatCurrency(item.projected_budget_spend)}</td>
                <td>{formatPercent(item.forecast_budget_percentage)}</td>
                <td>
                  {item.days_until_budget_exceeded === null
                    ? "-"
                    : item.days_until_budget_exceeded}
                </td>
                <td>{formatCurrency(item.projected_cache_savings)}</td>
                <td>{item.confidence}</td>
                <td>
                  {item.will_exceed_budget ? "Budget risk" : "Under control"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "1rem" }}>
        Formula: {forecast.explanation?.formula}
      </p>

      <button
        className="primary-button"
        onClick={loadForecast}
        style={{ marginTop: "1rem" }}
      >
        Refresh forecast
      </button>
    </article>
  );
}

export default ForecastChart;