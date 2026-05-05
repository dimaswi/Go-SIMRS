import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  LogOut,
  ChevronUp,
  ChevronDown,
  Lock,
  Building2,
  Settings,
  UserCog,
  MapPin,
  Database,
  BedDouble,
  Syringe,
  UserRound,
  Package,
  Pill,
  FileText,
  FileSearch,
  FileCheck,
  Send,
  ShoppingCart,
  ClipboardList,
  Truck,
  Monitor,
  Activity,
  Receipt,
  BookMarked,
  Hotel,
  QrCode,
  Stethoscope,
  Map,
  UtensilsCrossed,
  ChefHat,
  BarChart3,
  ScrollText,
  CalendarCheck,
  UserPlus,
  UserCheck,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usePermission } from '@/hooks/usePermission';
import { getAppName, getAppSubtitle, getAppLogo } from '@/lib/page-title';
import {
  getSavedAccounts,
  removeSavedAccount,
  touchSavedAccount,
  upsertSavedAccount,
  type SavedAuthAccount,
} from '@/lib/saved-accounts';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DASHBOARD_ACCESS_PERMISSIONS } from '@/pages/dashboard/config';

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  permission?: string;
  exact?: boolean;
  submenu?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    path: '/front-office',
    label: 'Front Office',
    icon: Users,
    submenu: [
      { path: '/queues', label: 'Antrean', icon: ClipboardList, permission: 'queues.view' },
      { path: '/checkin', label: 'Check-In Scanner', icon: QrCode, permission: 'registrations.checkin' },
      { path: '/registrations', label: 'Pendaftaran', icon: UserRound, permission: 'registrations.view' },
      { path: '/visits', label: 'Kunjungan', icon: Activity, permission: 'visits.view' },
      { path: '/billing', label: 'Kasir & Billing', icon: Receipt, permission: 'billing.view' },
    ]
  },
  {
    path: '/room-management',
    label: 'Manajemen Ruangan',
    icon: Hotel,
    permission: 'rooms.view',
    submenu: [
      { path: '/bed-monitoring', label: 'Monitoring Bed', icon: Hotel, permission: 'rooms.view' },
      { path: '/floor-plan', label: 'Floor Plan', icon: Map, permission: 'rooms.view' },
    ]
  },
  {
    path: '/eklaim',
    label: 'E-Klaim',
    icon: FileCheck,
    submenu: [
      { path: '/eklaim', label: 'Dashboard', icon: Monitor, permission: 'eklaim.view', exact: true },
      { path: '/eklaim/list-sep', label: 'List SEP', icon: FileText, permission: 'eklaim.view' },
      { path: '/eklaim/data-klaim', label: 'Data Klaim', icon: FileCheck, permission: 'eklaim.view' },
      { path: '/eklaim/report', label: 'Laporan', icon: BarChart3, permission: 'eklaim.view' },
      { path: '/eklaim/log', label: 'Log', icon: ScrollText, permission: 'eklaim.view' },
    ]
  },
  {
    path: '/logistics',
    label: 'Logistik',
    icon: Send,
    submenu: [
      { path: '/medicines', label: 'Master Obat', icon: Pill, permission: 'medicines.view' },
      { path: '/inventories', label: 'Master Inventaris', icon: Package, permission: 'inventories.view' },
      { path: '/suppliers', label: 'Master Supplier', icon: Truck, permission: 'suppliers.view' },
      { path: '/stock-requests', label: 'Permintaan Stok', icon: FileText, permission: 'stock_requests.view' },
      { path: '/distributions', label: 'Distribusi', icon: Send, permission: 'distributions.view' },
      { path: '/purchases', label: 'Pembelian', icon: ShoppingCart, permission: 'purchases.view' },
      { path: '/stock-opname', label: 'Stock Opname', icon: ClipboardList, permission: 'stock_opname.view' },
      { path: '/room-stock/medicines', label: 'Stok Obat Ruangan', icon: Pill, permission: 'room-medicines.view' },
      { path: '/room-stock/inventories', label: 'Stok Inventaris Ruangan', icon: Package, permission: 'room-inventories.view' },
    ]
  },
  {
    path: '/nutrition',
    label: 'Gizi',
    icon: UtensilsCrossed,
    submenu: [
      { path: '/nutrition/menus', label: 'Menu Makanan', icon: UtensilsCrossed },
      { path: '/nutrition/meal-packages', label: 'Paket Makanan', icon: Package },
      { path: '/nutrition/kitchen', label: 'Dapur', icon: ChefHat },
    ]
  },
  {
    path: '/reports',
    label: 'Laporan',
    icon: BarChart3,
    permission: 'dashboard.view',
  },
  {
    path: '/master',
    label: 'Master Data',
    icon: Building2,
    submenu: [
      { path: '/patients', label: 'Pasien', icon: UserRound, permission: 'patients.view' },
      { path: '/employees', label: 'Pegawai', icon: UserCog, permission: 'employees.view' },
      { path: '/rooms', label: 'Ruangan', icon: BedDouble, permission: 'rooms.view' },
      { path: '/buildings', label: 'Gedung', icon: Building2, permission: 'rooms.view' },
      { path: '/counters', label: 'Loket', icon: Monitor, permission: 'counters.view' },
      { path: '/ppk', label: 'Master PPK', icon: Building2, permission: 'master_data.view' },
      { path: '/procedures', label: 'Tindakan', icon: Syringe, permission: 'procedures.view' },
      { path: '/clinical-packages', label: 'Paket Klinis', icon: Package, permission: 'master_data.view' },
      { path: '/icd', label: 'Kode ICD', icon: BookMarked },
      { path: '/regions', label: 'Wilayah', icon: MapPin, permission: 'regions.view' },
      { path: '/master-data', label: 'Referensi Data', icon: Database },
    ]
  },
  {
    path: '/bpjs',
    label: 'BPJS',
    icon: Building2,
    permission: 'integrations.view',
    submenu: [
      { path: '/bpjs/tools', label: 'Tools', icon: Settings, permission: 'integrations.view' },
      { path: '/bpjs/aplicare', label: 'Aplicare', icon: BedDouble, permission: 'integrations.view' },
      { path: '/bpjs/mapping', label: 'Mapping Poli & Dokter', icon: Building2, permission: 'integrations.view' },
      { path: '/bpjs/queue-monitoring', label: 'Monitoring Antrian', icon: Activity, permission: 'integrations.view' },
      { path: '/bpjs/spri-monitoring', label: 'Monitoring SPRI', icon: FileText, permission: 'integrations.view' },
      { path: '/bpjs/surat-kontrol-monitoring', label: 'Monitoring Surat Kontrol', icon: CalendarCheck, permission: 'integrations.view' },
      { path: '/bpjs/logs', label: 'Log API', icon: FileSearch, permission: 'integrations.view' },
      { path: '/bpjs/api-tester', label: 'API Tester', icon: Send, permission: 'integrations.view' },
    ]
  },
  {
    path: '/integrations',
    label: 'Integrasi',
    icon: Stethoscope,
    permission: 'integrations.view',
    submenu: [
      { path: '/integrations/satusehat', label: 'Monitoring SatuSehat', icon: Activity, permission: 'integrations.view' },
      { path: '/integrations/satusehat/send', label: 'Kirim Data SatuSehat', icon: Send, permission: 'integrations.manage' },
      { path: '/integrations/satusehat/logs', label: 'Log SatuSehat', icon: FileSearch, permission: 'integrations.view' },
    ]
  },
  {
    path: '/settings',
    label: 'Pengaturan',
    icon: Settings,
    permission: 'users.view',
    submenu: [
      { path: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { path: '/roles', label: 'Roles', icon: Shield, permission: 'roles.view' },
      { path: '/permissions', label: 'Permissions', icon: Lock, permission: 'permissions.view' },
      { path: '/integrations/config', label: 'Konfigurasi Sistem', icon: Settings, permission: 'integrations.view' },
    ]
  },
];

function matchesPath(pathname: string, menuPath: string, exact?: boolean): boolean {
  const baseMenuPath = menuPath.split('?')[0];
  if (exact) return pathname === baseMenuPath;
  if (pathname === baseMenuPath) return true;
  return pathname.startsWith(`${baseMenuPath}/`);
}

function getRequiredPermissionForPath(pathname: string): string | null {
  const candidates: Array<{ path: string; permission: string; exact?: boolean }> = [];

  menuItems.forEach((item) => {
    if (item.permission) {
      candidates.push({ path: item.path, permission: item.permission, exact: item.exact });
    }
    (item.submenu || []).forEach((sub) => {
      if (sub.permission) {
        candidates.push({ path: sub.path, permission: sub.permission, exact: sub.exact });
      }
    });
  });

  const matched = candidates
    .filter((candidate) => matchesPath(pathname, candidate.path, candidate.exact))
    .sort((a, b) => b.path.length - a.path.length);

  return matched[0]?.permission || null;
}

function userHasPermission(user: SavedAuthAccount['user'], permission: string): boolean {
  return !!user.role?.permissions?.some((p) => p.name === permission);
}

function hasAnySavedUserPermission(user: SavedAuthAccount['user'], permissions: string[]): boolean {
  return permissions.some((permission) => userHasPermission(user, permission));
}

function hasDashboardMenuAccess(hasPermission: (permission: string) => boolean): boolean {
  return DASHBOARD_ACCESS_PERMISSIONS.some((permission) => hasPermission(permission));
}

function hasMenuItemAccess(item: MenuItem, hasPermission: (permission: string) => boolean): boolean {
  if (item.path === '/dashboard') {
    return hasDashboardMenuAccess(hasPermission);
  }

  if (!item.permission) {
    return true;
  }

  return hasPermission(item.permission);
}

// Tree child item
function TreeChild({
  item,
  isActive,
}: {
  item: MenuItem;
  isLast: boolean;
  isActive: boolean;
}) {
  return (
    <li>
      <Link
        to={item.path}
        className={cn(
          "group/child flex items-center gap-2.5 rounded-md py-1.5 pl-4 pr-2 text-[13px] transition-all",
          isActive
            ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-2 border-transparent"
        )}
      >
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

// Tree parent group with children
function TreeParent({
  item,
  isPathActive,
  location,
  hasPermission,
  isCollapsed,
}: {
  item: MenuItem;
  isPathActive: (currentPath: string, menuPath: string) => boolean;
  location: { pathname: string };
  hasPermission: (permission: string) => boolean;
  isCollapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive = isPathActive(location.pathname, item.path) ||
    (item.submenu?.some(sub => isPathActive(location.pathname, sub.path)) ?? false);

  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const visibleSubmenu = item.submenu?.filter(sub => {
    return hasMenuItemAccess(sub, hasPermission);
  }) ?? [];

  // Collapsed sidebar: icon with dropdown
  if (isCollapsed) {
    return (
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent side="right" align="start" className="min-w-[210px] p-1.5">
          {/* Group header */}
          <div className="flex items-center gap-2 px-2.5 py-2 mb-1">
            <div className={cn(
              "flex size-6 items-center justify-center rounded-md",
              isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="size-3.5" />
            </div>
            <span className="text-sm font-semibold">{item.label}</span>
          </div>
          <div className="-mx-1.5 mb-1.5 h-px bg-border" />
          {/* Submenu items */}
          {visibleSubmenu.map(subItem => {
            const SubIcon = subItem.icon;
            const isSubActive = subItem.exact ? location.pathname === subItem.path : isPathActive(location.pathname, subItem.path);
            return (
              <DropdownMenuItem key={subItem.path} asChild className="py-0 px-0">
                <Link
                  to={subItem.path}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isSubActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <SubIcon className={cn(
                    "size-4 shrink-0",
                    isSubActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span>{subItem.label}</span>
                  {isSubActive && <div className="ml-auto size-1.5 rounded-full bg-primary" />}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Expanded sidebar: tree
  return (
    <li>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "text-primary font-semibold"
        )}
      >
        <div className={cn(
          "flex size-6 items-center justify-center rounded-md shrink-0 transition-colors",
          isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70"
        )}>
          <Icon className="size-3.5" />
        </div>
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
            !expanded && "-rotate-90"
          )}
        />
      </button>

      {/* Tree children with animation */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}>
        <ul className="overflow-hidden pl-2 pt-0.5 pb-1">
          {visibleSubmenu.map((subItem, idx) => (
            <TreeChild
              key={subItem.path}
              item={subItem}
              isLast={idx === visibleSubmenu.length - 1}
              isActive={subItem.exact ? location.pathname === subItem.path : isPathActive(location.pathname, subItem.path)}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { user, token, login, logout } = useAuthStore();
  const { state } = useSidebar();
  const { hasPermission } = usePermission();
  const [savedAccounts, setSavedAccounts] = useState<SavedAuthAccount[]>([]);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [switchingAccountKey, setSwitchingAccountKey] = useState<string | null>(null);
  const [savingCurrentAccount, setSavingCurrentAccount] = useState(false);
  const [accountActionProgress, setAccountActionProgress] = useState(18);
  const [appName, setAppName] = useState(getAppName());
  const [appSubtitle, setAppSubtitle] = useState(getAppSubtitle());
  const [appLogo, setAppLogo] = useState(getAppLogo());

  const isAccountActionLoading = savingCurrentAccount || !!switchingAccountKey;

  const refreshSavedAccounts = () => {
    setSavedAccounts(getSavedAccounts());
  };

  useEffect(() => {
    const handleStorageChange = () => {
      setAppName(getAppName());
      setAppSubtitle(getAppSubtitle());
      setAppLogo(getAppLogo());
      refreshSavedAccounts();
    };
    window.addEventListener('storage', handleStorageChange);
    refreshSavedAccounts();
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!isAccountActionLoading) {
      setAccountActionProgress(18);
      return;
    }

    const interval = window.setInterval(() => {
      setAccountActionProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 12) + 6;
        return next >= 92 ? 24 : next;
      });
    }, 220);

    return () => window.clearInterval(interval);
  }, [isAccountActionLoading]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleSaveCurrentAccount = async () => {
    if (!token || !user) return;
    setSavingCurrentAccount(true);
    upsertSavedAccount(token, user);
    refreshSavedAccounts();
    await new Promise((resolve) => setTimeout(resolve, 250));
    setSavingCurrentAccount(false);
  };

  const handleQuickSwitch = async (account: SavedAuthAccount) => {
    if (switchingAccountKey) return;

    setSwitchingAccountKey(account.key);
    const requiredPermission = getRequiredPermissionForPath(location.pathname);
    const canStayOnCurrentPage = location.pathname === '/dashboard'
      ? hasAnySavedUserPermission(account.user, DASHBOARD_ACCESS_PERMISSIONS)
      : !requiredPermission || userHasPermission(account.user, requiredPermission);

    login(account.token, account.user);
    touchSavedAccount(account.key);
    refreshSavedAccounts();
    setShowAccountSwitcher(false);
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (canStayOnCurrentPage) {
      window.location.href = `${location.pathname}${location.search}${location.hash}`;
      return;
    }

    window.location.href = '/dashboard';
  };

  const handleRemoveSavedAccount = (accountKey: string) => {
    removeSavedAccount(accountKey);
    refreshSavedAccounts();
  };

  const isPathActive = (currentPath: string, menuPath: string) => {
    const baseMenuPath = menuPath.split('?')[0];
    if (currentPath === baseMenuPath) return true;
    return currentPath.startsWith(baseMenuPath + '/');
  };

  const isCollapsed = state === 'collapsed';

  const visibleMenuItems = menuItems.filter(item => {
    if (item.submenu) {
      return item.submenu.some(sub => hasMenuItemAccess(sub, hasPermission));
    }
    return hasMenuItemAccess(item, hasPermission);
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[state=open]:bg-transparent hover:bg-transparent">
              <button
                type="button"
                onClick={() => {
                  refreshSavedAccounts();
                  setShowAccountSwitcher(true);
                }}
                className="font-semibold text-left"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground overflow-hidden shrink-0">
                  {appLogo ? (
                    <img
                      src={appLogo.startsWith('http') ? appLogo : `${(import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '')}${appLogo}`}
                      alt="Logo"
                      className="size-8 object-contain"
                    />
                  ) : (
                    <Building2 className="size-4" />
                  )}
                </div>
                <div className="flex flex-col gap-0 leading-none overflow-hidden group-data-[collapsible=icon]:hidden">
                  <span className="font-bold text-sm tracking-tight truncate">{appName}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{appSubtitle}</span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {isCollapsed ? (
          /* Collapsed: icon-only mode with tooltips & dropdowns */
          <div className="flex flex-col items-center gap-1 px-1.5 py-2">
            {visibleMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = isPathActive(location.pathname, item.path) ||
                (item.submenu?.some(sub => isPathActive(location.pathname, sub.path)) ?? false);

              if (item.submenu) {
                return (
                  <TreeParent
                    key={item.path}
                    item={item}
                    isPathActive={isPathActive}
                    location={location}
                    hasPermission={hasPermission}
                    isCollapsed={true}
                  />
                );
              }

              return (
                <TooltipProvider key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md transition-colors",
                          isActive
                            ? "bg-foreground text-background shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ) : (
          /* Expanded: tree view */
          <div className="px-3 py-2">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
              Navigasi
            </p>
            <ul className="flex flex-col gap-0.5">
              {visibleMenuItems.map(item => {
                const Icon = item.icon;
                const isActive = isPathActive(location.pathname, item.path) ||
                  (item.submenu?.some(sub => isPathActive(location.pathname, sub.path)) ?? false);

                if (item.submenu) {
                  return (
                    <TreeParent
                      key={item.path}
                      item={item}
                      isPathActive={isPathActive}
                      location={location}
                      hasPermission={hasPermission}
                      isCollapsed={false}
                    />
                  );
                }

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-[7px]"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <div className={cn(
                        "flex size-6 items-center justify-center rounded-md shrink-0 transition-colors",
                        isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70"
                      )}>
                        <Icon className="size-3.5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent/80">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-sm shadow-sm">
                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                    <span className="font-semibold text-sm truncate">{user?.full_name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{user?.role?.name || user?.email}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width] p-1.5">
                <div className="px-2 py-1.5 mb-1">
                  <p className="text-sm font-semibold truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="-mx-1.5 mb-1 h-px bg-border" />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="gap-2.5">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>Profil Akun</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="gap-2.5">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Pengaturan</span>
                  </Link>
                </DropdownMenuItem>
                <div className="-mx-1.5 my-1 h-px bg-border" />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive gap-2.5 focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <Dialog open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher}>
        <DialogContent className="sm:max-w-lg overflow-hidden">
          {isAccountActionLoading && (
            <div className="absolute inset-x-0 top-0 z-10">
              <Progress value={accountActionProgress} className="h-1 rounded-none bg-primary/15" />
            </div>
          )}
          <DialogHeader>
            <DialogTitle>Pilih Akun</DialogTitle>
            <DialogDescription>
              Klik akun tersimpan untuk langsung masuk tanpa login ulang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={handleSaveCurrentAccount}
              disabled={savingCurrentAccount || !!switchingAccountKey}
            >
              {savingCurrentAccount ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {savingCurrentAccount ? 'Menyimpan akun...' : 'Simpan akun aktif saat ini'}
            </Button>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {savedAccounts.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada akun tersimpan.
                </div>
              )}

              {savedAccounts.map((account) => (
                <div key={account.key} className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm font-medium">{account.user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.user.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickSwitch(account)}
                      disabled={!!switchingAccountKey}
                    >
                      {switchingAccountKey === account.key ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                      )}
                      {switchingAccountKey === account.key ? 'Memproses...' : 'Pilih'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!!switchingAccountKey}
                      onClick={() => handleRemoveSavedAccount(account.key)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
