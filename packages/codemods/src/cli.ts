#!/usr/bin/env node
import { runCli } from "./internal/cli.js";
import { codemods } from "./migrations/index.js";

process.exitCode = await runCli(process.argv.slice(2), codemods);
