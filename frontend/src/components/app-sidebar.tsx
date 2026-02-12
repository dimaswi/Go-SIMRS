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
  Archive,
  Circle,
  Map,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usePermission } from '@/hooks/usePermission';
import { getAppName, getAppSubtitle, getAppLogo } from '@/lib/page-title';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  permission?: string;
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
      { path: '/admisi', label: 'Permintaan Rawat Inap', icon: BedDouble, permission: 'registrations.view' },
      { path: '/visits', label: 'Kunjungan', icon: Activity, permission: 'visits.view' },
      { path: '/billing', label: 'Kasir & Billing', icon: Receipt, permission: 'billing.view' },
      { path: '/eklaim', label: 'E-Klaim BPJS', icon: FileCheck, permission: 'eklaim.view' },
    ]
  },
  { path: '/bed-monitoring', label: 'Monitoring Bed', icon: Hotel, permission: 'rooms.view' },
  { path: '/floor-plan', label: 'Floor Plan', icon: Map, permission: 'rooms.view' },
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
      { path: '/inventories', label: 'Inventaris', icon: Package, permission: 'inventories.view' },
      { path: '/medicines', label: 'Obat', icon: Pill, permission: 'medicines.view' },
      { path: '/procedures', label: 'Tindakan', icon: Syringe, permission: 'procedures.view' },
      { path: '/icd', label: 'Kode ICD', icon: BookMarked },
      { path: '/regions', label: 'Wilayah', icon: MapPin },
      { path: '/master-data', label: 'Referensi Data', icon: Database },
    ]
  },
  {
    path: '/logistics',
    label: 'Logistik',
    icon: Send,
    submenu: [
      { path: '/stock-requests', label: 'Permintaan Stok', icon: FileText, permission: 'stock_requests.view' },
      { path: '/distributions', label: 'Distribusi', icon: Send, permission: 'distributions.view' },
      { path: '/purchases', label: 'Pembelian', icon: ShoppingCart, permission: 'purchases.view' },
      { path: '/stock-opname', label: 'Stock Opname', icon: ClipboardList, permission: 'stock_opname.view' },
      { path: '/suppliers', label: 'Supplier', icon: Truck, permission: 'suppliers.view' },
      { path: '/room-stock/medicines', label: 'Stok Obat Ruangan', icon: Pill, permission: 'room-medicines.view' },
      { path: '/room-stock/inventories', label: 'Stok Inventaris Ruangan', icon: Package, permission: 'room-inventories.view' },
    ]
  },
  { path: '/archives', label: 'Arsip Rekam Medis', icon: Archive, permission: 'archives.view' },
  { path: '/quality-cost', label: 'Kendali Mutu & Biaya', icon: Activity, permission: 'dashboard.view' },
  {
    path: '/users',
    label: 'User Management',
    icon: Users,
    permission: 'users.view',
    submenu: [
      { path: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { path: '/roles', label: 'Roles', icon: Shield, permission: 'roles.view' },
      { path: '/permissions', label: 'Permissions', icon: Lock, permission: 'permissions.view' },
    ]
  },
  {
    path: '/bpjs',
    label: 'BPJS',
    icon: Building2,
    permission: 'integrations.view',
    submenu: [
      { path: '/bpjs/tools', label: 'Tools', icon: Settings, permission: 'integrations.view' },
      { path: '/bpjs/mapping', label: 'Mapping Poli & Dokter', icon: Building2, permission: 'integrations.view' },
      { path: '/bpjs/queue-monitoring', label: 'Monitoring Antrian', icon: Activity, permission: 'integrations.view' },
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
      { path: '/integrations/config', label: 'Konfigurasi', icon: Settings, permission: 'integrations.view' },
      { path: '/integrations/satusehat', label: 'Monitoring SatuSehat', icon: Activity, permission: 'integrations.view' },
      { path: '/integrations/satusehat/send', label: 'Kirim Data SatuSehat', icon: Send, permission: 'integrations.manage' },
      { path: '/integrations/satusehat/logs', label: 'Log SatuSehat', icon: FileSearch, permission: 'integrations.view' },
    ]
  },
];

// Tree child item
function TreeChild({
  item,
  isLast,
  isActive,
}: {
  item: MenuItem;
  isLast: boolean;
  isActive: boolean;
}) {
  return (
    <li className="relative flex items-stretch">
      {/* Tree connector lines */}
      <div className="relative flex w-6 shrink-0 items-center justify-center">
        {/* Vertical line */}
        <div className={cn(
          "absolute left-[11px] top-0 w-px bg-sidebar-border",
          isLast ? "h-1/2" : "h-full"
        )} />
        {/* Horizontal line */}
        <div className="absolute left-[11px] top-1/2 h-px w-[13px] bg-sidebar-border" />
      </div>

      {/* Menu item */}
      <Link
        to={item.path}
        className={cn(
          "group/child flex flex-1 items-center gap-2.5 rounded-md py-1.5 px-2 text-[13px] transition-all",
          isActive
            ? "bg-foreground text-background font-medium shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Circle className={cn(
          "size-[5px] shrink-0 transition-colors",
          isActive
            ? "fill-background text-background"
            : "fill-sidebar-foreground/30 text-sidebar-foreground/30 group-hover/child:fill-sidebar-foreground/60 group-hover/child:text-sidebar-foreground/60"
        )} />
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
    if (!sub.permission) return true;
    return hasPermission(sub.permission);
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
                      ? "bg-foreground text-background shadow-sm"
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
        <DropdownMenuContent side="right" align="start" className="min-w-[200px]">
          {/* Group header */}
          <div className="flex items-center gap-2 px-2 py-2">
            <Icon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{item.label}</span>
          </div>
          <div className="-mx-1 mb-1 h-px bg-border" />
          {/* Submenu items */}
          {visibleSubmenu.map(subItem => {
            const SubIcon = subItem.icon;
            const isSubActive = isPathActive(location.pathname, subItem.path);
            return (
              <DropdownMenuItem key={subItem.path} asChild className="py-0 px-0">
                <Link
                  to={subItem.path}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-sm",
                    isSubActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-foreground/80"
                  )}
                >
                  <SubIcon className={cn(
                    "size-4 shrink-0",
                    isSubActive ? "text-foreground" : "text-muted-foreground"
                  )} />
                  <span>{subItem.label}</span>
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
          isActive && "font-semibold text-sidebar-accent-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
            !expanded && "-rotate-90"
          )}
        />
      </button>

      {/* Tree children with animation */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}>
        <ul className="overflow-hidden pl-2">
          {visibleSubmenu.map((subItem, idx) => (
            <TreeChild
              key={subItem.path}
              item={subItem}
              isLast={idx === visibleSubmenu.length - 1}
              isActive={isPathActive(location.pathname, subItem.path)}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { state } = useSidebar();
  const { hasPermission } = usePermission();
  const [appName, setAppName] = useState(getAppName());
  const [appSubtitle, setAppSubtitle] = useState(getAppSubtitle());
  const [appLogo, setAppLogo] = useState(getAppLogo());
  useEffect(() => {
    const handleStorageChange = () => {
      setAppName(getAppName());
      setAppSubtitle(getAppSubtitle());
      setAppLogo(getAppLogo());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const isPathActive = (currentPath: string, menuPath: string) => {
    if (currentPath === menuPath) return true;
    return currentPath.startsWith(menuPath + '/');
  };

  const isCollapsed = state === 'collapsed';

  const visibleMenuItems = menuItems.filter(item => {
    if (item.submenu) {
      return item.submenu.some(sub => {
        if (!sub.permission) return true;
        return hasPermission(sub.permission);
      });
    }
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[state=open]:bg-transparent hover:bg-transparent">
              <a href="/" className="font-semibold">
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
              </a>
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
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Menu
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
                          ? "bg-foreground text-background font-semibold shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
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
                <SidebarMenuButton size="lg">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium">{user?.full_name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem asChild>
                  <Link to="/account">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
