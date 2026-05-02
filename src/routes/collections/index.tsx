import { createFileRoute } from "@tanstack/react-router";

import { CollectionsPage } from "../../pages/collections";

export const Route = createFileRoute("/collections/")({
  component: CollectionsPage,
});
