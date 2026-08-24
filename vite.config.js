import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites at https://<user>.github.io/<repo>/,
// so the build needs to know that subpath. The deploy workflow sets
// BASE_PATH automatically from the repo name — for local `npm run build`
// you generally don't need to touch this (dev server always uses "/").
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/js-resource-booking/",
});
