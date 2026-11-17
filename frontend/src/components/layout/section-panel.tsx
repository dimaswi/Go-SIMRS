import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionPanelProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionPanelProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className={cn("border-b border-neutral-200 dark:border-neutral-800 pb-2.5", headerClassName)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <Icon className="size-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
            ) : null}
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</div>
              {description ? <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{description}</p> : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
        </div>
      </div>

      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
