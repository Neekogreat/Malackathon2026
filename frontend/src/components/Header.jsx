import { Zap } from "lucide-react";

function Header() {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Cost Explorer</p>
        <h2>AI usage and cost overview</h2>
      </div>

      <button className="primary-button">
        <Zap size={16} />
        Run live demo request
      </button>
    </header>
  );
}

export default Header;
