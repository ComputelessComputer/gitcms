import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { authCurrentUser, authSignOut, authStart } from "../server/fn/auth";

export const authKeys = {
  currentUser: ["auth", "currentUser"] as const,
};

/** Query options for the current admin user. */
export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: () => authCurrentUser(),
  });
}

/** Starts GitHub sign-in from a user event. */
export async function startGitHubSignIn(): Promise<void> {
  const result = await authStart({ data: {} });
  window.location.assign(result.url);
}

/** Mutation hook for signing out. */
export function useSignOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authSignOut({ data: {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
      window.location.assign("/auth/signin");
    },
  });
}
