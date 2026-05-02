import { createFileRoute } from "@tanstack/react-router";

import { handleMediaDownload } from "../../../server/handlers/media-download";

export const Route = createFileRoute("/api/media/download")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMediaDownload(request),
    },
  },
});
