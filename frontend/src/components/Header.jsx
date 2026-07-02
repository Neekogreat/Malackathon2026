import { Brain } from "lucide-react";

function Header() {
  return (
    <header className="topbar">
      <div className="header-brand">
        <div className="header-logo">
          <Brain size={28} />
        </div>

        <div>
          <h1>AI FinOps</h1>
          <span>Proxy Dashboard</span>
        </div>
      </div>

      <div className="header-title">
        <p className="eyebrow">Cost Explorer</p>
        <h2>AI usage and cost overview</h2>
      </div>
    </header>
  );
}

export default Header;