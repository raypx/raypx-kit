import { closePreview as closeRuntime } from "../server/runtime.js";
import { closeEventStreams } from "./handlers.js";

// This private entry is compiled once and shared by the Start SSR bundle and
// Nitro's middleware entry. Bundling it twice would split the initialized state.
export { initializePreview } from "../server/runtime.js";
export { eventsResponse, previewResponse, staticResponse, templatesResponse } from "./handlers.js";

export async function closePreview() {
  closeEventStreams();
  await closeRuntime();
}
