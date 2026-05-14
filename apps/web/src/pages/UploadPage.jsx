import { Copy, Link, PlayCircle, Upload } from "lucide-react";

import { Player } from "../components/Player";

export function UploadPage({
  title,
  fileInputRef,
  uploadProgress,
  uploadState,
  isUploading,
  hasFile,
  selected,
  generatedLink,
  setTitle,
  onFileChange,
  onUpload,
  onGenerateLink,
  onCopyLink,
}) {
  return (
    <div className="grid">
      <section className="panel">
        <h3><Upload size={18} /> Upload</h3>
        <form onSubmit={onUpload} className="stack">
          <input placeholder="Video title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input ref={fileInputRef} type="file" accept="video/*" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
          <div className="upload-status">
            <div className="upload-status-row">
              <span>{uploadState}</span>
              <strong>{uploadProgress}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
          <button type="submit" disabled={isUploading || !hasFile || !title}>
            {isUploading ? "Uploading..." : "Upload and Encode"}
          </button>
        </form>
      </section>

      <section className="panel wide">
        <h3><PlayCircle size={18} /> Preview</h3>
        {selected?.playback_url ? <Player url={selected.playback_url} /> : <div className="empty">Select a ready video to preview.</div>}
        <div className="link-tools">
          <div className="link-field">
            <span>{generatedLink || selected?.playback_url || "No playback link yet"}</span>
          </div>
          <button type="button" onClick={onGenerateLink} disabled={selected?.status !== "ready"}>
            <Link size={18} /> Generate Link
          </button>
          <button type="button" className="secondary" onClick={onCopyLink} disabled={!generatedLink && !selected?.playback_url}>
            <Copy size={18} /> Copy
          </button>
        </div>
      </section>
    </div>
  );
}
