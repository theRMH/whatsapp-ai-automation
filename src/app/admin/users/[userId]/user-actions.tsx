"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRecord } from "@/lib/db/repositories/users";
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
  const [trialState, trialFormAction, trialPending] = useActionState(
    extendTrialAction,
    initialState
  );

  return (
    <section className="flex flex-col gap-4 border rounded-md p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            "text-sm font-medium " +
            (user.status === "ACTIVE" ? "text-green-700" : "text-red-700")
          }
        >
          {user.status}
        </span>
        <span className="text-sm text-neutral-500">
          {user.accessMode === "NO_EXPIRY"
            ? "No expiry"
            : user.trialEndAt
              ? `Trial ends ${new Date(user.trialEndAt).toLocaleString()}`
              : "Trial (no end date set)"}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {user.status === "ACTIVE" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              await suspendUserAction(user.id);
              router.refresh();
            })}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            Suspend
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              await reactivateUserAction(user.id);
              router.refresh();
            })}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            Reactivate
          </button>
        )}

        {user.accessMode === "TRIAL" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              await setNoExpiryAction(user.id);
              router.refresh();
            })}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            Switch to no expiry
          </button>
        ) : null}
      </div>

      <form action={trialFormAction} className="flex items-end gap-2">
        <input type="hidden" name="userId" value={user.id} />
        <div className="flex flex-col gap-1">
          <label htmlFor="trialEndAt" className="text-xs font-medium text-neutral-500">
            Extend trial to
          </label>
          <input
            id="trialEndAt"
            name="trialEndAt"
            type="date"
            required
            className="border rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={trialPending}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          {trialPending ? "Saving..." : "Extend trial"}
        </button>
      </form>
      {trialState.error ? <p className="text-sm text-red-600">{trialState.error}</p> : null}

      <div className="pt-2 border-t">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-700">
              Delete {user.name} and all their data? This cannot be undone.
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                await deleteUserAction(user.id);
                router.push("/admin/users");
              })}
              className="bg-red-700 text-white rounded-md px-3 py-1.5 text-sm"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-neutral-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-700"
          >
            Delete user
          </button>
        )}
      </div>
    </section>
  );
}
