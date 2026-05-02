/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  test: {
    environment: "node",
    globals: true,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
