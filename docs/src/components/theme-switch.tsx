import { useTheme } from "@raypx-kit/themes";
import { buttonVariants } from "@fumadocs/base-ui/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, type ComponentProps } from "react";
import { useTranslations } from "../lib/i18n/client";

const choices = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

/** Fumadocs owns placement; Kit owns the preference and resolved appearance. */
export function DocsThemeSwitch({ className, ...props }: ComponentProps<"div">) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("fumadocs");
  return (
    <div
      {...props}
      role="group"
      aria-label={t("theme")}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-fd-border p-1 ${className ?? ""}`}
    >
      {choices.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={t(value)}
          aria-pressed={theme === value}
          title={t(value)}
          className={buttonVariants({
            variant: "ghost",
            size: "icon-xs",
            className: "aria-pressed:bg-fd-accent aria-pressed:text-fd-accent-foreground",
          })}
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden="true" className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

/** Keep the documentation's existing D shortcut mounted once above both sidebars. */
export function ThemeKeyboardShortcut() {
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key.toLowerCase() !== "d"
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
        )
      )
        return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resolvedTheme, setTheme]);
  return null;
}
