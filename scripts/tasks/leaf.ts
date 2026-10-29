import { spawn } from "node:child_process";

const [name, key] = process.argv.slice(2);
if (!name) throw new Error("Expected a task script");
if (name !== "--aggregate") {
  const args: unknown = key && process.env[key] ? JSON.parse(process.env[key]!) : [];
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string"))
    throw new Error("Invalid task arguments");
  const child = spawn(process.execPath, ["run", name, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  child.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    process.exitCode = code ?? 1;
  });
}
