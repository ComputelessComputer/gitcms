#!/usr/bin/env node
// gitcms init-context — bootstrap starter writing-brief files into the local
// content tree.
//
// Writes `<content.path>/.gitcms/context.md` and `<content.path>/.gitcms/voice.md`
// if they don't already exist. Skips files that exist. Reads `gitcms.config.ts`
// at the repo root to find the content path.
//
// Usage:
//   pnpm gitcms:init-context              # writes both files at ./<content.path>/.gitcms/
//   pnpm gitcms:init-context blog         # also writes <content.path>/blog/.gitcms/voice.md
//   pnpm gitcms:init-context --force      # overwrite existing files
//
// This script intentionally does NOT commit, push, or talk to GitHub. It just
// writes local files; the operator commits them like any other content.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";

const STARTER_CONTEXT = `# About <Your Company>

Replace this with a paragraph or two about who the company is, what it sells, and who reads its content.

## What we sell

Replace this with a short, plain description of the product. Pricing, who it's for, what problem it solves.

## Who reads our content

Replace this with a paragraph about the audience — their role, what they came looking for, how much patience they have for marketing language. Be specific. "Mid-market CFOs Googling reconciliation problems" beats "finance professionals."
`;

const STARTER_VOICE = `# Voice

- Plain. Concrete. Specific. No business-speak.
- Sentences under 25 words. Most under 15.
- Lead with the answer, then explain.
- No emoji in headlines. Sparingly in body.

## Words we never use

Replace this list with words / phrases you ban. Examples: leverage (as a verb), synergy, drive impact, thought leader, seamless, robust.

## Words we always use

Replace this list with the canonical names you want — your product name, never abbreviated; "customers" not "users"; "you" not "the user."

## Examples

Yes: "If a wire bounces, the funds return in 1–3 business days."
No: "In the unfortunate event of a wire reversal, customers can typically expect funds to be returned within 1–3 business days."

Yes: "Connect your bank in two clicks."
No: "Acme provides seamless integration with your financial institution."
`;

function starterCollectionVoice(collectionLabel) {
  return `# Voice — ${collectionLabel}

This file overrides the repo-level voice for the **${collectionLabel}** collection only. Use it for tone differences between collections — e.g. blog posts allow first-person plural, docs are stricter, changelogs are terse and bulleted.

## What's different here

Replace this with the rules that diverge from the repo-level voice. Keep it short — anything that isn't different should stay in the parent \`voice.md\`.

## Examples

Yes (blog): "We shipped a small thing this week..."
No (docs):  "We shipped a small thing this week..."  — docs use second-person, not first.
`;
}

function writeIfMissing(filePath, contents, forceWrite, label) {
  if (existsSync(filePath) && !forceWrite) {
    return { path: filePath, label, created: false };
  }
  writeFileSync(filePath, contents, { encoding: "utf8" });
  return { path: filePath, label, created: true };
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const collectionId = args.find((a) => !a.startsWith("--"));

const cwd = process.cwd();
const configPath = resolve(cwd, "gitcms.config.ts");
if (!existsSync(configPath)) {
  console.error(
    `gitcms: could not find ${configPath}.\n` +
      `Run this command from your gitcms project root, or copy examples/gitcms.config.example.ts to gitcms.config.ts first.`,
  );
  process.exit(1);
}

const jiti = createJiti(pathToFileURL(configPath).href);
const configModule = await jiti.import(configPath);
const config = configModule.default ?? configModule;

if (!config?.content?.path) {
  console.error(
    "gitcms: gitcms.config.ts does not look like a valid GitcmsConfig (missing content.path).",
  );
  process.exit(1);
}

const contentRoot = resolve(cwd, config.content.path);
const repoBriefDir = join(contentRoot, ".gitcms");
const repoContextPath = join(repoBriefDir, "context.md");
const repoVoicePath = join(repoBriefDir, "voice.md");

mkdirSync(repoBriefDir, { recursive: true });

const writes = [];
writes.push(
  writeIfMissing(repoContextPath, STARTER_CONTEXT, force, "context.md (brand & audience)"),
);
writes.push(writeIfMissing(repoVoicePath, STARTER_VOICE, force, "voice.md (tone & style)"));

if (collectionId) {
  const collection = (config.collections ?? []).find((c) => c.id === collectionId);
  if (!collection) {
    console.error(
      `gitcms: collection "${collectionId}" not found in gitcms.config.ts. Skipping collection-level voice.`,
    );
  } else {
    const collectionBriefDir = join(contentRoot, collection.path, ".gitcms");
    mkdirSync(collectionBriefDir, { recursive: true });
    const collectionVoicePath = join(collectionBriefDir, "voice.md");
    const label = collection.label ?? collection.id;
    writes.push(
      writeIfMissing(
        collectionVoicePath,
        starterCollectionVoice(label),
        force,
        `voice.md (${collection.id} override)`,
      ),
    );
  }
}

const created = writes.filter((w) => w.created).length;
const skipped = writes.filter((w) => !w.created).length;

console.log(`\ngitcms init-context — ${created} created, ${skipped} skipped\n`);
for (const w of writes) {
  console.log(`  ${w.created ? "+" : "·"} ${w.label}\n      ${w.path}`);
}
console.log(
  `\nNext: edit the files, then commit them with your normal flow. Authors and AI agents will read them via GET /api/context.`,
);
