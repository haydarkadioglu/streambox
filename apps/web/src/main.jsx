import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import {
  Copy,
  Link,
  LogOut,
  PlayCircle,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import "./styles.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (window.location.port === "5173" ? "http://localhost:8000/api" : `${window.location.origin}/api`);

function Player({ url }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [url]);

  return <video ref={videoRef} controls className="player" />;
}

function titleFromFilename(name) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [videos, setVideos] = useState([]);
  const [rules, setRules] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState("Idle");
  const [isUploading, setIsUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [domain, setDomain] = useState("");
  const [ruleType, setRuleType] = useState("allow");
  const [generatedLink, setGeneratedLink] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const stats = useMemo(
    () => ({
      total: videos.length,
      ready: videos.filter((video) => video.status === "ready").length,
      processing: videos.filter((video) => ["uploaded", "processing"].includes(video.status)).length,
      failed: videos.filter((video) => video.status === "failed").length,
    }),
    [videos],
  );
  const filteredVideos = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return videos;
    return videos.filter((video) =>
      [video.title, video.original_filename, video.status].some((value) =>
        String(value || "").toLowerCase().includes(needle),
      ),
    );
  }, [search, videos]);

  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed");
    if (res.status === 204) return null;
    return res.json();
  }

  async function login(event) {
    event.preventDefault();
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      setMessage("Login failed");
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
    setMessage("Signed in");
  }

  async function load() {
    if (!token) return;
    const [videoData, ruleData] = await Promise.all([request("/videos"), request("/domains")]);
    setVideos(videoData.items);
    setRules(ruleData);
    setSelected((current) => {
      if (!current) return videoData.items[0] || null;
      return videoData.items.find((video) => video.id === current.id) || videoData.items[0] || null;
    });
  }

  async function uploadVideo(event) {
    event.preventDefault();
    if (!file || !title) return;
    const body = new FormData();
    body.set("title", title);
    body.set("file", file);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadState("Preparing upload");

    try {
      const uploaded = await uploadWithProgress(body);
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadProgress(100);
      setUploadState(uploaded.status === "ready" ? "Ready" : "Encoding queued");
      setMessage("Upload received. Encoding status is visible in the library.");
      await load();
    } catch (error) {
      setUploadState("Failed");
      setMessage(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  function uploadWithProgress(body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/videos`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          setUploadState("Uploading");
          return;
        }
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
        setUploadState(percent >= 100 ? "Finalizing upload" : "Uploading");
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.detail || "Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error while uploading"));
      xhr.send(body);
    });
  }

  function handleFileChange(nextFile) {
    setFile(nextFile);
    setUploadProgress(0);
    setUploadState(nextFile ? "Ready to upload" : "Idle");
    if (nextFile) {
      setTitle(titleFromFilename(nextFile.name));
    }
  }

  async function addRule(event) {
    event.preventDefault();
    if (!domain) return;
    await request("/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, rule_type: ruleType }),
    });
    setDomain("");
    await load();
  }

  async function deleteRule(id) {
    await request(`/domains/${id}`, { method: "DELETE" });
    await load();
  }

  async function generateLink() {
    if (!selected) return;
    const data = await request(`/videos/${selected.id}/playback-link`, { method: "POST" });
    setGeneratedLink(data.playback_url);
    await navigator.clipboard.writeText(data.playback_url);
    setMessage(`Playback link copied. Expires in ${data.expires_in_seconds} seconds.`);
  }

  async function copyCurrentLink() {
    const link = generatedLink || selected?.playback_url;
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setMessage("Playback link copied");
  }

  async function saveVideoDetails() {
    if (!selected) return;
    const updated = await request(`/videos/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, is_public: editPublic }),
    });
    setSelected(updated);
    setGeneratedLink("");
    setMessage("Video details saved");
    await load();
  }

  async function reencodeSelected() {
    if (!selected) return;
    const updated = await request(`/videos/${selected.id}/reencode`, { method: "POST" });
    setSelected(updated);
    setGeneratedLink("");
    setMessage("Re-encode queued");
    await load();
  }

  async function deleteSelected() {
    if (!selected) return;
    const ok = window.confirm(`Delete "${selected.title}" and its encoded files?`);
    if (!ok) return;
    await request(`/videos/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    setGeneratedLink("");
    setMessage("Video deleted");
    await load();
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    setEditTitle(selected?.title || "");
    setEditPublic(Boolean(selected?.is_public));
  }, [selected?.id, selected?.title, selected?.is_public]);

  useEffect(() => {
    const hasActiveVideo = videos.some((video) => ["uploaded", "processing"].includes(video.status));
    if (!token || (!isUploading && !hasActiveVideo)) return undefined;
    const interval = window.setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [token, isUploading, videos]);

  if (!token) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={login}>
          <h1>StreamBox</h1>
          <p>Manage uploads, encoding, playback links, and domain access.</p>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button type="submit">Sign in</button>
          {message && <span className="message">{message}</span>}
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>StreamBox</h1>
          <span className="muted">Python HLS platform</span>
        </div>
        <button className="ghost" onClick={() => load()}><RefreshCw size={18} /> Refresh</button>
        <button className="ghost" onClick={() => { localStorage.removeItem("token"); setToken(""); }}><LogOut size={18} /> Sign out</button>
      </aside>

      <section className="content">
        <div className="topbar">
          <div>
            <h2>Videos</h2>
            <p>{videos.length} item{videos.length === 1 ? "" : "s"} in library</p>
          </div>
          {message && <span className="message">{message}</span>}
        </div>

        <section className="stats">
          <div><strong>{stats.total}</strong><span>Total</span></div>
          <div><strong>{stats.ready}</strong><span>Ready</span></div>
          <div><strong>{stats.processing}</strong><span>Processing</span></div>
          <div><strong>{stats.failed}</strong><span>Failed</span></div>
        </section>

        <div className="grid">
          <section className="panel">
            <h3><Upload size={18} /> Upload</h3>
            <form onSubmit={uploadVideo} className="stack">
              <input placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input ref={fileInputRef} type="file" accept="video/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
              <div className="upload-status">
                <div className="upload-status-row">
                  <span>{uploadState}</span>
                  <strong>{uploadProgress}%</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
              <button type="submit" disabled={isUploading || !file || !title}>
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
              <button type="button" onClick={generateLink} disabled={selected?.status !== "ready"}>
                <Link size={18} /> Generate Link
              </button>
              <button type="button" className="secondary" onClick={copyCurrentLink} disabled={!generatedLink && !selected?.playback_url}>
                <Copy size={18} /> Copy
              </button>
            </div>
          </section>

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
                  <button type="button" onClick={saveVideoDetails}><Save size={18} /> Save</button>
                  <button type="button" className="secondary" onClick={reencodeSelected}><RotateCw size={18} /> Re-encode</button>
                  <button type="button" className="danger" onClick={deleteSelected}><Trash2 size={18} /> Delete</button>
                </div>
              </div>
            ) : (
              <div className="empty small">Select a video to manage it.</div>
            )}
          </section>

          <section className="panel wide">
            <h3><Shield size={18} /> Domain Rules</h3>
            <form onSubmit={addRule} className="domain-form">
              <input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
                <option value="allow">Allow</option>
                <option value="block">Block</option>
              </select>
              <button type="submit">Save Rule</button>
            </form>
            <div className="rules">
              {rules.map((rule) => (
                <span key={rule.id} className={`rule ${rule.rule_type}`}>
                  {rule.rule_type}: {rule.domain}
                  <button onClick={() => deleteRule(rule.id)}>x</button>
                </span>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
