import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Absolute base: the app is a client-routed SPA served from the site root
  // (Netlify + _redirects). A relative base ("./") breaks hard-reloads/shared
  // links on nested routes like /stays/property/$id, because the asset URLs then
  // resolve under the route path and the SPA fallback returns index.html for them.
  base: "/",
  plugins: [tailwindcss(), tsconfigPaths(), tanstackRouter(), react()],
  // Temporary: allow access through a public tunnel (e.g. trycloudflare) when
  // previewing the demo from a phone. Safe to revert.
  server: { host: true, allowedHosts: true },
});

