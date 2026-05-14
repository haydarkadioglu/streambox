import { RotateCw, Save, Search, Trash2 } from "lucide-react";

export function LibraryPage({
  search,
  filteredVideos,
  selected,
  editTitle,
  editPublic,
  setSearch,
  setSelected,
  setGeneratedLink,
  setEditTitle,
  setEditPublic,
  onSave,
  onReencode,
  onDelete,
}) {
  return (
    <div className="grid">
      <section className="panel">
        <h3><Search size={18} /> Library</h3>
        <input className="search-input" placeholder="Search videos" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="video-list">
          {filteredVideos.map((video) => (
            <button key={video.id} className={`video-row ${selected?.id === video.id ? "active" : ""}`} onClick={() => { setSelected(video); setGeneratedLink(""); }}>
              <span>
                <b>{video.title}</b>
                <small>{video.original_filename}</small>
              </span>
              <strong data-status={video.status}>{video.status}</strong>
            </button>
          ))}
          {!filteredVideos.length && <div className="empty small">No videos found.</div>}
        </div>
      </section>

      <section className="panel wide">
        <h3>Manage Selected Video</h3>
        {selected ? (
          <div className="manage-grid">
            <label>Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></label>
            <label className="toggle-row">
              <input type="checkbox" checked={editPublic} onChange={(event) => setEditPublic(event.target.checked)} />
              Public
            </label>
            <dl className="details-list">
              <div><dt>Status</dt><dd data-status={selected.status}>{selected.status}</dd></div>
              <div><dt>Original</dt><dd>{selected.original_filename}</dd></div>
              <div><dt>Duration</dt><dd>{selected.duration_seconds ? `${selected.duration_seconds}s` : "Unknown"}</dd></div>
              <div><dt>Resolution</dt><dd>{selected.width && selected.height ? `${selected.width}x${selected.height}` : "Unknown"}</dd></div>
            </dl>
            {selected.error_message && <div className="error-box">{selected.error_message}</div>}
            <div className="actions">
              <button type="button" onClick={onSave}><Save size={18} /> Save</button>
              <button type="button" className="secondary" onClick={onReencode}><RotateCw size={18} /> Re-encode</button>
              <button type="button" className="danger" onClick={onDelete}><Trash2 size={18} /> Delete</button>
            </div>
          </div>
        ) : (
          <div className="empty small">Select a video to manage it.</div>
        )}
      </section>
    </div>
  );
}

