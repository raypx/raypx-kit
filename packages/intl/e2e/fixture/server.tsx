import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./app.js";

export function render() {
  return {
    body: renderToString(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  };
}
