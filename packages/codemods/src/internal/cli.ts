import { runCodemod, type Codemod } from "../index.js";

const help = `Usage: raypx-kit-codemod list
       raypx-kit-codemod <migration> <files...> [--dry-run | --write]

Run migrations against explicit UTF-8 files. The default is --dry-run.
Use --write to apply changes. Directories, symlinks and globs are not accepted.
`;

interface CliOptions {
  cwd?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export async function runCli(
  args: readonly string[],
  codemods: readonly Codemod[],
  options: CliOptions = {},
): Promise<number> {
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;

  try {
    const [command, ...rest] = args;
    if (
      command === undefined ||
      ((command === "--help" || command === "-h") && rest.length === 0)
    ) {
      stdout(help);
      return 0;
    }
    if (command === "list") {
      if (rest.length) throw new Error("The list command does not accept arguments.");
      stdout(
        codemods.length
          ? codemods.map(({ name, description }) => `${name}\t${description}`).join("\n")
          : "No codemods are registered.",
      );
      return 0;
    }

    const codemod = codemods.find(({ name }) => name === command);
    if (!codemod) throw new Error(`Unknown migration: ${command}. Run raypx-kit-codemod list.`);
    let dryRun = false;
    let write = false;
    const files: string[] = [];
    let positional = false;
    for (const argument of rest) {
      if (!positional && argument === "--") positional = true;
      else if (!positional && argument === "--dry-run") dryRun = true;
      else if (!positional && argument === "--write") write = true;
      else if (!positional && argument.startsWith("-")) {
        throw new Error(`Unknown option: ${argument}`);
      } else files.push(argument);
    }
    if (dryRun && write) throw new Error("Choose either --dry-run or --write.");
    if (!files.length) throw new Error("Specify at least one file.");
    const result = await runCodemod(codemod, files, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      write,
    });
    stdout(`Mode: ${result.mode}`);
    for (const { path, status } of result.files) stdout(`${status}\t${path}`);
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
