"use client";

import { useActionState } from "react";
import { TextField, SelectField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { updateUserAction, type ActionResult } from "../actions";
import type { UserRecord } from "@/lib/db/repositories/users";

const initialState: ActionResult = { error: null };

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "UTC"];

export function EditUserForm({ user }: { user: UserRecord }) {
  const [state, formAction, pending] = useActionState(updateUserAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <input type="hidden" name="userId" value={user.id} />

      <TextField id="name" name="name" label="Name" defaultValue={user.name} required />

      <TextField id="phone" name="phone" label="WhatsApp phone number" defaultValue={user.phoneE164} required />

      <SelectField id="timezone" name="timezone" label="Timezone" defaultValue={user.timezone} required>
        {TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </SelectField>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Button type="submit" variant="primary" loading={pending} className="self-start">
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
