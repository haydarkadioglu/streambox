import { API_BASE, HEALTH_URL } from "./config";

export function createAuthedRequest(token, onUnauthorized) {
  return async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed");
    if (res.status === 204) return null;
    return res.json();
  };
}

export async function loginRequest(email, password) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export function uploadVideoRequest({ token, body, onProgress, onUnauthorized }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/videos`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress(null);
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status === 401) {
        onUnauthorized();
        reject(new Error("Session expired. Please sign in again."));
      } else if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.detail || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(body);
  });
}

export async function healthRequest() {
  const started = performance.now();
  try {
    const res = await fetch(HEALTH_URL);
    const body = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      body,
      latency: Math.round(performance.now() - started),
      checkedAt: new Date().toLocaleTimeString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: "offline",
      body: { error: error.message },
      latency: null,
      checkedAt: new Date().toLocaleTimeString(),
    };
  }
}

