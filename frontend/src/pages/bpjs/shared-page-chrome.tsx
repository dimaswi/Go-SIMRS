import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";

interface BPJSPageFrameProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function BPJSPageFrame({
  title,
  description,
  actions,
  children,
  className,
}: BPJSPageFrameProps) {
  return (
    <PageShell>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        className="[&>div]:py-3"
      />
      <PageContent className={cn("min-h-0 py-3", className)}>{children}</PageContent>
    </PageShell>
  );
}

interface BPJSSectionPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function BPJSSectionPanel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: BPJSSectionPanelProps) {
  return (
    <section className={cn("border border-border/70 bg-background", className)}>
      {(title || description || actions) && (
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[9px] items-center font-semibold uppercase tracking-[0.18em] text-muted-foreground">          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

interface BPJSMetricCueProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function BPJSMetricCue({ label, value, hint, className }: BPJSMetricCueProps) {
  return (
    <div className={cn("border border-border/70 bg-background px-4 py-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-2xl font-semibold leading-none text-foreground">{value}</div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
