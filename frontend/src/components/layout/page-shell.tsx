import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

const PAGE_SHELL_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'

// ── PageShell ──────────────────────────────────────────────────────────────
// Wrapper utama setiap halaman. Menggantikan <div className="flex flex-1 flex-col px-4">
interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("relative flex flex-1 min-h-0 flex-col overflow-auto bg-muted/20", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────
// Zona judul + deskripsi + badge count + slot aksi (tombol)
interface PageHeaderProps {
  title: string
  description?: string
  count?: number
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
  // Slot untuk konten tambahan di bawah title row (misal: tabs)
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  count,
  icon: Icon,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("overflow-hidden border-b border-border/70 bg-background/95 backdrop-blur", className)}>
      <div className="border-b border-border/70 bg-muted/10 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            {/* <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: PAGE_SHELL_MONO_FAMILY }}>
              <span>Workspace</span>
              {count !== undefined && (
                <span className="border border-border/70 px-2 py-1 text-foreground">
                  {count.toLocaleString("id-ID")}
                </span>
              )}
            </div> */}
            <div className="flex min-w-0 items-start gap-3">
          {Icon && (
                <div className="mt-0.5 flex-shrink-0 border border-border/70 bg-background p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {title}
                  </h1>
                </div>
                {description && (
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>

      {children && (
        <div className="bg-background px-4 pb-0 pt-3 md:px-6">
          {children}
        </div>
      )}
    </div>
  )
}

// ── PageToolbar ────────────────────────────────────────────────────────────
// Zona search + filter + secondary actions
// Muncul di antara PageHeader dan PageContent
interface PageToolbarProps {
  children: React.ReactNode
  className?: string
}

export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-6",
        className
      )}
    >
      {children}
    </div>
  )
}

// ── FilterBar ──────────────────────────────────────────────────────────────
// Strip filter dengan pill buttons — menggantikan pattern Tabs pada halaman list.
interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-border/70 bg-background/90 backdrop-blur", className)}>
      {children}
    </div>
  )
}

// ── FilterPill ─────────────────────────────────────────────────────────────
// Tombol pill aktif/nonaktif — menggantikan TabsTrigger.
interface FilterPillProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  className?: string
}

export function FilterPill({ active, onClick, children, count, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className
      )}
      style={{ fontFamily: PAGE_SHELL_MONO_FAMILY }}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex h-[18px] min-w-[18px] items-center justify-center px-1 text-[10px] font-semibold tabular-nums",
            active ? "bg-background/20 text-background" : "border border-border/70 bg-background text-foreground"
          )}
        >
          {count.toLocaleString("id-ID")}
        </span>
      )}
    </button>
  )
}

// ── PageContent ────────────────────────────────────────────────────────────
interface PageContentProps {
  children: React.ReactNode
  className?: string
  // Jika true, tidak ada px-6 (untuk konten yang butuh full-width)
  noPadding?: boolean
}

export function PageContent({ children, className, noPadding }: PageContentProps) {
  return (
    <div
      className={cn(
        "flex flex-col flex-1 min-h-0",
        !noPadding && "px-4 pb-4 pt-4 md:px-6",
        className
      )}
    >
      {children}
    </div>
  )
}
