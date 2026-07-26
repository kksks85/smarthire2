import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sh_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !refreshing) {
      const refresh = localStorage.getItem("sh_refresh");
      if (refresh) {
        original._retry = true;
        refreshing = true;
        try {
          const { data } = await axios.post("/api/v1/auth/refresh", {
            refresh_token: refresh,
          });
          localStorage.setItem("sh_access", data.access_token);
          localStorage.setItem("sh_refresh", data.refresh_token);
          refreshing = false;
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          refreshing = false;
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
