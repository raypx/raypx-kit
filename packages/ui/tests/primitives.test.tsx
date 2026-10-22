import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../src/index.js";
import { cn } from "../src/lib/utils.js";

afterEach(cleanup);

describe("form primitives", () => {
  it("preserves refs, keyboard actions, disabled state and a safe form default", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const action = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <form onSubmit={submit}>
        <Button ref={ref} onClick={action}>
          Continue
        </Button>
        <Button disabled onClick={action}>
          Unavailable
        </Button>
      </form>,
    );
    await user.tab();
    expect(document.activeElement).toBe(ref.current);
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(action).toHaveBeenCalledOnce();
    expect(ref.current?.type).toBe("button");
  });

  it("retains labels, input refs and native select changes", async () => {
    const user = userEvent.setup();
    const input = createRef<HTMLInputElement>();
    const select = createRef<HTMLSelectElement>();
    const change = vi.fn();
    render(
      <>
        <label htmlFor="email">Email</label>
        <Input id="email" name="email" type="email" ref={input} aria-invalid="true" />
        <label htmlFor="theme">Theme</label>
        <NativeSelect id="theme" name="theme" ref={select} defaultValue="system" onChange={change}>
          <NativeSelectOption value="system">System</NativeSelectOption>
          <NativeSelectOption value="dark">Dark</NativeSelectOption>
        </NativeSelect>
      </>,
    );
    await user.type(screen.getByRole("textbox", { name: "Email" }), "hello@example.com");
    expect(input.current?.value).toBe("hello@example.com");
    expect(input.current?.getAttribute("aria-invalid")).toBe("true");
    await user.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "dark");
    expect(select.current?.value).toBe("dark");
    expect(change).toHaveBeenCalledOnce();
  });
});

it("switches tabs by keyboard and associates panels with their labels", async () => {
  const user = userEvent.setup();
  render(
    <Tabs defaultValue="preview">
      <TabsList aria-label="Output">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="html">HTML</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">Visual output</TabsContent>
      <TabsContent value="html">Source output</TabsContent>
    </Tabs>,
  );
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Preview" }));
  await user.keyboard("{ArrowRight}");
  const html = screen.getByRole("tab", { name: "HTML" });
  expect(document.activeElement).toBe(html);
  await user.keyboard("{Enter}");
  expect(html.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "HTML" }).textContent).toBe("Source output");
});

it("composes a dialog trigger and restores focus after Escape", async () => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <DialogTrigger render={<Button />}>Open settings</DialogTrigger>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Choose your preferences.</DialogDescription>
        <Input aria-label="Display name" />
      </DialogContent>
    </Dialog>,
  );
  const trigger = screen.getByRole("button", { name: "Open settings" });
  await user.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Settings" });
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("renders SSR-safe primitives and resolves caller utility overrides", () => {
  const html = renderToStaticMarkup(
    <>
      <Button className="h-12">Submit</Button>
      <Badge variant="destructive">Failed</Badge>
      <Skeleton aria-hidden="true" />
      <Input aria-label="Name" />
    </>,
  );
  expect(html).toContain('type="button"');
  expect(html).toContain("text-destructive-text");
  expect(html).toContain("motion-reduce:animate-none");
  expect(html).toContain('aria-label="Name"');
  expect(cn("h-8 px-2", false, "h-12")).toBe("px-2 h-12");
});
