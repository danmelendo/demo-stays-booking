import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Relative base so it works when served from an FTP folder/subpath.
  base: "./",
  plugins: [tailwindcss(), tsconfigPaths(), tanstackRouter(), react()],
});

