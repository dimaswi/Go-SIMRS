import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Route label mapping for better breadcrumb display
const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'users': 'Users',
  'roles': 'Roles',
  'permissions': 'Permissions',
  'settings': 'Settings',
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
    <header className="flex h-14 shrink-0 items-center gap-2 bg-background px-4 border-b">
      <div className="flex items-center gap-2 flex-1">
        <SidebarTrigger className="h-7 w-7" />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-2">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="text-sm font-medium">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink 
                      href={crumb.path}
                      onClick={(e) => handleBreadcrumbClick(e, crumb.path)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      
      {/* Patient Search */}
      <div className="hidden md:flex items-center">
        <PatientSearch />
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center gap-1">
        {hasPermission('patients.create') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/patients/create')}
                  className="h-8 w-8"
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
        
        {/* Notification Bell */}
        <NotificationBell />
        
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8"
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
