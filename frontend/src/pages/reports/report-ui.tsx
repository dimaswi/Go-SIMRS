import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const REPORT_FONT_FAMILY = '"Inter", "Segoe UI", sans-serif';
export const REPORT_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
const REPORT_FLAT_CARD_CLASS = "rounded-none border-0 bg-transparent shadow-none";

export function ReportShellCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(REPORT_FLAT_CARD_CLASS, className)}>{children}</div>;
}

export function ReportAuditBanner({
  title,
  description,
  status = "audit",
}: {
  title: string;
  description: string;
  status?: "audit" | "verified";
}) {
  const Icon = status === "verified" ? ShieldCheck : AlertTriangle;

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
      <div className="grid divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 dark:divide-neutral-800 lg:grid-cols-[minmax(0,1.15fr)_280px]">
        <div className="bg-white dark:bg-neutral-950 py-1 pr-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center border",
                status === "verified"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
              )}
            >
              <Icon className="size-4" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Report Command
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-none text-[11px] font-semibold px-1.5 py-0",
                    status === "verified"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
                  )}
                >
                  {status === "verified" ? "Terverifikasi" : "Perlu Audit"}
                </Badge>
              </div>
              <div className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white">{title}</div>
              <p className="max-w-3xl text-xs font-mono text-neutral-500">{description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-neutral-50/50 dark:bg-neutral-900/30 px-4 py-2.5">
          <div className="space-y-1">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Fokus Validasi
            </div>
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {status === "verified" ? "Angka siap dipakai lintas modul" : "Bandingkan tabel, chart, dan output operasional"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportKpiGrid({
  items,
}: {
  items: { label: string; value: string; hint: string }[];
}) {
  return (
    <div className="grid border-y border-neutral-200 dark:border-neutral-800 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 md:grid-cols-2 xl:grid-cols-4 bg-neutral-50/40 dark:bg-neutral-900/30">
      {items.map((item) => (
        <div key={item.label} className="p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {item.label}
          </div>
          <div className="mt-1 font-mono text-lg font-bold tracking-tight text-neutral-900 dark:text-white">{item.value}</div>
          <div className="mt-0.5 font-mono text-xs text-neutral-500">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

export function ReportInsightStrip({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="border-y border-neutral-200 dark:border-neutral-800">
      <div className="grid divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="bg-white dark:bg-neutral-950 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex size-8 items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                  <Database className="size-4 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {item.label}
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-neutral-900 dark:text-white">{item.value}</div>
                </div>
              </div>
              <ArrowUpRight className="mt-1 size-4 text-neutral-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportPanel({
  eyebrow = "Panel",
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("space-y-3 border-b border-neutral-200 dark:border-neutral-800 pb-4", className)}>
      <CardHeader className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn("px-4 py-0 space-y-4", contentClassName)}>{children}</CardContent>
    </section>
  );
}
