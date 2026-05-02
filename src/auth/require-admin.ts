import { AdminUnauthorizedError } from "../lib/errors";
import { readAdminSession, type AdminSession } from "./session";

/** Requires a valid admin session inside a server function. */
export async function requireAdminServerFn(): Promise<AdminSession> {
  const session = await readAdminSession();
  if (!session) {
    throw new AdminUnauthorizedError();
  }
  return session;
}
