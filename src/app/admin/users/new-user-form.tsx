"use client";

import { useActionState, useState } from "react";
import { createUserAction, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "UTC"];

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [trialOption, setTrialOption] = useState<"DEFAULT" | "CUSTOM_END_DATE" | "NO_EXPIRY">(
    "DEFAULT"
  );

  return (
    <details className="border rounded-md p-4">
      <summary className="cursor-pointer text-sm font-medium">Add user</summary>
      <form action={formAction} className="flex flex-col gap-4 mt-4 max-w-md">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" required className="border rounded-md px-3 py-2 text-sm" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">
            WhatsApp phone number
          </label>
          <input
            id="phone"
            name="phone"
            required
            placeholder="+919876543210"
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
            required
            defaultValue="Asia/Kolkata"
            className="border rounded-md px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="trialOption" className="text-sm font-medium">
            Trial option
          </label>
          <select
            id="trialOption"
            name="trialOption"
            value={trialOption}
            onChange={(e) => setTrialOption(e.target.value as typeof trialOption)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="DEFAULT">Use default trial length</option>
            <option value="CUSTOM_END_DATE">Custom end date</option>
            <option value="NO_EXPIRY">No expiry</option>
          </select>
        </div>

        {trialOption === "CUSTOM_END_DATE" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="trialEndAt" className="text-sm font-medium">
              Trial end date
            </label>
            <input
              id="trialEndAt"
              name="trialEndAt"
              type="date"
              required
              className="border rounded-md px-3 py-2 text-sm"
            />
          </div>
        ) : null}

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
          {pending ? "Creating..." : "Create user"}
        </button>
      </form>
    </details>
  );
}
