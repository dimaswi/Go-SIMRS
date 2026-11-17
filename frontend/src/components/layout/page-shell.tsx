import * as React from "react"
import { cn } from "@/lib/utils"
import { type LucideIcon, ArrowLeft, LayoutGrid } from "lucide-react"

// ── PageShell ──────────────────────────────────────────────────────────────
// Wrapper utama setiap halaman dengan Unified Single Card Container ala Go-Akuntansi
interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("akuntansi-page-shell flex flex-1 min-h-0 flex-col overflow-auto bg-white dark:bg-neutral-950 p-3 sm:p-4", className)}>
      <div className="w-full max-w-full border border-neutral-200 dark:border-neutral-800 rounded-none bg-white dark:bg-neutral-950 shadow-none flex flex-col">
        {children}
      </div>
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────
// Header Bar pada Unified Card Container: Kembali + Icon Kotak Hitam + Judul & Subtitle di Kiri, Aksi di Kanan
interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  count?: number
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
  onBack?: () => void | Promise<void>
  children?: React.ReactNode
  badges?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  count,
  icon: Icon,
  actions,
  className,
  onBack,
  children,
  badges,
}: PageHeaderProps) {
  const DisplayIcon = Icon || LayoutGrid

  return (
    <div className={cn("border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950", className)}>
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-none flex items-center justify-center shrink-0 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm shrink-0">
            <DisplayIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white break-words">
                {title}
              </h1>
              {badges && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {badges}
                </div>
              )}
            </div>
            {(description || count !== undefined) && (
              <div className="text-xs text-neutral-500 font-mono flex flex-wrap items-center gap-1.5 mt-0.5">
                {count !== undefined && <span>Total: {count.toLocaleString("id-ID")} Data</span>}
                {count !== undefined && description && <span>•</span>}
                {description && <span className="truncate">{description}</span>}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── PageToolbar ────────────────────────────────────────────────────────────
// Shaded Filter Strip di bawah Header Bar
interface PageToolbarProps {
  children: React.ReactNode
  className?: string
}

export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5",
        className
      )}
    >
      {children}
    </div>
  )
}

// ── FilterBar ──────────────────────────────────────────────────────────────
interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  )
}

// ── FilterPill ─────────────────────────────────────────────────────────────
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
        "inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors focus-visible:outline-none",
        active
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white",
        className
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex h-[18px] min-w-[18px] items-center justify-center px-1 font-mono text-[10px] font-bold tabular-nums rounded-none",
            active
              ? "bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900"
              : "border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
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
  noPadding?: boolean
}

export function PageContent({ children, className, noPadding }: PageContentProps) {
  return (
    <div
      className={cn(
        "akuntansi-page-content flex flex-col flex-1 min-h-0",
        !noPadding && "p-3 sm:p-4",
        className
      )}
    >
      {children}
    </div>
  )
}
