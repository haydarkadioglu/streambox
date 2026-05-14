import { Activity, FolderOpen, LogOut, RefreshCw, Shield, Upload } from "lucide-react";

const titles = {
  upload: "Upload",
  library: "Library",
  domains: "Domain Rules",
  health: "API Health",
};

export function Shell({ page, setPage, message, videoCount, onRefresh, onSignOut, children }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>StreamBox</h1>
          <span className="muted">Python HLS platform</span>
        </div>
        <nav className="nav">
          <button className={page === "upload" ? "active" : ""} onClick={() => setPage("upload")}><Upload size={18} /> Upload</button>
          <button className={page === "library" ? "active" : ""} onClick={() => setPage("library")}><FolderOpen size={18} /> Library</button>
          <button className={page === "domains" ? "active" : ""} onClick={() => setPage("domains")}><Shield size={18} /> Domains</button>
          <button className={page === "health" ? "active" : ""} onClick={() => setPage("health")}><Activity size={18} /> API Health</button>
        </nav>
        <button className="ghost" onClick={onRefresh}><RefreshCw size={18} /> Refresh</button>
        <button className="ghost" onClick={onSignOut}><LogOut size={18} /> Sign out</button>
      </aside>

      <section className="content">
        <div className="topbar">
          <div>
            <h2>{titles[page]}</h2>
            <p>{videoCount} item{videoCount === 1 ? "" : "s"} in library</p>
          </div>
          {message && <span className="message">{message}</span>}
        </div>
        {children}
      </section>
    </main>
  );
}

