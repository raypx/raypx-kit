/** Reject local runs before Vitest loads any database test suite. */
export default function setup() {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("Drizzle integration tests run only in GitHub Actions.");
  if (!process.env.DRIZZLE_TEST_DATABASE_URL?.trim())
    throw new Error("DRIZZLE_TEST_DATABASE_URL is required for Drizzle integration tests.");
}
