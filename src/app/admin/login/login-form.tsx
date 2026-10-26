"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { signInAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="email" name="email" type="email" label="Email" required autoComplete="email" />

      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        required
        autoComplete="current-password"
      />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Button type="submit" variant="primary" loading={pending} className="w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
