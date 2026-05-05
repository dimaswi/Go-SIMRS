import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

// ── PageShell ──────────────────────────────────────────────────────────────
// Wrapper utama setiap halaman. Menggantikan <div className="flex flex-1 flex-col px-4">
interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("flex flex-1 flex-col min-h-0", className)}>
      {children}
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
    <div className={cn("border-border bg-background", className)}>
      <div className="flex items-center justify-between gap-4 px-6 py-2">
        {/* Left: Icon + Title + Description */}
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="mt-0.5 flex-shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground leading-tight truncate">
                {title}
              </h1>
              {count !== undefined && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground flex-shrink-0">
                  {count.toLocaleString("id-ID")}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Action buttons */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Optional: tabs or extra content below title row */}
      {children && (
        <div className="px-6 pb-0">
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
        "flex flex-wrap items-center gap-2 px-6 py-2.5 bg-muted/30 px-4 py-2 border-border",
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
    <div className={cn("flex flex-wrap items-center gap-1.5 px-6 py-2.5 px-4 py-2 border-border bg-background", className)}>
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold tabular-nums",
            active ? "bg-background/20 text-background" : "bg-background text-foreground"
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
        !noPadding && "px-6",
        className
      )}
    >
      {children}
    </div>
  )
}
