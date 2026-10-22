import { createElement } from "react";
import { ThemeProvider, ThemeScript, useTheme, type ThemeProviderProps } from "@raypx-kit/themes";
import { parseTheme, themeTokens, type UserTheme, type ThemeToken } from "@raypx-kit/themes/config";
import { createThemeScript } from "@raypx-kit/themes/script";

const theme: UserTheme = parseTheme("dark", "system");
const key: ThemeToken = "destructive-text";
const token: string = themeTokens.light[key];
const props: ThemeProviderProps = { initialTheme: theme, storageKey: false, children: null };
const provider = createElement(ThemeProvider, props);
const script = createElement(ThemeScript, { nonce: "nonce", initialTheme: theme });
const inline: string = createThemeScript({ storageKey: false, initialTheme: "dark" });
const hook: () => { theme: UserTheme; setTheme(theme: UserTheme): void } = useTheme;
void [token, provider, script, inline, hook];
// @ts-expect-error Unknown preference values are not part of the contract.
createThemeScript({ initialTheme: "sepia" });
