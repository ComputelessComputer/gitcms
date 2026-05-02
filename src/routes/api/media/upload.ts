import { createFileRoute } from "@tanstack/react-router";

import { handleMediaUpload } from "../../../server/handlers/media-upload";

export const Route = createFileRoute("/api/media/upload")({
  server: {
    handlers: {
      PUT: async ({ request }) => handleMediaUpload(request),
    },
  },
});
