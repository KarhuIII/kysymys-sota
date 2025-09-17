import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
// Debug helper - rekisteröi debugDumpTilastot konsoliin
import "./lib/database/debug";

// Locator dev UI: use Vite's dev flag and dynamic import so Locator is loaded only in dev
if (import.meta.env.DEV) {
  (async () => {
    try {
      const mod = await import("@locator/runtime");
      const setupLocatorUI = (mod && (mod.default || mod)) as any;
      if (typeof setupLocatorUI === "function") {
        // @ts-ignore - __PROJECT_PATH__ injected by Vite define
        setupLocatorUI({ adapter: "svelte", projectPath: __PROJECT_PATH__ });
      }
    } catch (err) {
      // If developer hasn't installed @locator/runtime, ignore silently in dev
      // so local development doesn't crash.
      // Optionally log for visibility:
      // console.warn('Locator not available:', err);
    }
  })();
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
