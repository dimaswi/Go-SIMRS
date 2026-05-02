import {
  Activity,
  BarChart3,
  Bed,
  Building2,
  FileCheck,
  Hotel,
  Lock,
  Pill,
  Receipt,
  Send,
  Settings,
  Shield,
  Stethoscope,
  Syringe,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type DashboardPermissionKey = 'overview' | 'frontOffice' | 'billing' | 'rooms' | 'pharmacy' | 'procedures';

export const DASHBOARD_PERMISSION_GROUPS: Record<DashboardPermissionKey, string[]> = {
  overview: ['dashboard.view'],
  frontOffice: ['registrations.view', 'visits.view', 'queues.view'],
  billing: ['billing.view'],
  rooms: ['rooms.view'],
  pharmacy: ['medicines.view', 'room-medicines.view'],
  procedures: ['procedures.view', 'lab_requests.view', 'radiology_requests.view', 'visits.view'],
};

export const DASHBOARD_ACCESS_PERMISSIONS = Array.from(
  new Set(Object.values(DASHBOARD_PERMISSION_GROUPS).flat()),
);

export interface DashboardWorkspaceConfig {
  key: string;
  title: string;
  description: string;
  href: string;
  permissions: string[];
  icon: LucideIcon;
  tintClass: string;
  iconClass: string;
}

export const DASHBOARD_WORKSPACES: DashboardWorkspaceConfig[] = [
  {
    key: 'front-office',
    title: 'Front Office',
    description: 'Antrean, pendaftaran, dan kunjungan pasien.',
    href: '/registrations',
    permissions: ['queues.view', 'registrations.view', 'visits.view'],
    icon: Users,
    tintClass: 'bg-cyan-50',
    iconClass: 'text-cyan-700',
  },
  {
    key: 'billing',
    title: 'Billing',
    description: 'Kasir, tagihan, dan pendapatan berjalan.',
    href: '/billing',
    permissions: ['billing.view'],
    icon: Receipt,
    tintClass: 'bg-rose-50',
    iconClass: 'text-rose-700',
  },
  {
    key: 'rooms',
    title: 'Manajemen Ruangan',
    description: 'Bed monitoring, floor plan, dan kapasitas ruang.',
    href: '/bed-monitoring',
    permissions: ['rooms.view'],
    icon: Hotel,
    tintClass: 'bg-slate-100',
    iconClass: 'text-slate-700',
  },
  {
    key: 'pharmacy',
    title: 'Farmasi',
    description: 'Master obat dan stok obat ruangan.',
    href: '/medicines',
    permissions: ['medicines.view', 'room-medicines.view'],
    icon: Pill,
    tintClass: 'bg-lime-50',
    iconClass: 'text-lime-700',
  },
  {
    key: 'procedures',
    title: 'Tindakan',
    description: 'Tindakan klinis, lab, dan radiologi.',
    href: '/procedures',
    permissions: ['procedures.view', 'lab_requests.view', 'radiology_requests.view'],
    icon: Syringe,
    tintClass: 'bg-violet-50',
    iconClass: 'text-violet-700',
  },
  {
    key: 'master-data',
    title: 'Master Data',
    description: 'Pasien, pegawai, ruangan, referensi, dan data dasar sistem.',
    href: '/patients',
    permissions: ['patients.view', 'employees.view', 'regions.view', 'master_data.view', 'rooms.view'],
    icon: Building2,
    tintClass: 'bg-stone-100',
    iconClass: 'text-stone-700',
  },
  {
    key: 'integrations',
    title: 'Integrasi',
    description: 'BPJS, SatuSehat, dan sinkronisasi eksternal.',
    href: '/integrations/satusehat',
    permissions: ['integrations.view', 'integrations.manage', 'integrations.sync'],
    icon: Send,
    tintClass: 'bg-sky-50',
    iconClass: 'text-sky-700',
  },
  {
    key: 'eklaim',
    title: 'E-Klaim',
    description: 'Klaim, grouping, finalisasi, dan pengiriman BPJS.',
    href: '/eklaim',
    permissions: ['eklaim.view', 'eklaim.create', 'eklaim.edit', 'eklaim.grouping', 'eklaim.final', 'eklaim.send'],
    icon: FileCheck,
    tintClass: 'bg-amber-50',
    iconClass: 'text-amber-700',
  },
  {
    key: 'reports',
    title: 'Laporan',
    description: 'Akses ringkasan dan analitik lintas modul.',
    href: '/reports',
    permissions: ['dashboard.view'],
    icon: BarChart3,
    tintClass: 'bg-emerald-50',
    iconClass: 'text-emerald-700',
  },
  {
    key: 'settings',
    title: 'Pengaturan',
    description: 'Users, roles, permissions, dan konfigurasi sistem.',
    href: '/users',
    permissions: ['users.view', 'roles.view', 'permissions.view', 'settings.view'],
    icon: Settings,
    tintClass: 'bg-neutral-100',
    iconClass: 'text-neutral-700',
  },
  {
    key: 'security',
    title: 'Kontrol Akses',
    description: 'Monitoring role, permission, dan tata kelola akses.',
    href: '/roles',
    permissions: ['roles.view', 'permissions.view'],
    icon: Shield,
    tintClass: 'bg-zinc-100',
    iconClass: 'text-zinc-700',
  },
  {
    key: 'account',
    title: 'Akun & Profil',
    description: 'Akses profil pengguna dan pengaturan akun pribadi.',
    href: '/account',
    permissions: ['profile.view', 'profile.update'],
    icon: Lock,
    tintClass: 'bg-indigo-50',
    iconClass: 'text-indigo-700',
  },
  {
    key: 'clinical',
    title: 'Layanan Klinis',
    description: 'Akses klinis umum untuk proses visit dan pelayanan.',
    href: '/visits',
    permissions: ['visits.view', 'procedures.view', 'rooms.view'],
    icon: Stethoscope,
    tintClass: 'bg-teal-50',
    iconClass: 'text-teal-700',
  },
  {
    key: 'capacity',
    title: 'Kapasitas Layanan',
    description: 'Pemantauan kapasitas ruangan dan utilisasi bed.',
    href: '/floor-plan',
    permissions: ['rooms.view'],
    icon: Bed,
    tintClass: 'bg-orange-50',
    iconClass: 'text-orange-700',
  },
  {
    key: 'operations',
    title: 'Operasional',
    description: 'Pantauan kerja harian lintas kunjungan dan tindakan.',
    href: '/dashboard',
    permissions: ['dashboard.view', 'visits.view', 'billing.view', 'procedures.view'],
    icon: Activity,
    tintClass: 'bg-fuchsia-50',
    iconClass: 'text-fuchsia-700',
  },
];