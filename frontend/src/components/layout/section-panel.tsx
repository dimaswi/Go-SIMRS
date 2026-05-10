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
    <section className={cn("overflow-hidden border border-border/70 bg-background/95 shadow-sm", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-5", headerClassName)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="mt-0.5 border border-border/70 bg-background p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
        </div>
      </div>

      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}