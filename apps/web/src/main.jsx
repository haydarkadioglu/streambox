import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import { Copy, Link, LogOut, PlayCircle, RefreshCw, Shield, Upload } from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

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

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [videos, setVideos] = useState([]);
  const [rules, setRules] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [domain, setDomain] = useState("");
  const [ruleType, setRuleType] = useState("allow");
  const [generatedLink, setGeneratedLink] = useState("");
  const [message, setMessage] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

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
    await request("/videos", { method: "POST", body });
    setTitle("");
    setFile(null);
    setMessage("Upload queued for encoding");
    await load();
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

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [token]);

  if (!token) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={login}>
          <h1>Stream Control</h1>
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
          <h1>Stream Control</h1>
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

        <div className="grid">
          <section className="panel">
            <h3><Upload size={18} /> Upload</h3>
            <form onSubmit={uploadVideo} className="stack">
              <input placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button type="submit">Upload and Encode</button>
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
            <h3>Library</h3>
            <div className="video-list">
              {videos.map((video) => (
                <button key={video.id} className={`video-row ${selected?.id === video.id ? "active" : ""}`} onClick={() => setSelected(video)}>
                  <span>{video.title}</span>
                  <strong data-status={video.status}>{video.status}</strong>
                </button>
              ))}
            </div>
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
