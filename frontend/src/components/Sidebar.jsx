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
    </aside>
  );
}

export default Sidebar;