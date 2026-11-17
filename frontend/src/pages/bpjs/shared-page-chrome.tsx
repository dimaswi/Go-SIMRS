import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";

interface BPJSPageFrameProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function BPJSPageFrame({
  title,
  description,
  icon,
  actions,
  children,
  className,
  noPadding,
}: BPJSPageFrameProps) {
  return (
    <PageShell>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        actions={actions}
      />
      <PageContent noPadding={noPadding} className={cn("min-h-0 space-y-4", className)}>{children}</PageContent>
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
    <section className={cn("space-y-4", className)}>
      {(title || description || actions) && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              {title && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-[11px] font-mono text-neutral-500">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      <div className={cn("space-y-4", bodyClassName)}>{children}</div>
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
    <div className={cn("bg-white dark:bg-neutral-950 p-3.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <div className="mt-1 font-mono text-lg font-bold leading-none text-neutral-900 dark:text-white">{value}</div>
      {hint && <p className="mt-1 font-mono text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}
