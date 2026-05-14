import { useEffect, useMemo, useRef, useState } from "react";

import { LoginPage } from "./components/LoginPage";
import { Shell } from "./components/Shell";
import { Stats } from "./components/Stats";
import { createAuthedRequest, healthRequest, loginRequest, uploadVideoRequest } from "./lib/api";
import { filterVideos, titleFromFilename, videoStats } from "./lib/video";
import { DomainsPage } from "./pages/DomainsPage";
import { HealthPage } from "./pages/HealthPage";
import { LibraryPage } from "./pages/LibraryPage";
import { UploadPage } from "./pages/UploadPage";

export function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [videos, setVideos] = useState([]);
  const [rules, setRules] = useState([]);
  const [page, setPage] = useState("upload");
  const [title, setTitle] = useState("");
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
  const [health, setHealth] = useState(null);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const signOut = () => {
    localStorage.removeItem("token");
    setToken("");
  };
  const request = useMemo(() => createAuthedRequest(token, signOut), [token]);
  const stats = useMemo(() => videoStats(videos), [videos]);
  const filteredVideos = useMemo(() => filterVideos(videos, search), [videos, search]);

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

  async function login(event) {
    event.preventDefault();
    try {
      const data = await loginRequest(email, password);
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setMessage("Signed in");
    } catch (error) {
      setMessage(error.message);
    }
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
      const uploaded = await uploadVideoRequest({
        token,
        body,
        onUnauthorized: signOut,
        onProgress: (percent) => {
          if (percent === null) {
            setUploadState("Uploading");
            return;
          }
          setUploadProgress(percent);
          setUploadState(percent >= 100 ? "Finalizing upload" : "Uploading");
        },
      });
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

  function handleFileChange(nextFile) {
    setFile(nextFile);
    setUploadProgress(0);
    setUploadState(nextFile ? "Ready to upload" : "Idle");
    if (nextFile) setTitle(titleFromFilename(nextFile.name));
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
    if (!selected || !window.confirm(`Delete "${selected.title}" and its encoded files?`)) return;
    await request(`/videos/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    setGeneratedLink("");
    setMessage("Video deleted");
    await load();
  }

  async function checkHealth() {
    setHealth(await healthRequest());
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    if (page === "health") checkHealth();
  }, [page]);

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

  useEffect(() => {
    if (!isUploading) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isUploading]);

  if (!token) {
    return (
      <LoginPage
        email={email}
        password={password}
        message={message}
        setEmail={setEmail}
        setPassword={setPassword}
        onLogin={login}
      />
    );
  }

  return (
    <Shell page={page} setPage={setPage} message={message} videoCount={videos.length} onRefresh={load} onSignOut={signOut}>
      <Stats stats={stats} />
      {page === "upload" && (
        <UploadPage
          title={title}
          fileInputRef={fileInputRef}
          uploadProgress={uploadProgress}
          uploadState={uploadState}
          isUploading={isUploading}
          hasFile={Boolean(file)}
          selected={selected}
          generatedLink={generatedLink}
          setTitle={setTitle}
          onFileChange={handleFileChange}
          onUpload={uploadVideo}
          onGenerateLink={generateLink}
          onCopyLink={copyCurrentLink}
        />
      )}
      {page === "library" && (
        <LibraryPage
          search={search}
          filteredVideos={filteredVideos}
          selected={selected}
          editTitle={editTitle}
          editPublic={editPublic}
          setSearch={setSearch}
          setSelected={setSelected}
          setGeneratedLink={setGeneratedLink}
          setEditTitle={setEditTitle}
          setEditPublic={setEditPublic}
          onSave={saveVideoDetails}
          onReencode={reencodeSelected}
          onDelete={deleteSelected}
        />
      )}
      {page === "domains" && (
        <DomainsPage
          domain={domain}
          ruleType={ruleType}
          rules={rules}
          setDomain={setDomain}
          setRuleType={setRuleType}
          onAddRule={addRule}
          onDeleteRule={deleteRule}
        />
      )}
      {page === "health" && <HealthPage health={health} onCheckHealth={checkHealth} />}
    </Shell>
  );
}
