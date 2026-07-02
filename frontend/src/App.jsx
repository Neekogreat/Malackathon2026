import { useEffect, useMemo, useState } from "react";

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


import { getUniqueValues } from "./utils";

import {
  getAlerts,
  getConsumers,
  getOverview,
  getRequests,
  mapBackendAlert,
  mapBackendConsumerToBudget,
  mapBackendRequest
} from "./services/api";

function App() {
  const [search, setSearch] = useState("");
  const [selectedConsumer, setSelectedConsumer] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [alerts, setAlerts] = useState([]);

  /**
   * Esta clave sirve para forzar que ForecastChart se refresque
   * cada vez que se envía un prompt nuevo.
   */
  const [forecastRefreshKey, setForecastRefreshKey] = useState(0);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  async function loadDashboardData() {
    try {
      setDashboardError("");

      const [overviewData, requestsData, consumersData, alertsData] =
        await Promise.all([
          getOverview(),
          getRequests(100),
          getConsumers(),
          getAlerts()
        ]);

      setOverview(overviewData);
      setRequests(requestsData.map(mapBackendRequest));
      setBudgets(consumersData.map(mapBackendConsumerToBudget));
      setAlerts(alertsData.map(mapBackendAlert));
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleRequestCompleted() {
    await loadDashboardData();

    /**
     * Esto hace que ForecastChart vuelva a llamar a:
     * GET /api/dashboard/forecast
     */
    setForecastRefreshKey((previousValue) => previousValue + 1);
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const consumers = getUniqueValues(requests, "consumer");
  const providers = getUniqueValues(requests, "provider");
  const categories = getUniqueValues(requests, "promptCategory");

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchValue = search.toLowerCase();

      const matchesSearch = [
        request.consumer,
        request.provider,
        request.model,
        request.promptCategory,
        request.routingReason
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchValue)
      );

      const matchesConsumer =
        selectedConsumer === "all" || request.consumer === selectedConsumer;

      const matchesProvider =
        selectedProvider === "all" || request.provider === selectedProvider;

      const matchesCategory =
        selectedCategory === "all" ||
        request.promptCategory === selectedCategory;

      return (
        matchesSearch &&
        matchesConsumer &&
        matchesProvider &&
        matchesCategory
      );
    });
  }, [requests, search, selectedConsumer, selectedProvider, selectedCategory]);

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

        <PromptTester onRequestCompleted={handleRequestCompleted} />

        {dashboardError && (
          <section className="panel">
            <strong>Error cargando dashboard</strong>
            <p>{dashboardError}</p>
          </section>
        )}

        {loadingDashboard ? (
          <section className="panel">
            <strong>Cargando datos reales del backend...</strong>
          </section>
        ) : (
          <>
            <KpiCards requests={filteredRequests} overview={overview} />

            <section className="dashboard-grid">
              <CostChart requests={filteredRequests} />
              <ConsumerBreakdown requests={filteredRequests} />
              <CategoryBreakdown requests={filteredRequests} />
            </section>

            <section className="dashboard-grid">
              <ForecastChart refreshKey={forecastRefreshKey} />
            </section>

            <section className="dashboard-grid">
              <BudgetsPanel budgets={budgets} />
              <AlertsPanel alerts={alerts} />
              <RecommendationsPanel refreshKey={forecastRefreshKey}/>
            </section>

            <RequestsTable requests={filteredRequests} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;