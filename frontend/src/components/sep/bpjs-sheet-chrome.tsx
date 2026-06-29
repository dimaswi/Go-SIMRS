import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const BPJS_SHEET_FONT_FAMILY = '"IBM Plex Sans", "Segoe UI", sans-serif';
export const BPJS_SHEET_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';

export const BPJS_PANEL_CLASS = "rounded-none border border-border/70 bg-background";
export const BPJS_MUTED_PANEL_CLASS = "rounded-none border border-border/70 bg-muted/10";
export const BPJS_SECTION_CLASS = "last:pb-0";
export const BPJS_FIELD_CLASS = "h-10 rounded-none border-border/70 bg-background shadow-none text-[15px]";
export const BPJS_COMPACT_FIELD_CLASS = "h-9 rounded-none border-border/70 bg-background shadow-none text-[15px]";
export const BPJS_ICON_BUTTON_CLASS = "h-9 w-9 rounded-none border-border/70 px-0";
export const BPJS_FOOTER_CLASS = "border-t border-border/70 bg-muted/10 px-4 py-4 sm:px-6";

interface BPJSSheetHeroProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: LucideIcon;
  meta?: ReactNode;
}

export function BPJSSheetHero({ eyebrow, title, description, icon: Icon, meta }: BPJSSheetHeroProps) {
  return (
    <div className="border-b border-border/70 bg-muted/10 px-6 py-3 pr-14 sm:pr-16" style={{ fontFamily: BPJS_SHEET_FONT_FAMILY }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
            {eyebrow}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-none border border-border/70 bg-background">
              <Icon className="h-3.5 w-3.5 text-foreground/80" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground leading-none">{title}</h2>
              <div className="text-[13px] text-muted-foreground leading-tight">{description}</div>
            </div>
          </div>
        </div>
        {meta ? <div className="mr-2 sm:mr-3 mt-1 sm:mt-0">{meta}</div> : null}
      </div>
    </div>
  );
}

interface BPJSSectionHeaderProps {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}

export function BPJSSectionHeader({ eyebrow, title, action }: BPJSSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
          {eyebrow}
        </div>
        <h3 className="text-[15px] font-semibold uppercase tracking-[0.15em] text-foreground/80" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}

interface BPJSInfoItem {
  label: string;
  value: ReactNode;
  span?: number;
  mono?: boolean;
}

interface BPJSInfoGridProps {
  items: BPJSInfoItem[];
  columns?: number;
  className?: string;
}

export function BPJSInfoGrid({ items, columns = 2, className }: BPJSInfoGridProps) {
  return (
    <div className={cn(BPJS_PANEL_CLASS, "overflow-hidden", className)}>
      <div className="grid gap-px bg-border/70" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <div
            key={`${item.label}-${typeof item.value === "string" ? item.value : "content"}`}
            className="space-y-1.5 bg-background px-4 py-3.5"
            style={item.span ? { gridColumn: `span ${item.span} / span ${item.span}` } : undefined}
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
              {item.label}
            </div>
            <div className={cn("text-[15px] font-medium leading-relaxed text-foreground", item.mono && "font-mono text-[13px]")}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BPJSStatePanelProps {
  tone?: "neutral" | "success" | "danger";
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  className?: string;
}

export function BPJSStatePanel({
  tone = "neutral",
  icon,
  title,
  description,
  extra,
  className,
}: BPJSStatePanelProps) {
  const toneClass = {
    neutral: "border-border/70 bg-muted/10",
    success: "border-emerald-200/80 bg-emerald-50/50",
    danger: "border-rose-200/80 bg-rose-50/50",
  }[tone];

  return (
    <div className={cn("rounded-none border px-4 py-3", toneClass, className)}>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 text-foreground/70">{icon}</div> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[15px] font-medium text-foreground">{title}</div>
          {description ? <div className="text-[13px] leading-relaxed text-muted-foreground">{description}</div> : null}
          {extra}
        </div>
      </div>
    </div>
  );
}
