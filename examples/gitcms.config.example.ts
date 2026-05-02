import { defineConfig } from "gitcms/config";

export default defineConfig({
  content: {
    repo: "alice/my-blog",
    branch: "main",
    path: "content",
    workingBranchPrefix: "gitcms/",
  },
  collections: [
    {
      id: "blog",
      label: "Blog Posts",
      path: "blog",
      schema: {
        title: { type: "string", required: true },
        date: { type: "date", required: true },
        author: { type: "string", required: false },
        tags: { type: "string-array", required: false },
        draft: { type: "boolean", required: false, default: false },
      },
      bodyFormat: "markdown",
    },
    {
      id: "wiki",
      label: "Wiki Pages",
      path: "wiki",
      schema: {
        title: { type: "string", required: true },
      },
      bodyFormat: "markdown",
    },
  ],
});
