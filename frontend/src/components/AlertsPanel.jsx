import { AlertTriangle } from "lucide-react";
import PanelTitle from "./PanelTitle";

function AlertsPanel({ alerts }) {
  return (
    <article className="panel">
      <PanelTitle
        icon={<AlertTriangle size={18} />}
        title="Alerts"
        subtitle="Visible governance events"
      />

      <div className="alert-list">
        {alerts.map((alert) => (
          <div className={`alert-item ${alert.type}`} key={alert.id}>
            <strong>{alert.consumer}</strong>
            <p>{alert.message}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default AlertsPanel;
