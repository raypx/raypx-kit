#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";

const { main } = await tsImport("../scripts/cli.ts", import.meta.url);
await main();
