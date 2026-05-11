import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { medicinesApi, roomMedicinesApi, type Medicine, type RoomMedicine } from '@/lib/api/medicines';
import { inventoriesApi, roomInventoriesApi, type Inventory, type RoomInventory } from '@/lib/api/inventories';
import suppliersApi, { type Supplier } from '@/lib/api/suppliers';
import {
  distributionsApi,
  purchasesApi,
  purchasePaymentStatusLabels,
  purchaseStatusLabels,
  stockOpnameApi,
  stockOpnameStatusLabels,
  stockRequestStatusLabels,
  stockRequestsApi,
  type Purchase,
  type StockDistribution,
  type StockOpname,
  type StockRequest,
} from '@/lib/api/stock-requests';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  Package,
  Pill,
  RefreshCw,
  Send,
  ShoppingCart,
  Truck,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const LOGISTICS_ACCESS_PERMISSIONS = [
  'medicines.view',
  'inventories.view',
  'suppliers.view',
  'stock_requests.view',
  'distributions.view',
  'purchases.view',
  'stock_opname.view',
  'room-medicines.view',
  'room-inventories.view',
];

const FLAT_CARD_CLASS = 'rounded-none border-border/70 shadow-none';
const DASHBOARD_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';

interface ActivityItem {
  id: string;
  type: 'purchase' | 'request' | 'distribution' | 'opname';
  title: string;
  description: string;
  status: string;
  date: string;
  href: string;
}

interface PriorityItem {
  id: string;
  label: string;
  value: number;
  helper: string;
  href: string;
  tone: 'critical' | 'warning' | 'info';
}

interface StockRiskItem {
  id: string;
  name: string;
  code: string;
  current: number;
  minimum: number;
  location?: string;
  href: string;
}

interface SupplierExposureItem {
  supplierKey: string;
  supplierName: string;
  totalOutstanding: number;
  overdueCount: number;
  purchaseCount: number;
  latestDueDate?: string;
}

type PeriodFilter = '7d' | '30d' | '90d';

interface TrendPoint {
  date: string;
  requests: number;
  purchases: number;
  distributions: number;
}

interface RankedItem {
  name: string;
  value: number;
  helper: string;
}

function DashboardShellCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn(FLAT_CARD_CLASS, className)}>{children}</Card>;
}

function DashboardPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <DashboardShellCard className={cn('overflow-hidden bg-background/95 backdrop-blur', className)}>
      <CardHeader className="border-b border-border/70 bg-muted/10 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{eyebrow}</div>
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            {description ? <CardDescription className="text-xs uppercase tracking-[0.16em]">{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn('p-4 sm:p-5', contentClassName)}>{children}</CardContent>
    </DashboardShellCard>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tintClass,
  iconClass,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof LayoutDashboard;
  tintClass: string;
  iconClass: string;
}) {
  return (
    <DashboardShellCard className="overflow-hidden">
      <CardContent className="p-0">
        <div className={cn('flex items-start justify-between gap-4 px-4 py-4 sm:px-5', tintClass)}>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{title}</div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{detail}</div>
          </div>
          <div className={cn('flex size-10 shrink-0 items-center justify-center border border-current/15 bg-background/70', iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </DashboardShellCard>
  );
}

function DistributionRow({
  label,
  value,
  total,
  fill,
  helper,
}: {
  label: string;
  value: number;
  total: number;
  fill: string;
  helper?: string;
}) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="space-y-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="truncate font-medium">{label}</div>
          {helper ? <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{helper}</div> : null}
        </div>
        <div className="shrink-0 text-right font-semibold">{formatNumber(value)}</div>
      </div>
      <div className="h-2 w-full overflow-hidden bg-muted">
        <div className={cn('h-full transition-all duration-500', fill)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const formatShortDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatChartDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getDateValue = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getDistributionStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    delivered: 'Terkirim',
    received: 'Diterima',
  };

  return labels[status] || status;
};

const getActivityTypeLabel = (type: ActivityItem['type']) => {
  const labels: Record<ActivityItem['type'], string> = {
    purchase: 'Pembelian',
    request: 'Permintaan',
    distribution: 'Distribusi',
    opname: 'Opname',
  };

  return labels[type];
};

const getPriorityToneClasses = (tone: PriorityItem['tone']) => {
  if (tone === 'critical') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
};

const statusTone = (status: string) => {
  const value = status.toLowerCase();
  if (['approved', 'received', 'completed', 'paid'].includes(value)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['partial', 'pending', 'ordered', 'delivered', 'in_progress', 'overdue'].includes(value)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['cancelled', 'rejected'].includes(value)) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

export default function LogisticsDashboardPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [distributions, setDistributions] = useState<StockDistribution[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  const [roomInventories, setRoomInventories] = useState<RoomInventory[]>([]);

  const userPermissionNames = useMemo(
    () => new Set((user?.role?.permissions || []).map((permission) => permission.name)),
    [user],
  );

  const permissionFlags = useMemo(() => ({
    canAccessDashboard: LOGISTICS_ACCESS_PERMISSIONS.some((permission) => userPermissionNames.has(permission)),
    canViewMedicines: userPermissionNames.has('medicines.view'),
    canViewInventories: userPermissionNames.has('inventories.view'),
    canViewSuppliers: userPermissionNames.has('suppliers.view'),
    canViewRequests: userPermissionNames.has('stock_requests.view'),
    canViewDistributions: userPermissionNames.has('distributions.view'),
    canViewPurchases: userPermissionNames.has('purchases.view'),
    canViewStockOpname: userPermissionNames.has('stock_opname.view'),
    canViewRoomMedicines: userPermissionNames.has('room-medicines.view'),
    canViewRoomInventories: userPermissionNames.has('room-inventories.view'),
  }), [userPermissionNames]);

  const canAccessDashboard = permissionFlags.canAccessDashboard;

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!permissionFlags.canAccessDashboard) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [
        medicinesRes,
        inventoriesRes,
        suppliersRes,
        requestsRes,
        distributionsRes,
        purchasesRes,
        opnamesRes,
        roomMedicinesRes,
        roomInventoriesRes,
      ] = await Promise.all([
        permissionFlags.canViewMedicines ? medicinesApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewInventories ? inventoriesApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewSuppliers ? suppliersApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewRequests ? stockRequestsApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewDistributions ? distributionsApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewPurchases ? purchasesApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewStockOpname ? stockOpnameApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewRoomMedicines ? roomMedicinesApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
        permissionFlags.canViewRoomInventories ? roomInventoriesApi.getAll({ limit: 500 }) : Promise.resolve({ data: { data: [] } }),
      ]);

      setMedicines(medicinesRes.data.data || []);
      setInventories(inventoriesRes.data.data || []);
      setSuppliers(suppliersRes.data.data || []);
      setStockRequests(requestsRes.data.data || []);
      setDistributions(distributionsRes.data.data || []);
      setPurchases(purchasesRes.data.data || []);
      setStockOpnames(opnamesRes.data.data || []);
      setRoomMedicines(roomMedicinesRes.data.data || []);
      setRoomInventories(roomInventoriesRes.data.data || []);
      setLastUpdatedAt(new Date());
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat dashboard logistik.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [permissionFlags, toast]);

  useEffect(() => {
    setPageTitle('Dashboard Logistik');
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const activeSuppliers = suppliers.filter((item) => item.is_active !== false);
    const lowMedicineCount = medicines.filter((item) => item.is_active !== false && item.current_stock <= item.min_stock).length;
    const lowInventoryCount = inventories.filter((item) => item.is_active !== false && item.current_stock <= item.min_stock).length;
    const activeRequests = stockRequests.filter((item) => !['completed', 'cancelled', 'rejected'].includes(item.status)).length;
    const pendingDistributions = distributions.filter((item) => item.status !== 'received').length;
    const outstandingPurchases = purchases.filter((item) => item.status !== 'cancelled' && item.remaining_amount > 0);

    return {
      medicineCount: medicines.length,
      inventoryCount: inventories.length,
      activeSuppliers: activeSuppliers.length,
      activeRequests,
      pendingDistributions,
      outstandingPayables: outstandingPurchases.reduce((sum, item) => sum + (item.remaining_amount || 0), 0),
      lowMedicineCount,
      lowInventoryCount,
      totalMedicineStock: roomMedicines.reduce((sum, item) => sum + (item.quantity || 0), 0),
      totalInventoryStock: roomInventories.reduce((sum, item) => sum + (item.quantity || 0), 0),
      lowRoomMedicineCount: roomMedicines.filter((item) => (item.quantity || 0) <= (item.min_quantity || 0)).length,
      lowRoomInventoryCount: roomInventories.filter((item) => (item.quantity || 0) <= (item.min_quantity || 0)).length,
    };
  }, [distributions, inventories, medicines, purchases, roomInventories, roomMedicines, stockRequests, suppliers]);

  const cutoffDate = useMemo(() => {
    const now = startOfDay(new Date());
    const days = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90;
    now.setDate(now.getDate() - (days - 1));
    return now;
  }, [periodFilter]);

  const filteredRequests = useMemo(() => stockRequests.filter((item) => {
    const date = getDateValue(item.request_date || item.created_at);
    return date ? date >= cutoffDate : false;
  }), [cutoffDate, stockRequests]);

  const filteredPurchases = useMemo(() => purchases.filter((item) => {
    const date = getDateValue(item.order_date || item.created_at);
    return date ? date >= cutoffDate : false;
  }), [cutoffDate, purchases]);

  const filteredDistributions = useMemo(() => distributions.filter((item) => {
    const date = getDateValue(item.distribution_date || item.created_at);
    return date ? date >= cutoffDate : false;
  }), [cutoffDate, distributions]);

  const filteredOpnames = useMemo(() => stockOpnames.filter((item) => {
    const date = getDateValue(item.opname_date || item.created_at);
    return date ? date >= cutoffDate : false;
  }), [cutoffDate, stockOpnames]);

  const requestStats = useMemo(() => ({
    total: stockRequests.length,
    pending: stockRequests.filter((item) => item.status === 'pending').length,
    partial: stockRequests.filter((item) => item.status === 'partial').length,
    approved: stockRequests.filter((item) => item.status === 'approved').length,
    completed: stockRequests.filter((item) => item.status === 'completed').length,
    urgent: stockRequests.filter((item) => item.priority === 'urgent').length,
  }), [stockRequests]);

  const purchaseStats = useMemo(() => ({
    total: purchases.length,
    pending: purchases.filter((item) => item.status === 'pending').length,
    ordered: purchases.filter((item) => item.status === 'ordered').length,
    partial: purchases.filter((item) => item.status === 'partial').length,
    received: purchases.filter((item) => item.status === 'received').length,
    overdue: purchases.filter((item) => item.payment_status === 'overdue').length,
  }), [purchases]);

  const distributionStats = useMemo(() => ({
    total: distributions.length,
    pending: distributions.filter((item) => item.status === 'pending').length,
    delivered: distributions.filter((item) => item.status === 'delivered').length,
    received: distributions.filter((item) => item.status === 'received').length,
  }), [distributions]);

  const opnameStats = useMemo(() => ({
    total: stockOpnames.length,
    draft: stockOpnames.filter((item) => item.status === 'draft').length,
    inProgress: stockOpnames.filter((item) => item.status === 'in_progress').length,
    completed: stockOpnames.filter((item) => item.status === 'completed').length,
    approved: stockOpnames.filter((item) => item.status === 'approved').length,
  }), [stockOpnames]);

  const topLowStockMedicines = useMemo<StockRiskItem[]>(() => {
    return medicines
      .filter((item) => item.is_active !== false && item.current_stock <= item.min_stock)
      .sort((left, right) => (left.current_stock - left.min_stock) - (right.current_stock - right.min_stock))
      .slice(0, 5)
      .map((item) => ({
        id: `medicine-${item.id}`,
        name: item.name,
        code: item.code,
        current: item.current_stock,
        minimum: item.min_stock,
        href: `/medicines/${item.id}`,
      }));
  }, [medicines]);

  const topLowStockInventories = useMemo<StockRiskItem[]>(() => {
    return inventories
      .filter((item) => item.is_active !== false && item.current_stock <= item.min_stock)
      .sort((left, right) => (left.current_stock - left.min_stock) - (right.current_stock - right.min_stock))
      .slice(0, 5)
      .map((item) => ({
        id: `inventory-${item.id}`,
        name: item.name,
        code: item.code,
        current: item.current_stock,
        minimum: item.min_stock,
        href: `/inventories/${item.id}`,
      }));
  }, [inventories]);

  const criticalRoomStocks = useMemo<StockRiskItem[]>(() => {
    const medicineRisks = roomMedicines
      .filter((item) => (item.quantity || 0) <= (item.min_quantity || 0))
      .map((item) => ({
        id: `room-medicine-${item.id}`,
        name: item.medicine?.name || 'Obat tanpa nama',
        code: item.medicine?.code || '-',
        current: item.quantity || 0,
        minimum: item.min_quantity || 0,
        location: item.room?.name || '-',
        href: '/room-stock/medicines',
      }));

    const inventoryRisks = roomInventories
      .filter((item) => (item.quantity || 0) <= (item.min_quantity || 0))
      .map((item) => ({
        id: `room-inventory-${item.id}`,
        name: item.inventory?.name || 'Inventaris tanpa nama',
        code: item.inventory?.code || '-',
        current: item.quantity || 0,
        minimum: item.min_quantity || 0,
        location: item.room?.name || '-',
        href: '/room-stock/inventories',
      }));

    return [...medicineRisks, ...inventoryRisks]
      .sort((left, right) => (left.current - left.minimum) - (right.current - right.minimum))
      .slice(0, 6);
  }, [roomInventories, roomMedicines]);

  const supplierExposure = useMemo<SupplierExposureItem[]>(() => {
    const grouped = new Map<string, SupplierExposureItem>();

    purchases
      .filter((item) => item.status !== 'cancelled' && (item.remaining_amount || 0) > 0)
      .forEach((purchase) => {
        const supplierName = purchase.supplier?.name || purchase.supplier_name || 'Supplier tanpa nama';
        const supplierKey = String(purchase.supplier_id || supplierName);
        const current = grouped.get(supplierKey) || {
          supplierKey,
          supplierName,
          totalOutstanding: 0,
          overdueCount: 0,
          purchaseCount: 0,
          latestDueDate: purchase.due_date,
        };

        current.totalOutstanding += purchase.remaining_amount || 0;
        current.purchaseCount += 1;
        if (purchase.payment_status === 'overdue') {
          current.overdueCount += 1;
        }
        if (!current.latestDueDate || (purchase.due_date && new Date(purchase.due_date).getTime() > new Date(current.latestDueDate).getTime())) {
          current.latestDueDate = purchase.due_date;
        }

        grouped.set(supplierKey, current);
      });

    return Array.from(grouped.values())
      .sort((left, right) => right.totalOutstanding - left.totalOutstanding)
      .slice(0, 5);
  }, [purchases]);

  const priorities = useMemo<PriorityItem[]>(() => {
    return [
      {
        id: 'urgent-requests',
        label: 'Permintaan Urgent',
        value: requestStats.urgent,
        helper: 'butuh approval atau distribusi cepat',
        href: '/stock-requests',
        tone: requestStats.urgent > 0 ? 'critical' : 'info',
      },
      {
        id: 'partial-requests',
        label: 'Permintaan Partial',
        value: requestStats.partial,
        helper: 'masih menyisakan approval/distribusi',
        href: '/stock-requests',
        tone: requestStats.partial > 0 ? 'warning' : 'info',
      },
      {
        id: 'pending-distributions',
        label: 'Distribusi Belum Diterima',
        value: distributionStats.pending + distributionStats.delivered,
        helper: 'pengiriman masih di jalur atau belum diterima ruangan',
        href: '/distributions',
        tone: distributionStats.pending + distributionStats.delivered > 0 ? 'warning' : 'info',
      },
      {
        id: 'overdue-purchases',
        label: 'PO Overdue',
        value: purchaseStats.overdue,
        helper: 'hutang supplier melewati jatuh tempo',
        href: '/purchases/payables',
        tone: purchaseStats.overdue > 0 ? 'critical' : 'info',
      },
      {
        id: 'opname-progress',
        label: 'Opname Perlu Ditutup',
        value: opnameStats.inProgress + opnameStats.completed,
        helper: 'stock opname belum approve final',
        href: '/stock-opname',
        tone: opnameStats.inProgress + opnameStats.completed > 0 ? 'warning' : 'info',
      },
      {
        id: 'room-critical',
        label: 'Stok Ruang Kritis',
        value: criticalRoomStocks.length,
        helper: 'ruang dengan stok menyentuh ambang minimum',
        href: '/room-stock/medicines',
        tone: criticalRoomStocks.length > 0 ? 'critical' : 'info',
      },
    ];
  }, [criticalRoomStocks.length, distributionStats.delivered, distributionStats.pending, opnameStats.completed, opnameStats.inProgress, purchaseStats.overdue, requestStats.partial, requestStats.urgent]);

  const recentActivities = useMemo<ActivityItem[]>(() => {
    const purchaseActivities = purchases.map((item) => ({
      id: `purchase-${item.id}`,
      type: 'purchase' as const,
      title: item.purchase_number,
      description: item.supplier?.name || item.supplier_name || 'Pembelian supplier',
      status: purchaseStatusLabels[item.status] || item.status,
      date: item.updated_at || item.created_at,
      href: `/purchases/${item.id}`,
    }));
    const requestActivities = stockRequests.map((item) => ({
      id: `request-${item.id}`,
      type: 'request' as const,
      title: item.request_number,
      description: `${item.from_room?.name || '-'} ke ${item.to_room?.name || '-'}`,
      status: stockRequestStatusLabels[item.status] || item.status,
      date: item.updated_at || item.created_at,
      href: `/stock-requests/${item.id}`,
    }));
    const distributionActivities = distributions.map((item) => ({
      id: `distribution-${item.id}`,
      type: 'distribution' as const,
      title: item.distribution_number,
      description: `${item.from_room?.name || '-'} ke ${item.to_room?.name || '-'}`,
      status: getDistributionStatusLabel(item.status),
      date: item.updated_at || item.created_at,
      href: `/distributions/${item.id}`,
    }));
    const opnameActivities = stockOpnames.map((item) => ({
      id: `opname-${item.id}`,
      type: 'opname' as const,
      title: item.opname_number,
      description: item.room?.name || 'Stock opname ruangan',
      status: stockOpnameStatusLabels[item.status] || item.status,
      date: item.updated_at || item.created_at,
      href: `/stock-opname/${item.id}`,
    }));

    return [...purchaseActivities, ...requestActivities, ...distributionActivities, ...opnameActivities]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 8);
  }, [distributions, purchases, stockOpnames, stockRequests]);

  const trendData = useMemo<TrendPoint[]>(() => {
    const grouped = new Map<string, TrendPoint>();
    const ensurePoint = (key: string) => {
      if (!grouped.has(key)) {
        grouped.set(key, { date: key, requests: 0, purchases: 0, distributions: 0 });
      }
      return grouped.get(key)!;
    };

    filteredRequests.forEach((item) => {
      const date = getDateValue(item.request_date || item.created_at);
      if (!date) return;
      const key = startOfDay(date).toISOString();
      ensurePoint(key).requests += 1;
    });

    filteredPurchases.forEach((item) => {
      const date = getDateValue(item.order_date || item.created_at);
      if (!date) return;
      const key = startOfDay(date).toISOString();
      ensurePoint(key).purchases += 1;
    });

    filteredDistributions.forEach((item) => {
      const date = getDateValue(item.distribution_date || item.created_at);
      if (!date) return;
      const key = startOfDay(date).toISOString();
      ensurePoint(key).distributions += 1;
    });

    return Array.from(grouped.values())
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .map((item) => ({ ...item, date: formatChartDate(item.date) }));
  }, [filteredDistributions, filteredPurchases, filteredRequests]);

  const topRequestRooms = useMemo<RankedItem[]>(() => {
    const grouped = new Map<string, RankedItem>();
    filteredRequests.forEach((item) => {
      const name = item.from_room?.name || 'Ruangan tanpa nama';
      const current = grouped.get(name) || { name, value: 0, helper: 'permintaan' };
      current.value += 1;
      grouped.set(name, current);
    });

    return Array.from(grouped.values()).sort((left, right) => right.value - left.value).slice(0, 5);
  }, [filteredRequests]);

  const topDistributionTargets = useMemo<RankedItem[]>(() => {
    const grouped = new Map<string, RankedItem>();
    filteredDistributions.forEach((item) => {
      const name = item.to_room?.name || 'Ruangan tujuan';
      const qty = item.items?.reduce((sum, distributionItem) => sum + (distributionItem.quantity || 0), 0) || 0;
      const current = grouped.get(name) || { name, value: 0, helper: 'unit didistribusikan' };
      current.value += qty;
      grouped.set(name, current);
    });

    return Array.from(grouped.values()).sort((left, right) => right.value - left.value).slice(0, 5);
  }, [filteredDistributions]);

  const topSuppliersByPurchase = useMemo<RankedItem[]>(() => {
    const grouped = new Map<string, RankedItem>();
    filteredPurchases.forEach((item) => {
      const name = item.supplier?.name || item.supplier_name || 'Supplier tanpa nama';
      const current = grouped.get(name) || { name, value: 0, helper: 'nilai PO' };
      current.value += item.total_amount || 0;
      grouped.set(name, current);
    });

    return Array.from(grouped.values()).sort((left, right) => right.value - left.value).slice(0, 5);
  }, [filteredPurchases]);

  if (!canAccessDashboard) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Dashboard Logistik" description="Ringkasan operasional logistik rumah sakit" />
        <PageContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-none" />)}
          </div>
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell className="overflow-hidden">
      <PageHeader
        title="Dashboard Logistik"
        description="Pantau pembelian, permintaan, distribusi, opname, dan stok logistik dalam satu ringkasan kerja."
        actions={
          <Button size="sm" variant="outline" className="rounded-none" onClick={() => void loadDashboard(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Muat Ulang
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-y-auto space-y-4 pb-8">
        <div className="space-y-4 pb-4" style={{ fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif' }}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-none">Logistik Only</Badge>
          {lastUpdatedAt ? <span>Terakhir diperbarui {formatDateTime(lastUpdatedAt.toISOString())}</span> : null}
          <div className="ml-auto w-[140px] min-w-[140px]">
            <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}>
              <SelectTrigger className="h-8 rounded-none text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="7d">7 Hari</SelectItem>
                <SelectItem value="30d">30 Hari</SelectItem>
                <SelectItem value="90d">90 Hari</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard title="Master Obat" value={formatNumber(metrics.medicineCount)} detail={`${formatNumber(metrics.lowMedicineCount)} stok rendah`} icon={Pill} tintClass="bg-emerald-50/60" iconClass="text-emerald-700" />
          <MetricCard title="Master Inventaris" value={formatNumber(metrics.inventoryCount)} detail={`${formatNumber(metrics.lowInventoryCount)} stok rendah`} icon={Package} tintClass="bg-sky-50/60" iconClass="text-sky-700" />
          <MetricCard title="Supplier Aktif" value={formatNumber(metrics.activeSuppliers)} detail="mitra logistik aktif" icon={Truck} tintClass="bg-amber-50/60" iconClass="text-amber-700" />
          <MetricCard title="Permintaan Aktif" value={formatNumber(metrics.activeRequests)} detail={`${formatNumber(requestStats.urgent)} prioritas urgent`} icon={FileSpreadsheet} tintClass="bg-orange-50/60" iconClass="text-orange-700" />
          <MetricCard title="Distribusi Berjalan" value={formatNumber(metrics.pendingDistributions)} detail={`${formatNumber(distributionStats.delivered)} sudah dikirim`} icon={Send} tintClass="bg-indigo-50/60" iconClass="text-indigo-700" />
          <MetricCard title="Sisa Hutang" value={formatCurrency(metrics.outstandingPayables)} detail={`${formatNumber(purchaseStats.overdue)} sudah overdue`} icon={Wallet} tintClass="bg-rose-50/60" iconClass="text-rose-700" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <DashboardPanel eyebrow="Operasional" title="Status Proses Logistik" description="monitor status kerja inti logistik">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Permintaan Stok</div>
                <DistributionRow label="Menunggu Approval" value={requestStats.pending} total={Math.max(requestStats.total, 1)} fill="bg-amber-500" helper="pending" />
                <DistributionRow label="Disetujui Sebagian" value={requestStats.partial} total={Math.max(requestStats.total, 1)} fill="bg-orange-500" helper="partial" />
                <DistributionRow label="Sudah Disetujui" value={requestStats.approved} total={Math.max(requestStats.total, 1)} fill="bg-emerald-500" helper="approved" />
                <DistributionRow label="Selesai Distribusi" value={requestStats.completed} total={Math.max(requestStats.total, 1)} fill="bg-sky-600" helper="completed" />
              </div>
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Pembelian, Distribusi, Opname</div>
                <DistributionRow label="PO Menunggu Terima" value={purchaseStats.ordered + purchaseStats.partial} total={Math.max(purchaseStats.total, 1)} fill="bg-indigo-500" helper="ordered + partial" />
                <DistributionRow label="Distribusi Pending/Delivered" value={distributionStats.pending + distributionStats.delivered} total={Math.max(distributionStats.total, 1)} fill="bg-violet-500" helper="belum diterima ruangan" />
                <DistributionRow label="Opname Berjalan" value={opnameStats.inProgress + opnameStats.completed} total={Math.max(opnameStats.total, 1)} fill="bg-cyan-600" helper="in progress + completed" />
                <DistributionRow label="PO Overdue" value={purchaseStats.overdue} total={Math.max(purchaseStats.total, 1)} fill="bg-rose-500" helper="butuh tindak lanjut" />
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Stok" title="Persediaan Logistik" description="rekap master dan stok ruang">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-3 text-sm">
                <div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-emerald-700" /><span>Total Stok Obat Ruangan</span></div>
                <Badge variant="outline" className="rounded-none">{formatNumber(metrics.totalMedicineStock)}</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-3 text-sm">
                <div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-sky-700" /><span>Total Stok Inventaris Ruangan</span></div>
                <Badge variant="outline" className="rounded-none">{formatNumber(metrics.totalInventoryStock)}</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-3 text-sm">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-700" /><span>Obat Master Stok Rendah</span></div>
                <Badge className="rounded-none border border-amber-200 bg-amber-50 text-amber-700">{formatNumber(metrics.lowMedicineCount)}</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-3 text-sm">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-700" /><span>Inventaris Master Stok Rendah</span></div>
                <Badge className="rounded-none border border-orange-200 bg-orange-50 text-orange-700">{formatNumber(metrics.lowInventoryCount)}</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-3 text-sm">
                <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-rose-700" /><span>Stok Obat Ruangan Kritis</span></div>
                <Badge className="rounded-none border border-rose-200 bg-rose-50 text-rose-700">{formatNumber(metrics.lowRoomMedicineCount)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-red-700" /><span>Stok Inventaris Ruangan Kritis</span></div>
                <Badge className="rounded-none border border-red-200 bg-red-50 text-red-700">{formatNumber(metrics.lowRoomInventoryCount)}</Badge>
              </div>
            </div>
          </DashboardPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <DashboardPanel eyebrow="Prioritas" title="Tindak Lanjut Hari Ini" description="antrian kerja yang paling butuh perhatian">
            <div className="space-y-2.5">
              {priorities.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="group flex items-start justify-between gap-3 border border-border/70 bg-background px-3 py-3 transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('rounded-none border', getPriorityToneClasses(item.tone))}>{formatNumber(item.value)}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Keuangan" title="Pembelian & Kewajiban" description="nilai transaksi logistik yang masih terbuka">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-border/70 bg-muted/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Total Pembelian</div>
                  <div className="mt-1 text-xl font-semibold">{formatCurrency(purchases.reduce((sum, item) => sum + (item.total_amount || 0), 0))}</div>
                  <div className="mt-1 text-xs text-muted-foreground">semua PO logistik</div>
                </div>
                <div className="border border-border/70 bg-muted/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Sudah Dibayar</div>
                  <div className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(purchases.reduce((sum, item) => sum + (item.paid_amount || 0), 0))}</div>
                  <div className="mt-1 text-xs text-muted-foreground">realisasi pembayaran supplier</div>
                </div>
              </div>
              <DistributionRow label="Pembelian Bayar Sebagian" value={purchases.filter((item) => item.payment_status === 'partial').length} total={Math.max(purchases.length, 1)} fill="bg-amber-500" helper={purchasePaymentStatusLabels.partial} />
              <DistributionRow label="Pembelian Belum Bayar" value={purchases.filter((item) => item.payment_status === 'unpaid').length} total={Math.max(purchases.length, 1)} fill="bg-slate-500" helper={purchasePaymentStatusLabels.unpaid} />
              <DistributionRow label="Pembelian Overdue" value={purchaseStats.overdue} total={Math.max(purchases.length, 1)} fill="bg-rose-500" helper={purchasePaymentStatusLabels.overdue} />
              <div className="border-t border-border/70 pt-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Eksposur Supplier</div>
                <div className="space-y-2">
                  {supplierExposure.length > 0 ? supplierExposure.map((item) => (
                    <div key={item.supplierKey} className="flex items-start justify-between gap-3 border border-border/70 bg-background px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{item.supplierName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.purchaseCount} PO aktif
                          {item.overdueCount > 0 ? ` | ${item.overdueCount} overdue` : ''}
                          {item.latestDueDate ? ` | JT ${formatShortDate(item.latestDueDate)}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold text-foreground">{formatCurrency(item.totalOutstanding)}</div>
                    </div>
                  )) : (
                    <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                      Tidak ada hutang supplier yang masih terbuka.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Akses Cepat" title="Modul Logistik" description="masuk cepat ke area kerja utama">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[
                { href: '/purchases', label: 'Pembelian', icon: ShoppingCart, enabled: permissionFlags.canViewPurchases },
                { href: '/stock-requests', label: 'Permintaan Stok', icon: FileSpreadsheet, enabled: permissionFlags.canViewRequests },
                { href: '/distributions', label: 'Distribusi', icon: Send, enabled: permissionFlags.canViewDistributions },
                { href: '/stock-opname', label: 'Stock Opname', icon: ClipboardCheck, enabled: permissionFlags.canViewStockOpname },
                { href: '/medicines', label: 'Master Obat', icon: Pill, enabled: permissionFlags.canViewMedicines },
                { href: '/inventories', label: 'Master Inventaris', icon: Package, enabled: permissionFlags.canViewInventories },
              ].filter((item) => item.enabled).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} to={item.href} className="group flex items-center justify-between border border-border/70 bg-background px-3 py-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center border border-border/70 bg-muted/20 text-foreground/80"><Icon className="h-4 w-4" /></div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          </DashboardPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
          <DashboardPanel eyebrow="Risiko" title="Obat Stok Rendah" description="master obat yang perlu restock cepat">
            <div className="space-y-2.5">
              {topLowStockMedicines.length > 0 ? topLowStockMedicines.map((item) => (
                <Link key={item.id} to={item.href} className="group flex items-start justify-between gap-3 border border-border/70 bg-background px-3 py-3 transition-colors hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.code}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold text-rose-700">{formatNumber(item.current)}</div>
                    <div className="text-muted-foreground">min {formatNumber(item.minimum)}</div>
                  </div>
                </Link>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Tidak ada obat yang berada di bawah batas minimum.</div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Risiko" title="Inventaris Stok Rendah" description="master inventaris yang mendekati habis">
            <div className="space-y-2.5">
              {topLowStockInventories.length > 0 ? topLowStockInventories.map((item) => (
                <Link key={item.id} to={item.href} className="group flex items-start justify-between gap-3 border border-border/70 bg-background px-3 py-3 transition-colors hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.code}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold text-orange-700">{formatNumber(item.current)}</div>
                    <div className="text-muted-foreground">min {formatNumber(item.minimum)}</div>
                  </div>
                </Link>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Tidak ada inventaris yang berada di bawah batas minimum.</div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Risiko Ruang" title="Ruang Dengan Stok Kritis" description="lokasi yang perlu suplai lanjutan">
            <div className="space-y-2.5">
              {criticalRoomStocks.length > 0 ? criticalRoomStocks.map((item) => (
                <Link key={item.id} to={item.href} className="group flex items-start justify-between gap-3 border border-border/70 bg-background px-3 py-3 transition-colors hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.location || '-'} | {item.code}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold text-rose-700">{formatNumber(item.current)}</div>
                    <div className="text-muted-foreground">min {formatNumber(item.minimum)}</div>
                  </div>
                </Link>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Belum ada ruang yang masuk kategori stok kritis.</div>
              )}
            </div>
          </DashboardPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <DashboardPanel eyebrow="Tren" title="Pergerakan Logistik" description={`aktivitas ${periodFilter === '7d' ? '7 hari' : periodFilter === '30d' ? '30 hari' : '90 hari'} terakhir`}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="logistics-requests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="logistics-purchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="logistics-distributions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#d4d4d8" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                <Area type="monotone" dataKey="requests" name="Permintaan" stroke="#ea580c" fill="url(#logistics-requests)" strokeWidth={2} />
                <Area type="monotone" dataKey="purchases" name="Pembelian" stroke="#7c3aed" fill="url(#logistics-purchases)" strokeWidth={2} />
                <Area type="monotone" dataKey="distributions" name="Distribusi" stroke="#0f766e" fill="url(#logistics-distributions)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </DashboardPanel>

          <DashboardPanel eyebrow="Kinerja" title="Volume Periode Aktif" description="ringkas transaksi operasional per jenis">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[
                { name: 'Permintaan', value: filteredRequests.length },
                { name: 'Pembelian', value: filteredPurchases.length },
                { name: 'Distribusi', value: filteredDistributions.length },
                { name: 'Opname', value: filteredOpnames.length },
              ]}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d4d4d8" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                <Bar dataKey="value" fill="#0f172a" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </DashboardPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <DashboardPanel eyebrow="Ranking" title="Ruangan Paling Aktif Meminta" description="top request origin pada periode aktif">
            <div className="space-y-2.5">
              {topRequestRooms.length > 0 ? topRequestRooms.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between border border-border/70 bg-background px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
                  </div>
                  <Badge variant="outline" className="rounded-none">{formatNumber(item.value)}</Badge>
                </div>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Belum ada permintaan pada periode ini.</div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Ranking" title="Tujuan Distribusi Terbesar" description="ruangan dengan volume kirim tertinggi">
            <div className="space-y-2.5">
              {topDistributionTargets.length > 0 ? topDistributionTargets.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between border border-border/70 bg-background px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
                  </div>
                  <Badge variant="outline" className="rounded-none">{formatNumber(item.value)}</Badge>
                </div>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Belum ada distribusi pada periode ini.</div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel eyebrow="Ranking" title="Supplier Paling Dipakai" description="nilai pembelian terbesar pada periode aktif">
            <div className="space-y-2.5">
              {topSuppliersByPurchase.length > 0 ? topSuppliersByPurchase.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between border border-border/70 bg-background px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>
                  </div>
                  <Badge variant="outline" className="rounded-none">{formatCurrency(item.value)}</Badge>
                </div>
              )) : (
                <div className="border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">Belum ada pembelian pada periode ini.</div>
              )}
            </div>
          </DashboardPanel>
        </div>

        <DashboardPanel eyebrow="Aktivitas" title="Aktivitas Logistik Terbaru" description="timeline pembelian, permintaan, distribusi, dan opname" contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/20">
                  <th className="border-b border-r border-border/70 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Aktivitas</th>
                  <th className="border-b border-r border-border/70 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Deskripsi</th>
                  <th className="border-b border-r border-border/70 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Status</th>
                  <th className="border-b border-r border-border/70 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Waktu</th>
                  <th className="border-b border-border/70 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.length > 0 ? recentActivities.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="border-b border-r border-border/60 px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{getActivityTypeLabel(item.type)}</div>
                    </td>
                    <td className="border-b border-r border-border/60 px-4 py-3 align-top text-muted-foreground">{item.description}</td>
                    <td className="border-b border-r border-border/60 px-4 py-3 align-top">
                      <Badge className={cn('rounded-none border', statusTone(item.status))}>{item.status}</Badge>
                    </td>
                    <td className="border-b border-r border-border/60 px-4 py-3 align-top text-muted-foreground">{formatDateTime(item.date)}</td>
                    <td className="border-b border-border/60 px-4 py-3 align-top">
                      <Button asChild variant="outline" size="sm" className="rounded-none">
                        <Link to={item.href}>Buka</Link>
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada aktivitas logistik yang bisa ditampilkan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
        </div>
      </PageContent>
    </PageShell>
  );
}