import { useTheme } from "@raypx-kit/themes";
import { parseTheme } from "@raypx-kit/themes/config";
import { NativeSelect, NativeSelectOption } from "@raypx-kit/ui/components/ui/native-select";

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return (
    <NativeSelect
      className="theme-select"
      aria-label="Color theme"
      value={theme}
      onChange={(event) => setTheme(parseTheme(event.target.value, "system"))}
    >
      <NativeSelectOption value="system">System theme</NativeSelectOption>
      <NativeSelectOption value="light">Light theme</NativeSelectOption>
      <NativeSelectOption value="dark">Dark theme</NativeSelectOption>
    </NativeSelect>
  );
}
