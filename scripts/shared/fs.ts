import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Own a fresh OS temporary directory until the callback settles, then remove it.
 * Cleanup failures reject the operation; abrupt process exit cannot run cleanup.
 */
export async function withTempDirectory<T>(
  prefix: string,
  operation: (directory: string) => T | Promise<T>,
): Promise<T> {
  if (!prefix || prefix === "." || prefix === ".." || /[/\\\0]/.test(prefix))
    throw new TypeError("Temporary directory prefix must be a non-empty filename segment");
  const directory = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

interface WriteFileAtomicOptions {
  /** Replacement permissions, subject to the process umask. Defaults to 0o600. */
  mode?: number;
  /** Cancellation before the final rename leaves the previous destination untouched. */
  signal?: AbortSignal;
}

/**
 * Write UTF-8 text or bytes to a sibling temporary file, then replace the destination.
 * Replacement uses the requested permissions, not the previous file mode.
 * Atomic visibility only: concurrent writers use last-rename-wins semantics, and
 * the parent directory is not synced for power-loss durability. Callers own paths.
 */
export async function writeFileAtomic(
  file: string,
  data: string | Uint8Array,
  options: WriteFileAtomicOptions = {},
): Promise<void> {
  const target = resolve(file);
  options.signal?.throwIfAborted();
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.write-${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, "wx", options.mode ?? 0o600);
    try {
      await handle.writeFile(data, options.signal ? { signal: options.signal } : {});
      await handle.sync();
    } finally {
      await handle.close();
    }
    options.signal?.throwIfAborted();
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
