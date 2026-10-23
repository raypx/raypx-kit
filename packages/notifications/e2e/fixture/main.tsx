import { hydrateRoot } from "react-dom/client";
import { App } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("The notifications fixture root is missing.");
hydrateRoot(root, <App />, {
  onRecoverableError(error) {
    console.error("Notifications hydration failed", error);
  },
});
