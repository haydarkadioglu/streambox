export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (window.location.port === "5173" ? "http://localhost:8000/api" : `${window.location.origin}/api`);

export const HEALTH_URL = API_BASE.replace(/\/api$/, "/health");

