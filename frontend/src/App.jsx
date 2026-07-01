import { useMemo, useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import FiltersBar from "./components/FiltersBar";
import PromptTester from "./components/PromptTester";
import KpiCards from "./components/KpiCards";
import CostChart from "./components/CostChart";
import ConsumerBreakdown from "./components/ConsumerBreakdown";
import CategoryBreakdown from "./components/CategoryBreakdown";
import ForecastChart from "./components/ForecastChart";
import BudgetsPanel from "./components/BudgetsPanel";
import AlertsPanel from "./components/AlertsPanel";
import RecommendationsPanel from "./components/RecommendationsPanel";
import RequestsTable from "./components/RequestsTable";

import { alerts, budgets, recommendations, requests } from "./data/mockData";
import { getUniqueValues } from "./utils";

function App() {
  const [search, setSearch] = useState("");
  const [selectedConsumer, setSelectedConsumer] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const consumers = getUniqueValues(requests, "consumer");
  const providers = getUniqueValues(requests, "provider");
  const categories = getUniqueValues(requests, "promptCategory");

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        request.consumer.toLowerCase().includes(searchValue) ||
        request.provider.toLowerCase().includes(searchValue) ||
        request.model.toLowerCase().includes(searchValue) ||
        request.promptCategory.toLowerCase().includes(searchValue) ||
        request.routingReason.toLowerCase().includes(searchValue);

      const matchesConsumer =
        selectedConsumer === "all" || request.consumer === selectedConsumer;

      const matchesProvider =
        selectedProvider === "all" || request.provider === selectedProvider;

      const matchesCategory =
        selectedCategory === "all" || request.promptCategory === selectedCategory;

      return matchesSearch && matchesConsumer && matchesProvider && matchesCategory;
    });
  }, [search, selectedConsumer, selectedProvider, selectedCategory]);

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <Header />

        <FiltersBar
          search={search}
          setSearch={setSearch}
          selectedConsumer={selectedConsumer}
          setSelectedConsumer={setSelectedConsumer}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          consumers={consumers}
          providers={providers}
          categories={categories}
        />

        <PromptTester />

        <KpiCards requests={filteredRequests} />

        <section className="dashboard-grid">
          <CostChart requests={filteredRequests} />
          <ConsumerBreakdown requests={filteredRequests} />
          <CategoryBreakdown requests={filteredRequests} />
        </section>

        <section className="dashboard-grid">
          <ForecastChart requests={filteredRequests} />
        </section>

        <section className="dashboard-grid">
          <BudgetsPanel budgets={budgets} />
          <AlertsPanel alerts={alerts} />
          <RecommendationsPanel recommendations={recommendations} />
        </section>

        <RequestsTable requests={filteredRequests} />
      </main>
    </div>
  );
}

export default App;