"use client";

import { StaffCreateForm } from "./staff-create-form";
import { useCanManageStaff } from "../lib/staff-manage";

export function StaffPage() {
  const canManage = useCanManageStaff();

  return (
    <div className="space-y-region">
      <header className="max-w-2xl">
        <h1 className="page-title">Staff</h1>
        <p className="mt-2 text-body text-fg-secondary">
          Invite staff members with G8 roles. Invites are email-only — no password on this form.
        </p>
      </header>
      {canManage ? (
        <StaffCreateForm />
      ) : (
        <p className="text-body text-fg-secondary">
          Only administrators can invite staff.
        </p>
      )}
    </div>
  );
}
