import { Fragment, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Moon, Sun, UserPlus } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { PatientSearch } from '@/components/patient-search';
import { NotificationBell } from '@/components/notification-bell';
import { useBreadcrumb } from '@/contexts/breadcrumb-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CashierShiftWidget } from '@/components/layout/cashier-shift-widget';

// Route label mapping for better breadcrumb display
const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'users': 'Daftar User',
  'roles': 'Daftar Role',
  'permissions': 'Daftar Permission',
  'settings': 'Pengaturan',
  'audit-log': 'Audit Log',
  'account': 'Profil Akun',
  'signature-pin': 'PIN Tanda Tangan',
  'employees': 'Pegawai',
  'regions': 'Wilayah',
  'provinces': 'Provinsi',
  'regencies': 'Kabupaten/Kota',
  'districts': 'Kecamatan',
  'villages': 'Desa/Kelurahan',
  'visits': 'Kunjungan',
  'billing': 'Kasir & Billing',
  'payment': 'Pembayaran',
  'patients': 'Master Pasien',
  'patient-search': 'Pencarian Pasien',
  'registrations': 'Pendaftaran',
  'scheduled': 'Terjadwal',
  'admisi': 'Permintaan Rawat Inap',
  'queues': 'Antrean',
  'room-queue': 'Antrean Ruangan',
  'checkin': 'Check-In Scanner',
  'medical-records': 'Rekam Medis',
  'create': 'Tambah',
  'edit': 'Edit',
  'receive': 'Penerimaan',
  'approve': 'Persetujuan',
  'room-management': 'Manajemen Ruangan',
  'bed-monitoring': 'Monitoring Bed',
  'floor-plan': 'Floor Plan',
  'rooms': 'Master Ruangan',
  'buildings': 'Master Gedung',
  'counters': 'Master Loket',
  'ppk': 'Master PPK',
  'procedures': 'Master Tindakan',
  'clinical-packages': 'Paket Tindakan',
  'icd': 'Kode ICD',
  'master-data': 'Referensi Data',
  'category': 'Kategori',
  'logistics': 'Logistik',
  'medicines': 'Master Obat',
  'inventories': 'Master Inventaris',
  'suppliers': 'Master Supplier',
  'stock-requests': 'Permintaan Stok',
  'distributions': 'Distribusi Stok',
  'purchases': 'Pembelian (PO)',
  'payables': 'Hutang Supplier',
  'stock-opname': 'Stock Opname',
  'room-stock': 'Stok Ruangan',
  'nutrition': 'Gizi',
  'menus': 'Menu Makanan',
  'ingredients': 'Master Bahan',
  'invoices': 'Input Faktur Bahan',
  'meal-packages': 'Paket Makanan',
  'kitchen': 'Dapur',
  'front-office': 'Front Office',
  'eklaim': 'E-Klaim',
  'list-sep': 'List SEP',
  'data-klaim': 'Data Klaim',
  'report': 'Laporan',
  'log': 'Log',
  'master': 'Master Data',
  'bpjs': 'BPJS',
  'tools': 'Tools',
  'aplicare': 'Aplicare',
  'queue-monitoring': 'Monitoring Antrean',
  'spri-monitoring': 'Monitoring SPRI',
  'surat-kontrol-monitoring': 'Monitoring SKDP',
  'logs': 'Log API',
  'api-tester': 'API Tester',
  'integrations': 'Integrasi',
  'satusehat': 'SatuSehat',
  'config': 'Konfigurasi Sistem',
  'reports': 'Laporan',
};

// Check if segment looks like an ID (numeric or uuid-like)
const isIdSegment = (segment: string): boolean => {
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  return false;
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { override } = useBreadcrumb();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Generate breadcrumb from current path - skip ID segments
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; path: string }[] = [
    { label: 'SIMRS', path: '/dashboard' },
  ];

  let currentPath = '';
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    currentPath += `/${segment}`;

    if (isIdSegment(segment)) {
      if (i === pathSegments.length - 1 && !override?.extraSegments?.length) {
        breadcrumbs.push({ label: 'Detail', path: currentPath });
      }
      continue;
    }

    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label, path: currentPath });
  }

  // Append extra segments from context override
  if (override?.extraSegments) {
    for (const seg of override.extraSegments) {
      breadcrumbs.push({ label: seg.label, path: seg.path || currentPath });
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border/50 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4 bg-background">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={crumb.path + index}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.path}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Patient Search */}
      {hasPermission('patients.view') && (
        <div className="hidden md:flex items-center mr-2">
          <PatientSearch />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        {hasPermission('patients.create') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/patients/create')}
                  className="h-8 w-8 rounded-none"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="sr-only">Registrasi Pasien Baru</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Registrasi Pasien Baru</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Cashier Shift Widget */}
        <CashierShiftWidget />

        {/* Notification Bell */}
        <NotificationBell />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 rounded-none"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
