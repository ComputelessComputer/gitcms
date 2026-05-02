import { createFileRoute } from "@tanstack/react-router";

import { handleContextGet } from "../../server/handlers/context-get";

export const Route = createFileRoute("/api/context")({
  server: {
    handlers: {
      GET: async ({ request }) => handleContextGet(request),
    },
  },
});
