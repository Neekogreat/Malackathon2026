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
import { TrendingUp } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { getForecastData, groupCostByDate } from "../utils";

function ForecastChart({ requests }) {
  const costByDate = groupCostByDate(requests);
  const forecastData = getForecastData(costByDate);

  return (
    <article className="panel wide">
      <PanelTitle
        icon={<TrendingUp size={18} />}
        title="Cost forecast"
        subtitle="Simple projection based on current average daily spend"
      />

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="realCost" name="Real daily cost ($)" strokeWidth={2} />
            <Line type="monotone" dataKey="forecastCost" name="Projected cumulative cost ($)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export default ForecastChart;
