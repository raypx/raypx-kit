import { isUniqueViolation } from "@raypx-kit/drizzle/errors";
import { first, inserted } from "@raypx-kit/drizzle/results";

type Row = { id: string; count: number };

// Compiled under ES2022/NodeNext with types: [] and skipLibCheck: false; never executed.
export function independentEntryContract(rows: PromiseLike<Row[]>, error: unknown) {
  const nullable = first(rows);
  const required = inserted(rows, "insertRecord");
  const unique = isUniqueViolation(error, "records_id_key");

  // @ts-expect-error A promise-like row array is required.
  first();
  // @ts-expect-error A plain array does not implement the promise-like contract.
  first([{ id: "record-1", count: 1 }]);
  // @ts-expect-error The operation name is required.
  inserted(rows);
  // @ts-expect-error The operation name must be a string.
  inserted(rows, 42);
  // @ts-expect-error The constraint name is required.
  isUniqueViolation(error);
  // @ts-expect-error The constraint name must be a string.
  isUniqueViolation(error, 42);

  return { nullable, required, unique };
}

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type Contract = ReturnType<typeof independentEntryContract>;

export type NullableRowInference = Assert<Equal<Contract["nullable"], Promise<Row | null>>>;
export type RequiredRowInference = Assert<Equal<Contract["required"], Promise<Row>>>;
export type UniqueViolationInference = Assert<Equal<Contract["unique"], boolean>>;
