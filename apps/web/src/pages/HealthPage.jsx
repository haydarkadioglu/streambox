import { Activity, RefreshCw } from "lucide-react";

export function HealthPage({ health, onCheckHealth }) {
  return (
    <div className="grid single">
      <section className="panel wide">
        <h3><Activity size={18} /> API Health</h3>
        <div className="health-grid">
          <div><span>Status</span><strong data-ok={health?.ok}>{health ? (health.ok ? "Healthy" : "Problem") : "Not checked"}</strong></div>
          <div><span>HTTP</span><strong>{health?.status || "-"}</strong></div>
          <div><span>Latency</span><strong>{health?.latency === null || health?.latency === undefined ? "-" : `${health.latency}ms`}</strong></div>
          <div><span>Checked</span><strong>{health?.checkedAt || "-"}</strong></div>
        </div>
        <pre className="health-body">{JSON.stringify(health?.body || { status: "not checked" }, null, 2)}</pre>
        <button type="button" onClick={onCheckHealth}><RefreshCw size={18} /> Check Again</button>
      </section>
    </div>
  );
}

