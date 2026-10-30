import { runTaskLeaf } from "../../packages/devkit/src/tasks.js";
process.exitCode = await runTaskLeaf({ runtime: process.execPath });
