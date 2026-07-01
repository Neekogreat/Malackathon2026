import { Coins, Gauge, PiggyBank, ShieldAlert } from "lucide-react";
import KpiCard from "./KpiCard";
import { formatCurrency, getTotalCost, getTotalSavings, getTotalTokens } from "../utils";

function KpiCards({ requests }) {
  const totalCost = getTotalCost(requests);
  const totalTokens = getTotalTokens(requests);
  const totalSavings = getTotalSavings(requests);
  const blockedRequests = requests.filter((req) => req.status === "blocked").length;

  return (
    <section className="kpi-grid">
      <KpiCard
        icon={<Coins />}
        title="Total cost"
        value={formatCurrency(totalCost)}
        detail="Estimated AI spend"
      />

      <KpiCard
        icon={<Gauge />}
        title="Total tokens"
        value={totalTokens.toLocaleString()}
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
