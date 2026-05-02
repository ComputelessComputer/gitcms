import { isAdminAuthError } from "../lib/errors";

/** Handles query and mutation errors that should return the admin to sign-in. */
export function handleAdminQueryError(error: unknown): void {
  if (isAdminAuthError(error) && typeof window !== "undefined") {
    window.location.assign("/auth/signin");
  }
}

/** React Query retry policy that avoids retrying auth redirects. */
export function adminQueryRetry(failureCount: number, error: unknown): boolean {
  if (isAdminAuthError(error)) return false;
  return failureCount < 2;
}
