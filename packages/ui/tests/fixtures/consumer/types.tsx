import { createRef } from "react";
import { Button, type ButtonProps } from "@raypx-kit/ui/components/ui/button";
import { Badge, type BadgeProps } from "@raypx-kit/ui/components/ui/badge";
import { Input } from "@raypx-kit/ui/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@raypx-kit/ui/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@raypx-kit/ui/components/ui/tabs";
import { Skeleton } from "@raypx-kit/ui/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@raypx-kit/ui/components/ui/native-select";
import { cn } from "@raypx-kit/ui/lib/utils";
import { Button as BarrelButton } from "@raypx-kit/ui";

const button: ButtonProps = { variant: "outline", size: "sm", type: "submit" };
const badge: BadgeProps = { variant: "destructive" };
const buttonRef = createRef<HTMLButtonElement>();
const inputRef = createRef<HTMLInputElement>();

export const controls = (
  <>
    <Button {...button} ref={buttonRef}>
      Save
    </Button>
    <BarrelButton className={cn("h-8", "h-10")}>Reset</BarrelButton>
    <Badge {...badge}>Invalid</Badge>
    <Input ref={inputRef} type="email" aria-label="Email" />
    <NativeSelect aria-label="Theme" defaultValue="dark">
      <NativeSelectOption value="dark">Dark</NativeSelectOption>
    </NativeSelect>
    <Skeleton aria-hidden="true" />
    <Dialog>
      <DialogTrigger render={<Button />}>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Preferences</DialogTitle>
      </DialogContent>
    </Dialog>
    <Tabs
      value="preview"
      onValueChange={(value) => {
        void value;
      }}
    >
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">Output</TabsContent>
    </Tabs>
  </>
);

// @ts-expect-error Unknown variants are rejected at the installed package boundary.
const invalid: ButtonProps = { variant: "danger" };
void invalid;
