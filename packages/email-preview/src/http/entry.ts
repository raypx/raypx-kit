import { useNitroApp } from "nitro/app";
import { toNodeHandler } from "srvx/node";
export { initializePreview, closePreview } from "#preview-runtime";

export const middleware = toNodeHandler(useNitroApp().fetch);
