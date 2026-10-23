import { hydrateRoot } from "react-dom/client";
import { App } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("The UI fixture root is missing.");
hydrateRoot(root, <App />, {
  onRecoverableError(error) {
    console.error("UI hydration failed", error);
  },
});
