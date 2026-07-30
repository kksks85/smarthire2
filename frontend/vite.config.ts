import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker the backend is reachable via the compose service name; locally it's localhost.
const proxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:7000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
