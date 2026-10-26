"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRecord } from "@/lib/db/repositories/users";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  suspendUserAction,
  reactivateUserAction,
  extendTrialAction,
  setNoExpiryAction,
  deleteUserAction,
  type ActionResult,
} from "../actions";

const initialState: ActionResult = { error: null };

export function UserActions({ user }: { user: UserRecord }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trialState, trialFormAction, trialPending] = useActionState(extendTrialAction, initialState);

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>
          <span className="text-sm text-text-secondary">
            {user.accessMode === "NO_EXPIRY"
              ? "No expiry"
              : user.trialEndAt
                ? `Trial ends ${new Date(user.trialEndAt).toLocaleString()}`
                : "Trial (no end date set)"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.status === "ACTIVE" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={isPending}
              onClick={() =>
                startTransition(async () => {
                  await suspendUserAction(user.id);
                  router.refresh();
                })
              }
            >
              Suspend
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={isPending}
              onClick={() =>
                startTransition(async () => {
                  await reactivateUserAction(user.id);
                  router.refresh();
                })
              }
            >
              Reactivate
            </Button>
          )}

          {user.accessMode === "TRIAL" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={isPending}
              onClick={() =>
                startTransition(async () => {
                  await setNoExpiryAction(user.id);
                  router.refresh();
                })
              }
            >
              Switch to no expiry
            </Button>
          ) : null}
        </div>

        <form action={trialFormAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <TextField id="trialEndAt" name="trialEndAt" type="date" label="Extend trial to" required />
          <Button type="submit" variant="secondary" size="sm" loading={trialPending}>
            {trialPending ? "Saving..." : "Extend trial"}
          </Button>
        </form>
        {trialState.error ? <Alert tone="danger">{trialState.error}</Alert> : null}

        <div className="border-t border-border-subtle pt-4">
          {confirmDelete ? (
            <div className="flex flex-col gap-3 rounded-md border border-danger/30 bg-danger-bg p-3">
              <p className="text-sm text-danger">
                Delete {user.name} and all their data? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteUserAction(user.id);
                      router.push("/admin/users");
                    })
                  }
                >
                  Confirm delete
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
              Delete user
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
