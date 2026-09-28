"use client";

import { useActionState } from "react";
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

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={user.name}
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">
          WhatsApp phone number
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={user.phoneE164}
          required
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="timezone" className="text-sm font-medium">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={user.timezone}
          required
          className="border rounded-md px-3 py-2 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 self-start"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
