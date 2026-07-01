import { Layers } from "lucide-react";
import PanelTitle from "./PanelTitle";
import { formatCurrency } from "../utils";

function RequestsTable({ requests }) {
  return (
    <section className="panel">
      <PanelTitle
        icon={<Layers size={18} />}
        title="Audit log"
        subtitle="Every AI request intercepted by the proxy"
      />

      <div className="table-wrapper">
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
    </section>
  );
}

export default RequestsTable;
