import type { ViteUserConfig } from "vite-plus";

/** Vite+ checks shared by libraries and applications; paths belong to the consumer. */
export const baseLint = {
  jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  options: { typeAware: true, typeCheck: true },
  rules: { "vite-plus/prefer-vite-plus-imports": "error" },
} satisfies NonNullable<ViteUserConfig["lint"]>;

/** Opt-in correctness rules for TypeScript and React repositories. */
export const strictLint = {
  ...baseLint,
  plugins: [
    "typescript",
    "unicorn",
    "oxc",
    "import",
    "react",
    "vitest",
    "jsx-a11y",
    "promise",
    "node",
  ],
  categories: { correctness: "error", suspicious: "error" },
  options: { ...baseLint.options, reportUnusedDisableDirectives: "error" },
  rules: {
    ...baseLint.rules,
    "array-callback-return": "error",
    eqeqeq: "error",
    "prefer-const": "error",
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "import/no-cycle": "error",
    "oxc/no-accumulating-spread": "error",
    "react/rules-of-hooks": "error",
    "react/no-danger": "error",
    "typescript/consistent-type-imports": ["error", { disallowTypeAnnotations: false }],
    "typescript/switch-exhaustiveness-check": "error",
    // Bootstrap imports, third-party defaults and callback adapters are valid.
    "import/no-unassigned-import": "off",
    "import/no-named-as-default": "off",
    "import/no-named-as-default-member": "off",
    "promise/always-return": "off",
    "promise/no-callback-in-promise": "off",
    "promise/no-promise-in-callback": "off",
    "react/exhaustive-effect-dependencies": "off",
    "react/react-in-jsx-scope": "off",
    "vitest/require-mock-type-parameters": "off",
    "vitest/warn-todo": "off",
    "vitest/prefer-snapshot-hint": "off",
    "typescript/consistent-return": "off",
    "typescript/no-unsafe-type-assertion": "off",
    // ES2022 consumers do not have to polyfill the copying array methods.
    "unicorn/no-array-sort": "off",
    "unicorn/no-array-reverse": "off",
    // Keep naming, helper placement and deliberate focus under local control.
    "no-underscore-dangle": "off",
    "unicorn/consistent-function-scoping": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/no-autofocus": "off",
  },
} satisfies NonNullable<ViteUserConfig["lint"]>;
