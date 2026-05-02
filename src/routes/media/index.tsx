import { createFileRoute } from "@tanstack/react-router";

import { MediaPage } from "../../pages/media";

export const Route = createFileRoute("/media/")({
  component: MediaPage,
});
