import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
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
  'users': 'Users',
  'roles': 'Roles',
  'permissions': 'Permissions',
  'settings': 'Pengaturan',
  'account': 'Account',
  'employees': 'Pegawai',
  'regions': 'Wilayah',
  'provinces': 'Provinsi',
  'regencies': 'Kabupaten/Kota',
  'districts': 'Kecamatan',
  'villages': 'Desa/Kelurahan',
  'visits': 'Kunjungan',
  'billing': 'Kasir & Billing',
  'patients': 'Pasien',
  'registrations': 'Pendaftaran',
  'medical-records': 'Rekam Medis',
  'create': 'Tambah',
  'edit': 'Edit',
  'room-management': 'Manajemen Ruangan',
  'bed-monitoring': 'Monitoring Bed',
  'floor-plan': 'Floor Plan',
  'logistics': 'Logistik',
  'medicines': 'Obat',
  'inventories': 'Inventaris',
  'suppliers': 'Supplier',
  'payables': 'Hutang Supplier',
  'front-office': 'Front Office',
  'eklaim': 'E-Klaim',
  'master': 'Master Data',
  'bpjs': 'BPJS',
  'integrations': 'Integrasi',
  'reports': 'Laporan',
};

// Check if segment looks like an ID (numeric or uuid-like)
const isIdSegment = (segment: string): boolean => {
  // Check if it's a number
  if (/^\d+$/.test(segment)) return true;
  // Check if it's a UUID
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
    { label: 'Home', path: '/' },
  ];

  let currentPath = '';
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    currentPath += `/${segment}`;
    
    // Skip ID segments - don't add them to breadcrumbs
    if (isIdSegment(segment)) {
      continue;
    }
    
    // Get label from mapping or capitalize
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label, path: currentPath });
  }

  // Append extra segments from context override
  if (override?.extraSegments) {
    for (const seg of override.extraSegments) {
      breadcrumbs.push({ label: seg.label, path: seg.path || currentPath });
    }
  }

  const handleBreadcrumbClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 px-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="h-7 w-7 shrink-0 rounded-md" />
        <nav className="flex items-center gap-1 min-w-0 overflow-hidden">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <div key={crumb.path + index} className="flex items-center gap-1 min-w-0">
                {index > 0 && (
                  <svg className="h-4 w-4 shrink-0 text-muted-foreground/30" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {isLast ? (
                  <span className="inline-flex items-center h-7 px-2.5 text-xs font-medium text-primary-foreground bg-primary rounded-md truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    onClick={(e) => handleBreadcrumbClick(e, crumb.path)}
                    className="inline-flex items-center h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors truncate"
                  >
                    {crumb.label}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      
      {/* Patient Search */}
      {hasPermission('patients.view') && (
        <div className="hidden md:flex items-center">
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
                  className="h-8 w-8 rounded-full"
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
          className="h-8 w-8 rounded-full"
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
