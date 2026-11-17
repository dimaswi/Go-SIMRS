import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { UtensilsCrossed } from "lucide-react";

export function NutritionSummaryCue({
  label,
  description,
}: {
  label: string;
  description: string;
  tone?: string;
}) {
  return (
    <div className="border-l-2 border-neutral-900 dark:border-neutral-100 bg-neutral-50/60 dark:bg-neutral-900/40 px-3.5 py-2.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">{description}</div>
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
    <section className="space-y-4">
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</div>
            <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
