import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/setup/",
  build: {
    outDir: path.resolve(__dirname, "../setup-dist"),
    emptyOutDir: true
  }
});