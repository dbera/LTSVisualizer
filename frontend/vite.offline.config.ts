import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",

  // Do not copy frontend/public into the offline build.
  publicDir: false,

  plugins: [
    react(),

    // Remove the external favicon reference only from the offline build.
    {
      name: "remove-offline-favicon",
      transformIndexHtml(html) {
        return html.replace(
          /\s*<link[^>]+href=["'][^"']*favicon\.svg["'][^>]*>/i,
          "",
        );
      },
    },

    viteSingleFile(),
  ],

  build: {
    outDir: "dist-offline",
    emptyOutDir: true,
  },
});
