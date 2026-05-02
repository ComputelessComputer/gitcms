import { SlidersHorizontalIcon } from "lucide-react";
import * as React from "react";

export interface MdxEditorButtonProps {
  label: string;
  open: boolean;
  onClick: () => void;
}

export function MdxEditorButton({
  label,
  open,
  onClick,
}: MdxEditorButtonProps): React.ReactElement {
  return (
    <button
      aria-label={label}
      aria-pressed={open}
      className="gitcms-mdx-edit-button"
      contentEditable={false}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      <SlidersHorizontalIcon className="size-4" />
    </button>
  );
}

export interface MdxPropsPanelProps {
  children: React.ReactNode;
}

export function MdxPropsPanel({ children }: MdxPropsPanelProps): React.ReactElement {
  return (
    <div className="gitcms-mdx-props-panel" contentEditable={false}>
      {children}
    </div>
  );
}

export function stringAttr(attrs: Record<string, unknown>, key: string, fallback = ""): string {
  const value = attrs[key];
  return typeof value === "string" ? value : fallback;
}

export function booleanAttr(
  attrs: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const value = attrs[key];
  return typeof value === "boolean" ? value : fallback;
}
