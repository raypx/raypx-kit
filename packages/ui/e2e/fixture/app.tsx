import { useEffect, useState } from "react";
import { Badge } from "@raypx-kit/ui/components/ui/badge";
import { Button } from "@raypx-kit/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@raypx-kit/ui/components/ui/dialog";
import { Input } from "@raypx-kit/ui/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@raypx-kit/ui/components/ui/native-select";
import { Skeleton } from "@raypx-kit/ui/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@raypx-kit/ui/components/ui/tabs";

export function App() {
  const [hydrated, setHydrated] = useState(false);
  const [previews, setPreviews] = useState(0);
  const [submission, setSubmission] = useState("Not submitted");
  useEffect(() => setHydrated(true), []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 bg-background p-4 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Account preferences</h1>
        <Badge variant="secondary">Ready to edit</Badge>
      </header>
      <output aria-label="Hydration status">{hydrated ? "Ready" : "Server rendered"}</output>

      <Dialog>
        <DialogTrigger render={<Button className="self-start" />}>Edit profile</DialogTrigger>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Change the name shown on your account.</DialogDescription>
          <label htmlFor="dialog-name">Display name</label>
          <Input id="dialog-name" defaultValue="Ada" />
          <Button variant="outline">Check availability</Button>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="account">
        <TabsList aria-label="Preference sections">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="billing" disabled>
            Billing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">Update your account preferences below.</TabsContent>
        <TabsContent value="delivery">Delivery preferences apply to new messages.</TabsContent>
        <TabsContent value="billing">Billing is managed by your administrator.</TabsContent>
      </Tabs>

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = data.get("name");
          const frequency = data.get("frequency");
          if (typeof name !== "string" || typeof frequency !== "string") {
            throw new Error("The preference form must submit text fields.");
          }
          setSubmission(`${name} / ${frequency}`);
        }}
      >
        <label htmlFor="account-name">Account name</label>
        <Input id="account-name" name="name" defaultValue="Ada" required />
        <label htmlFor="frequency">Message frequency</label>
        <NativeSelect id="frequency" name="frequency" defaultValue="weekly" className="w-full">
          <NativeSelectOptGroup label="Delivery schedule">
            <NativeSelectOption value="weekly">Weekly digest</NativeSelectOption>
            <NativeSelectOption value="daily">Daily digest</NativeSelectOption>
          </NativeSelectOptGroup>
        </NativeSelect>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviews((count) => count + 1)}>
            Preview changes
          </Button>
          <Button type="submit">Save preferences</Button>
          <Button type="reset" variant="ghost">
            Reset
          </Button>
          <Button disabled>Unavailable</Button>
        </div>
        <output aria-label="Preview count">{previews}</output>
        <output aria-label="Submission">{submission}</output>
      </form>

      <section aria-label="Loading preview" className="grid gap-2">
        <Skeleton aria-label="Loading bar" className="h-4 w-full" />
        <Skeleton aria-hidden="true" className="h-4 w-2/3" />
      </section>
    </main>
  );
}
