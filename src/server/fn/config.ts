import { createServerFn } from "@tanstack/react-start";

import { requireAdminServerFn } from "../../auth/require-admin";
import type { GitcmsConfig } from "../../config";
import { getRuntimeConfig } from "../runtime-config";

/** Returns the public gitcms runtime config for the admin UI. */
export const configGet = createServerFn({ method: "GET" }).handler(
  async (): Promise<GitcmsConfig> => {
    await requireAdminServerFn();
    return getRuntimeConfig();
  },
);
