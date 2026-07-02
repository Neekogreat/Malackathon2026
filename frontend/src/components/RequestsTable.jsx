import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

function RequestsTable({ requests }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="panel audit-panel">
      <button
        type="button"
        className="audit-toggle"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <div className="audit-toggle-title">
          <PanelTitle
            icon={<Layers size={18} />}
            title="Audit log"
            subtitle={`${requests.length} AI requests intercepted by the proxy`}
          />
        </div>

        <div className="audit-toggle-action">
          <span>{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {isOpen && (
        <div className="table-wrapper audit-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Date</th>
                <th>Consumer</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Category</th>
                <th>Input tokens</th>
                <th>Output tokens</th>
                <th>Total tokens</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Routing reason</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.id}</td>
                  <td>{req.date}</td>
                  <td>{req.consumer}</td>
                  <td>{req.provider}</td>
                  <td>{req.model}</td>
                  <td>
                    <span className="pill">{req.promptCategory}</span>
                  </td>
                  <td>{req.inputTokens.toLocaleString()}</td>
                  <td>{req.outputTokens.toLocaleString()}</td>
                  <td>{req.totalTokens.toLocaleString()}</td>
                  <td>{formatCurrency(req.cost)}</td>
                  <td>
                    <span className={`status ${req.status}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>{req.routingReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RequestsTable;