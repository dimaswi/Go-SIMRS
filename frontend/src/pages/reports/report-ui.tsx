import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const REPORT_FONT_FAMILY = '"IBM Plex Sans", "Segoe UI", sans-serif';
export const REPORT_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
const REPORT_FLAT_CARD_CLASS = "rounded-none border-border/70 shadow-none";

export function ReportShellCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Card className={cn(REPORT_FLAT_CARD_CLASS, className)}>{children}</Card>;
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
    <ReportShellCard className="overflow-hidden bg-background/95">
      <div className="grid gap-px bg-border/70 lg:grid-cols-[minmax(0,1.15fr)_280px]">
        <div className="bg-background px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center border border-border/70",
                status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
                  style={{ fontFamily: REPORT_MONO_FAMILY }}
                >
                  Report Command
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-none",
                    status === "verified"
                      ? "border-emerald-300 bg-transparent text-emerald-700"
                      : "border-amber-300 bg-transparent text-amber-700",
                  )}
                >
                  {status === "verified" ? "Terverifikasi" : "Perlu Audit"}
                </Badge>
              </div>
              <div className="text-lg font-semibold tracking-tight">{title}</div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center border-l-0 bg-muted/10 px-4 py-4 sm:px-5 lg:border-l lg:border-border/70">
          <div className="space-y-2">
            <div
              className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
              style={{ fontFamily: REPORT_MONO_FAMILY }}
            >
              Fokus Validasi
            </div>
            <div className="text-sm font-medium text-foreground">
              {status === "verified" ? "Angka siap dipakai lintas modul" : "Bandingkan tabel, chart, dan output operasional"}
            </div>
          </div>
        </div>
      </div>
    </ReportShellCard>
  );
}

export function ReportKpiGrid({
  items,
}: {
  items: { label: string; value: string; hint: string }[];
}) {
  return (
    <div className="grid gap-px bg-border/70 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-background px-4 py-4 sm:px-5">
          <div
            className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
            style={{ fontFamily: REPORT_MONO_FAMILY }}
          >
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.hint}</div>
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
    <ReportShellCard className="overflow-hidden bg-background">
      <div className="grid gap-px bg-border/70 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="bg-background px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border/70 bg-muted/20">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div
                    className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
                    style={{ fontFamily: REPORT_MONO_FAMILY }}
                  >
                    {item.label}
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">{item.value}</div>
                </div>
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </ReportShellCard>
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
    <ReportShellCard className={cn("overflow-hidden bg-background/95", className)}>
      <CardHeader className="border-b border-border/70 bg-muted/10 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div
              className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
              style={{ fontFamily: REPORT_MONO_FAMILY }}
            >
              {eyebrow}
            </div>
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs uppercase tracking-[0.16em]">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn("p-4 sm:p-5", contentClassName)}>{children}</CardContent>
    </ReportShellCard>
  );
}
