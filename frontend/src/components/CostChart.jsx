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
import { Layers } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { groupCostByDate } from "../utils";

function CostChart({ requests }) {
  const costByDate = groupCostByDate(requests);

  return (
    <article className="panel wide">
      <PanelTitle
        icon={<Layers size={18} />}
        title="Cost and token usage over time"
        subtitle="Daily usage and estimated cost"
      />

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={costByDate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cost" name="Cost ($)" strokeWidth={2} />
            <Line type="monotone" dataKey="tokens" name="Tokens" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export default CostChart;
