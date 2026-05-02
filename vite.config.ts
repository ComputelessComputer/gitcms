/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Pick the nitro deployment preset from env so the same config works locally,
// in Docker (Fly/Railway), on Vercel, and on Netlify. Defaults to a long-lived
// node server which is what Docker-based hosts want.
const nitroPreset = process.env.NITRO_PRESET ?? "node-server";

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
    nitro({ preset: nitroPreset }),
    viteReact(),
  ],
});
