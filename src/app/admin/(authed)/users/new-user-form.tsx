"use client";

import { useActionState, useState } from "react";
import { TextField, SelectField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { createUserAction, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "UTC"];

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [trialOption, setTrialOption] = useState<"DEFAULT" | "CUSTOM_END_DATE" | "NO_EXPIRY">("DEFAULT");
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Add user"
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Cancel" : "Add user"}
          </Button>
        }
      />
      {expanded ? (
        <CardBody>
          <form action={formAction} className="flex flex-col gap-4 max-w-md">
            <TextField id="name" name="name" label="Name" required />

            <TextField id="phone" name="phone" label="WhatsApp phone number" placeholder="+919876543210" required />

            <SelectField id="timezone" name="timezone" label="Timezone" required defaultValue="Asia/Kolkata">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="trialOption"
              name="trialOption"
              label="Trial option"
              value={trialOption}
              onChange={(e) => setTrialOption(e.target.value as typeof trialOption)}
            >
              <option value="DEFAULT">Use default trial length</option>
              <option value="CUSTOM_END_DATE">Custom end date</option>
              <option value="NO_EXPIRY">No expiry</option>
            </SelectField>

            {trialOption === "CUSTOM_END_DATE" ? (
              <TextField id="trialEndAt" name="trialEndAt" type="date" label="Trial end date" required />
            ) : null}

            {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

            <Button type="submit" variant="primary" loading={pending} className="self-start">
              {pending ? "Creating..." : "Create user"}
            </Button>
          </form>
        </CardBody>
      ) : null}
    </Card>
  );
}
