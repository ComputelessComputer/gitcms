import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdminServerFn } from "../../auth/require-admin";
import { loadAuthorContext } from "../../context";
import { getRuntimeConfig } from "../runtime-config";

/** Returns the merged author-writing brief (context + voice + collection voice).
 *  Admin-gated — the public, agent-facing surface is `GET /api/context`. */
export const contextGet = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      collectionId: z.string().min(1).optional(),
      branch: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return loadAuthorContext(admin.accessToken, config, {
      collectionId: data.collectionId,
      branch: data.branch,
    });
  });
