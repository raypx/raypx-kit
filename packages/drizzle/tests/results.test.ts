import { describe, expect, it } from "vite-plus/test";
import { first, inserted } from "../src/results.js";

type Row = { id: string };
const unwrappers: Record<string, (rows: PromiseLike<Row[]>) => Promise<Row | null>> = {
  first,
  inserted: (rows) => inserted(rows, "Insert"),
};

describe("query result unwrapping", () => {
  it("keeps an absent nullable result distinct from a required write result", async () => {
    expect(await first(Promise.resolve([]))).toBeNull();
    await expect(inserted(Promise.resolve([]), "Insert record")).rejects.toThrow(
      "Insert record did not return a row.",
    );
  });
  it("propagates query failures unchanged", async () => {
    const error = new Error("Database operation failed");
    await expect(first(Promise.reject(error))).rejects.toBe(error);
  });

  it.each(Object.entries(unwrappers))(
    "%s consumes a lazy PromiseLike once with its original receiver",
    async (_name, unwrap) => {
      const row = { id: "first" };
      let executions = 0;
      const query = {
        rows: [row],
        // oxlint-disable-next-line unicorn/no-thenable -- Exercise the public PromiseLike contract.
        then<Fulfilled = Row[], Rejected = never>(
          onfulfilled?: ((rows: Row[]) => Fulfilled | PromiseLike<Fulfilled>) | null,
          onrejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
        ): Promise<Fulfilled | Rejected> {
          expect(this).toBe(query);
          executions += 1;
          return Promise.resolve(this.rows).then(onfulfilled, onrejected);
        },
      } satisfies PromiseLike<Row[]> & { rows: Row[] };

      expect(executions).toBe(0);
      expect(await unwrap(query)).toBe(row);
      expect(executions).toBe(1);
    },
  );

  it("keeps a rejected driver's non-Error reason intact for required results", async () => {
    const sentinel = Object.freeze({ code: "23505", constraint_name: "records_id_key" });
    const query: PromiseLike<Row[]> = {
      // oxlint-disable-next-line unicorn/no-thenable -- Exercise a rejected query thenable.
      then(onfulfilled, onrejected) {
        return Promise.reject<Row[]>(sentinel).then(onfulfilled, onrejected);
      },
    };
    await expect(inserted(query, "Insert")).rejects.toBe(sentinel);
  });

  it.each(Object.entries(unwrappers))(
    "%s preserves frozen rows and their containing array",
    async (_name, unwrap) => {
      const row = Object.freeze({ id: "first" });
      const second = Object.freeze({ id: "second" });
      const rows = [row, second];
      Object.freeze(rows);

      expect(await unwrap(Promise.resolve(rows))).toBe(row);
      expect(rows).toEqual([{ id: "first" }, { id: "second" }]);
      expect(rows[0]).toBe(row);
      expect(rows[1]).toBe(second);
    },
  );
});
