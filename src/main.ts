import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
// Debug helper - rekisteröi debugDumpTilastot konsoliin
import "./lib/database/debug";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
