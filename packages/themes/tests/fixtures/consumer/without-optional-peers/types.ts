import { themeTokens, readThemeCookie, type UserTheme } from "@raypx-kit/themes/config";
import { createThemeScript, type ThemeScriptOptions } from "@raypx-kit/themes/script";

const theme: UserTheme = readThemeCookie("theme=dark") ?? "system";
const options: ThemeScriptOptions = { initialTheme: theme, storageKey: false };
const script: string = createThemeScript(options);
const background: string = themeTokens.light.background;
void [script, background];
