import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { UtensilsCrossed } from "lucide-react";

export function NutritionSummaryCue({
  label,
  description,
  tone,
}: {
  label: string;
  description: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br ${tone} px-4 py-3 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{description}</div>
    </div>
  );
}

export function NutritionSectionPanel({
  icon: Icon = UtensilsCrossed,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-3 sm:p-4">{children}</div>
    </div>
  );
}
