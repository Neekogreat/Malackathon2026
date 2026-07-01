import { Brain } from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Brain size={26} />
        <div>
          <h1>AI FinOps</h1>
          <span>Proxy Dashboard</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a className="active">Cost Explorer</a>
        <a>Consumers</a>
        <a>Providers</a>
        <a>Budgets</a>
        <a>Requests</a>
        <a>Alerts</a>
      </nav>
    </aside>
  );
}

export default Sidebar;
