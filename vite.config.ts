import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(), // <-- Must come after Tailwind
  ],
  define: {
    __PROJECT_PATH__: `"${process.cwd()}/"`,
  },
});
