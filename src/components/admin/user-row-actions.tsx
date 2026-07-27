"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { changeUserRoleAction, setUserSuspensionAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import type { Role } from "@prisma/client";

type UserRowActionsProps = {
  userId: string;
  role: Role;
  suspended: boolean;
  isSelf: boolean;
  canManage: boolean;
};

const ROLES: Role[] = ["ALUMNI", "MODERATOR", "ADMIN"];

export function UserRowActions({
  userId,
  role,
  suspended,
  isSelf,
  canManage,
}: UserRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!canManage) {
    return <span className="text-xs text-muted-foreground">Admin only</span>;
  }

  const run = (formData: FormData, action: (data: FormData) => Promise<
    { ok: true; message?: string } | { ok: false; error: string }
  >) => {
    startTransition(async () => {
      const result = await action(formData);
      toast({
        title: result.ok ? (result.message ?? "Updated.") : result.error,
        variant: result.ok ? "success" : "error",
      });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        value={role}
        disabled={pending || isSelf}
        onChange={(event) => {
          const formData = new FormData();
          formData.set("userId", userId);
          formData.set("role", event.target.value);
          run(formData, changeUserRoleAction);
        }}
        aria-label="Role"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm disabled:opacity-50"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option.toLowerCase()}
          </option>
        ))}
      </select>

      <Button
        variant={suspended ? "outline" : "ghost"}
        size="sm"
        disabled={pending || isSelf}
        onClick={() => {
          const formData = new FormData();
          formData.set("userId", userId);
          formData.set("action", suspended ? "RESTORE" : "SUSPEND");
          run(formData, setUserSuspensionAction);
        }}
      >
        {suspended ? "Restore" : "Suspend"}
      </Button>
    </div>
  );
}
