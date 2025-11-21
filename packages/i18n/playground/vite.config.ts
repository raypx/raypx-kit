import { defineConfig } from "vite";
import i18n from "../src";

export default defineConfig({
  plugins: [
    i18n({
      localesDir: "locales",
      defaultLocale: "en",
      functionName: "t",
    }),
  ],
});
