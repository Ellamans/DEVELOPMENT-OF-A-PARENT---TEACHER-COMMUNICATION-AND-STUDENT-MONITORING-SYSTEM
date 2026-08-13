import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("access_token");
}

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("refresh_token");
}

export function setTokens(accessToken: string, refreshToken: string) {
  window.sessionStorage.setItem("access_token", accessToken);
  window.sessionStorage.setItem("refresh_token", refreshToken);
}

export function clearTokens() {
  window.sessionStorage.removeItem("access_token");
  window.sessionStorage.removeItem("refresh_token");
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();
      const onLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";

      if (!refreshToken) {
        clearTokens();
        // Don't hard-redirect here: this branch also fires for the routine
        // "am I logged in?" check (/auth/me) on public pages like /login,
        // where a 401 is expected, not an error. A window.location.href
        // redirect forces a full page reload, which re-mounts AuthProvider,
        // which calls /auth/me again -> 401 again -> reload again (infinite loop).
        // Let the caller (e.g. AuthProvider) just treat this as "not logged in".
        if (typeof window !== "undefined" && !onLoginPage) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(apiClient(originalRequest)));
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        setTokens(data.access_token, data.refresh_token);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
        if (typeof window !== "undefined" && !onLoginPage) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
