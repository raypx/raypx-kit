import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("The fixture root is missing");
document.documentElement.dataset.ssrLocale =
  root.querySelector('[data-testid="locale"]')?.textContent ?? "";
document.documentElement.dataset.hydrationErrors = "[]";
hydrateRoot(
  root,
  <StrictMode>
    <App />
  </StrictMode>,
  {
    onRecoverableError(error) {
      const errors: string[] = JSON.parse(document.documentElement.dataset.hydrationErrors ?? "[]");
      errors.push(error instanceof Error ? error.message : String(error));
      document.documentElement.dataset.hydrationErrors = JSON.stringify(errors);
    },
  },
);
