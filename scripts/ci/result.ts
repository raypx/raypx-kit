interface Job {
  result: string;
  outputs?: Record<string, string>;
}

/** Missing or cancelled required jobs must never become an apparently green workflow. */
export function checkResults(needs: Record<string, Job>): string[] {
  const invalid = ["browser", "artifacts", "postgres"].filter(
    (name) => !["true", "false"].includes(needs.plan?.outputs?.[name] ?? ""),
  );
  const expected = {
    plan: true,
    javascript: true,
    browser: needs.plan?.outputs?.browser === "true",
    artifacts: needs.plan?.outputs?.artifacts === "true",
    postgres: needs.plan?.outputs?.postgres === "true",
  };
  return [
    ...invalid.map((name) => `plan: invalid ${name} selection`),
    ...Object.entries(expected).flatMap(([name, required]) => {
      const result = needs[name]?.result;
      return result === "success" || (!required && result === "skipped")
        ? []
        : [`${name}: ${result ?? "missing"}`];
    }),
  ];
}

if (import.meta.main) {
  const failures = checkResults(
    JSON.parse(process.env.GITHUB_NEEDS ?? "{}") as Record<string, Job>,
  );
  if (failures.length) throw new Error(`Required CI gates did not pass: ${failures.join(", ")}`);
  console.log("Every selected CI gate passed.");
}
