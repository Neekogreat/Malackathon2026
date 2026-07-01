import { Coins, Gauge, PiggyBank, ShieldAlert } from "lucide-react";
import KpiCard from "./KpiCard";
import {
  formatCurrency,
  getTotalCost,
  getTotalSavings,
  getTotalTokens
} from "../utils";

function KpiCards({ requests, overview }) {
  const totalCost = overview?.total_spend ?? getTotalCost(requests);
  const totalTokens = overview?.total_tokens ?? getTotalTokens(requests);
  const totalSavings = getTotalSavings(requests);
  const blockedRequests =
    overview?.blocked_requests ??
    requests.filter((req) => req.status === "blocked").length;

  return (
    <section className="kpi-grid">
      <KpiCard
        icon={<Coins />}
        title="Total cost"
        value={formatCurrency(totalCost)}
        detail="Real AI spend"
      />

      <KpiCard
        icon={<Gauge />}
        title="Total tokens"
        value={Number(totalTokens || 0).toLocaleString()}
        detail="Input + output tokens"
      />

      <KpiCard
        icon={<PiggyBank />}
        title="Estimated savings"
        value={formatCurrency(totalSavings)}
        detail="Routing optimizations"
      />

      <KpiCard
        icon={<ShieldAlert />}
        title="Blocked requests"
        value={blockedRequests}
        detail="Budget enforcement"
      />
    </section>
  );
}

export default KpiCards;