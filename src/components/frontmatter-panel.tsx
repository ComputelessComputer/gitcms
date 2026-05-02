import * as React from "react";

import type { CollectionDescriptor } from "../config";
import type { JsonRecord, JsonValue } from "../lib/markdown";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export interface FrontmatterPanelProps {
  /** Collection whose schema drives field rendering. */
  collection: CollectionDescriptor;
  /** Current frontmatter values. */
  value: JsonRecord;
  /** Emits changed frontmatter values. */
  onChange: (value: JsonRecord) => void;
}

/** Typed frontmatter form rendered from collection schema. */
export function FrontmatterPanel({
  collection,
  value,
  onChange,
}: FrontmatterPanelProps): React.ReactElement {
  const update = (key: string, nextValue: JsonValue) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <aside className="flex h-full flex-col gap-4 border-l border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Frontmatter</h2>
        <p className="mt-1 text-xs text-slate-500">{collection.label}</p>
      </div>
      <div className="flex flex-col gap-4">
        {Object.entries(collection.schema).map(([key, field]) => {
          const id = `frontmatter-${key}`;
          const label = field.label ?? key;
          const current = value[key] ?? field.default ?? "";

          if (field.type === "boolean") {
            return (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(current)}
                  onChange={(event) => update(key, event.currentTarget.checked)}
                  className="size-4 rounded border-slate-300"
                />
                {label}
              </label>
            );
          }

          if (field.type === "string-array") {
            return (
              <div key={key} className="grid gap-2">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  value={Array.isArray(current) ? current.join(", ") : String(current)}
                  onChange={(event) =>
                    update(
                      key,
                      event.currentTarget.value
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            );
          }

          return (
            <div key={key} className="grid gap-2">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                value={String(current)}
                onChange={(event) =>
                  update(
                    key,
                    field.type === "number" ? Number(event.currentTarget.value) : event.currentTarget.value,
                  )
                }
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
