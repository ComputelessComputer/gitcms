import type { JSONContent } from "@tiptap/react";
import type { RootContent } from "mdast";

export interface ComponentRegistryEntry {
  name: string;
  mdastToJson(node: RootContent): JSONContent | null;
  jsonToMdast(node: JSONContent): RootContent | null;
}

export interface ComponentRegistry {
  get(name: string): ComponentRegistryEntry | undefined;
  entries(): ComponentRegistryEntry[];
}

export function createComponentRegistry(entries: ComponentRegistryEntry[] = []): ComponentRegistry {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    get(name) {
      return byName.get(name);
    },
    entries() {
      return [...byName.values()];
    },
  };
}

export const defaultComponentRegistry = createComponentRegistry();
