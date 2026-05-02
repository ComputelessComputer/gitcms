# Collections

Collections are declared in `gitcms.config.ts`. They are the only taxonomy source for the admin UI; there are no hardcoded blog, wiki, or changelog assumptions.

```ts
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
      bodyFormat: "markdown",
      schema: {
        title: { type: "string", required: true },
        date: { type: "date", required: true },
        tags: { type: "string-array" },
        draft: { type: "boolean", default: false },
      },
    },
  ],
});
```

`content.path` is the repository root for content. Collection paths are relative to it, so the example above reads and writes files under `content/blog`.

## Field Types

| Type           | UI control            | Frontmatter value |
| -------------- | --------------------- | ----------------- |
| `string`       | text input            | string            |
| `date`         | date input            | ISO date string   |
| `boolean`      | checkbox              | boolean           |
| `string-array` | comma-separated input | string array      |
| `number`       | number input          | number            |

`required` marks fields the operator expects editors to fill. `default` seeds new files.

## Branches

Regular saves write to `content.workingBranchPrefix + slug`, for example `gitcms/my-post`. The Publish button opens a pull request from that branch into `content.branch`. Editors can enable Direct commit to write straight to the base branch when the GitHub token has permission.
