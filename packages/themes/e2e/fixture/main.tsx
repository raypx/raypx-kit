import { hydrateRoot } from "react-dom/client";
import { App } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("The Themes fixture root is missing.");
hydrateRoot(root, <App />, {
  onRecoverableError(error) {
    console.error("Theme hydration failed", error);
  },
});
