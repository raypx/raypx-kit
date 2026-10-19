export default {
  dialect: "postgresql",
  schema: "./schema.ts",
  out: process.env.DRIZZLE_OUT,
};
