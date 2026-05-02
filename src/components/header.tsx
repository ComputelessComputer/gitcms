import { Link } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import * as React from "react";

import type { PublicAdminUser } from "../auth/session";
import { useSignOutMutation } from "../queries/auth";
import { Button } from "./ui/button";

export interface HeaderProps {
  /** Current admin user. */
  user: PublicAdminUser;
}

/** Top navigation for authenticated admin pages. */
export function Header({ user }: HeaderProps): React.ReactElement {
  const signOut = useSignOutMutation();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-5">
        <Link to="/collections" className="text-base font-semibold text-slate-950">
          gitcms
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/collections"
            className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            activeProps={{ className: "rounded-md bg-teal-50 px-3 py-2 text-teal-800" }}
          >
            Collections
          </Link>
          <Link
            to="/media"
            className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            activeProps={{ className: "rounded-md bg-teal-50 px-3 py-2 text-teal-800" }}
          >
            Media
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {user.avatarUrl && <img src={user.avatarUrl} alt="" className="size-8 rounded-full" />}
        <span className="hidden text-sm text-slate-600 sm:inline">{user.login}</span>
        <Button size="icon" variant="ghost" aria-label="Sign out" onClick={() => signOut.mutate()}>
          <LogOutIcon className="size-4" />
        </Button>
      </div>
    </header>
  );
}
