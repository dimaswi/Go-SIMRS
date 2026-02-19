import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  patientPortalApi,
  patientPortalAuth,
  type PatientProfile,
  type VisitHistoryItem,
} from '@/lib/api/patient-portal';
import { settingsApi } from '@/lib/api';
import {
  Building2,
  LogOut,
  User,
  AlertTriangle,
  Stethoscope,
  BedDouble,
  Ambulance,
  FlaskConical,
  ScanLine,
  Loader2,
  Calendar,
  CreditCard,
  LayoutGrid,
  Pill,
  ChevronDown,
  ChevronRight,
  FileText,
  ClipboardList,
  Syringe,
  FileHeart,
  Send,
  FileCheck,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { id } from 'date-fns/locale';

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};

// Fetch PDF blob and open in new tab
const openPdfFromApi = async (endpoint: string): Promise<boolean> => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const token = localStorage.getItem('patientPortalToken');
  
  try {
    const response = await fetch(`${apiUrl}/patient-portal/print${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return false;
  }
};

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  filter?: (t: string) => boolean;
}

const menuItems: MenuItem[] = [
  { id: 'semua', label: 'Semua', icon: LayoutGrid, color: 'bg-slate-500' },
  { id: 'rawat-jalan', label: 'Rawat Jalan', icon: Stethoscope, color: 'bg-blue-500', filter: (t) => t === 'rawat jalan' || t === 'konsultasi' },
  { id: 'rawat-inap', label: 'Rawat Inap', icon: BedDouble, color: 'bg-purple-500', filter: (t) => t === 'rawat inap' },
  { id: 'igd', label: 'IGD', icon: Ambulance, color: 'bg-red-500', filter: (t) => t === 'igd' || t === 'gawat darurat' },
  { id: 'laboratorium', label: 'Lab', icon: FlaskConical, color: 'bg-green-500', filter: (t) => t === 'laboratorium' },
  { id: 'radiologi', label: 'Radiologi', icon: ScanLine, color: 'bg-orange-500', filter: (t) => t === 'radiologi' },
  { id: 'farmasi', label: 'Farmasi', icon: Pill, color: 'bg-pink-500', filter: (t) => t === 'farmasi' },
];

// All document types with backend keys as id
// The id MUST match what backend returns in available_docs
interface DocDef {
  id: string;         // backend key
  label: string;
  icon: LucideIcon;
  endpoint: (id: number) => string;
}

// Document types with fixed endpoints (visit-based)
const visitDocTypes: DocDef[] = [
  { id: 'resume', label: 'Resume Medis', icon: ClipboardList, endpoint: (id) => `/outpatient-resume/${id}` },
  { id: 'triage', label: 'Form Triase', icon: Activity, endpoint: (id) => `/triage-form/${id}` },
  { id: 'emergency_summary', label: 'Resume IGD', icon: ClipboardList, endpoint: (id) => `/emergency-summary/${id}` },
  { id: 'cppt', label: 'CPPT', icon: FileText, endpoint: (id) => `/cppt/${id}` },
  { id: 'sick_letter', label: 'Surat Sakit', icon: FileHeart, endpoint: (id) => `/sick-letter/${id}` },
  { id: 'referral_letter', label: 'Surat Rujukan', icon: Send, endpoint: (id) => `/referral-letter/${id}` },
  { id: 'inpatient_certificate', label: 'Surat Keterangan Rawat Inap', icon: FileCheck, endpoint: (id) => `/inpatient-certificate/${id}` },
];

// Order-based document types (lab/radiology/prescription use order ID)
const orderDocTypes: Record<string, { label: string; icon: LucideIcon; endpointPrefix: string }> = {
  'lab_result': { label: 'Hasil Laboratorium', icon: FlaskConical, endpointPrefix: '/lab-result/' },
  'radiology_result': { label: 'Hasil Radiologi', icon: ScanLine, endpointPrefix: '/radiology-result/' },
  'prescription': { label: 'Resep Obat', icon: Syringe, endpointPrefix: '/prescription/' },
};

// Parse backend doc key (handles "lab_result:123" format)
interface ParsedDoc {
  type: string;
  orderId?: number;
  label: string;
  icon: LucideIcon;
  endpoint: string;
}

const parseDocKey = (key: string, visitId: number): ParsedDoc | null => {
  // Check if it's an order-based doc (format: "type:orderId")
  if (key.includes(':')) {
    const [type, orderIdStr] = key.split(':');
    const orderId = parseInt(orderIdStr, 10);
    const orderDoc = orderDocTypes[type];
    if (orderDoc && !isNaN(orderId)) {
      return {
        type,
        orderId,
        label: orderDoc.label,
        icon: orderDoc.icon,
        endpoint: `${orderDoc.endpointPrefix}${orderId}`,
      };
    }
    return null;
  }
  
  // Otherwise it's a visit-based doc
  const visitDoc = visitDocTypes.find(d => d.id === key);
  if (visitDoc) {
    return {
      type: key,
      label: visitDoc.label,
      icon: visitDoc.icon,
      endpoint: visitDoc.endpoint(visitId),
    };
  }
  return null;
};

// Fetch available docs from backend - returns backend keys directly
const fetchAvailableDocs = async (visitId: number): Promise<string[]> => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const token = localStorage.getItem('patientPortalToken');
  
  try {
    const response = await fetch(`${apiUrl}/patient-portal/available-docs/${visitId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.available_docs || [];
  } catch {
    return [];
  }
};

export default function PatientPortalDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);
  const [appName, setAppName] = useState('SIMRS');
  const [appLogo, setAppLogo] = useState('');
  const [error, setError] = useState('');
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState('semua');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedVisits, setExpandedVisits] = useState<Set<number>>(new Set());
  const [visitAvailableDocs, setVisitAvailableDocs] = useState<Record<number, string[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<number>>(new Set());
  const [docNotAvailableMsg, setDocNotAvailableMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Portal Pasien';
    if (!patientPortalAuth.isAuthenticated()) {
      navigate('/portal');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, visitsRes, settingsRes] = await Promise.all([
        patientPortalApi.getProfile(),
        patientPortalApi.getVisitHistory(),
        settingsApi.getAll().catch(() => null),
      ]);
      setProfile(profileRes.data);
      setVisits(visitsRes.data.visits || []);
      if (settingsRes?.data?.data) {
        if (settingsRes.data.data.app_name) setAppName(settingsRes.data.data.app_name);
        if (settingsRes.data.data.app_logo) setAppLogo(settingsRes.data.data.app_logo);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 401) {
        patientPortalAuth.logout();
        navigate('/portal');
        return;
      }
      setError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    patientPortalAuth.logout();
    navigate('/portal');
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: id });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm', { locale: id });
    } catch {
      return '';
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "-";
    try {
      return `${differenceInYears(new Date(), parseISO(birthDate))} tahun`;
    } catch {
      return "-";
    }
  };

  const getGenderLabel = (gender: string) => gender === 'L' ? 'Laki-laki' : gender === 'P' ? 'Perempuan' : gender;

  const getVisitBadgeStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'rawat jalan' || t === 'konsultasi') return 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30';
    if (t === 'rawat inap') return 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30';
    if (t === 'igd' || t === 'gawat darurat') return 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
    if (t === 'laboratorium') return 'border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30';
    if (t === 'radiologi') return 'border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30';
    if (t === 'farmasi') return 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30';
    return 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30';
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'selesai') return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">Selesai</Badge>;
    if (s === 'sedang dilayani' || s === 'dilayani') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">Dilayani</Badge>;
    if (s === 'dibatalkan' || s === 'batal') return <Badge variant="destructive">Batal</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const handleDownloadDoc = async (doc: ParsedDoc) => {
    const docKey = `${doc.type}-${doc.orderId || 'visit'}`;
    setDownloadingDoc(docKey);
    try {
      const success = await openPdfFromApi(doc.endpoint);
      if (!success) {
        setDocNotAvailableMsg(`Dokumen "${doc.label}" tidak tersedia.`);
      }
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Filter out cancelled visits and count per menu
  const activeVisits = visits.filter(v => {
    const s = v.status.toLowerCase();
    return s !== 'dibatalkan' && s !== 'batal' && s !== 'cancelled';
  });

  // Count visits per menu
  const getMenuCount = (menu: MenuItem) => {
    if (!menu.filter) return activeVisits.length;
    return activeVisits.filter(v => menu.filter!(v.jenis_kunjungan.toLowerCase())).length;
  };

  // Filter visits by active menu
  const activeMenuItem = menuItems.find(m => m.id === activeMenu);
  const filteredVisits = activeMenuItem?.filter 
    ? activeVisits.filter(v => activeMenuItem.filter!(v.jenis_kunjungan.toLowerCase()))
    : activeVisits;

  // Group visits by date
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, VisitHistoryItem[]> = {};
    for (const visit of filteredVisits) {
      const date = visit.tanggal_kunjungan.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(visit);
    }
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredVisits]);

  // Expand first 3 dates by default
  useEffect(() => {
    if (visitsByDate.length > 0 && expandedDates.size === 0) {
      setExpandedDates(new Set(visitsByDate.slice(0, 3).map(([date]) => date)));
    }
  }, [visitsByDate]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleVisit = async (visitId: number, isCompleted: boolean) => {
    const isExpanding = !expandedVisits.has(visitId);
    
    setExpandedVisits(prev => {
      const next = new Set(prev);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });

    // Fetch available docs if expanding and completed and not already loaded
    if (isExpanding && isCompleted && !visitAvailableDocs[visitId]) {
      setLoadingDocs(prev => new Set(prev).add(visitId));
      const docs = await fetchAvailableDocs(visitId);
      setVisitAvailableDocs(prev => ({ ...prev, [visitId]: docs }));
      setLoadingDocs(prev => {
        const next = new Set(prev);
        next.delete(visitId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-40" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-20 rounded-xl shrink-0" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <AlertTriangle className="h-16 w-16 text-destructive opacity-50" />
        <h2 className="text-xl font-semibold">Terjadi Kesalahan</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={loadData}>Coba Lagi</Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <User className="h-16 w-16 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold">Data Tidak Ditemukan</h2>
        <Button onClick={() => navigate('/portal')}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-4xl">
          <div className="flex items-center gap-2">
            {appLogo ? (
              <img src={appLogo.startsWith('http') ? appLogo : `${getBaseUrl()}${appLogo}`} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <Building2 className="h-6 w-6 text-primary" />
            )}
            <div>
              <h1 className="font-bold text-base sm:text-lg">{appName}</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Portal Pasien</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 space-y-4 max-w-4xl">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0">
                <AvatarImage src={profile.photo_url ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${getBaseUrl()}${profile.photo_url}`) : undefined} />
                <AvatarFallback className="text-lg sm:text-xl">{profile.nama_lengkap.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-base sm:text-lg truncate">{profile.nama_lengkap}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-mono">{profile.no_rm}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{getGenderLabel(profile.jenis_kelamin)} • {calculateAge(profile.tanggal_lahir)}</p>
              </div>
            </div>
            {profile.no_bpjs && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  BPJS Kesehatan
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm">{profile.no_bpjs}</p>
                  {profile.kelas_bpjs && <Badge variant="secondary" className="text-xs">Kelas {profile.kelas_bpjs}</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Menu - Horizontal Scroll on Mobile */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const count = getMenuCount(item);
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl transition-all shrink-0 min-w-[70px] sm:min-w-[80px] ${
                  isActive 
                    ? `${item.color} text-white shadow-lg` 
                    : 'bg-background border hover:bg-muted/50'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${isActive ? 'bg-white/20' : item.color + ' text-white'}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="text-center">
                  <p className={`text-[10px] sm:text-xs font-medium leading-tight ${isActive ? 'text-white' : ''}`}>{item.label}</p>
                  <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>({count})</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Visit Tree */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm sm:text-base">Riwayat Kunjungan</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Klik kunjungan untuk melihat dokumen yang tersedia</p>
            </div>

            {visitsByDate.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Belum ada riwayat kunjungan</p>
              </div>
            ) : (
              <div className="divide-y">
                {visitsByDate.map(([date, dateVisits]) => {
                  const isDateExpanded = expandedDates.has(date);

                  return (
                    <div key={date}>
                      {/* Date Header */}
                      <button
                        onClick={() => toggleDate(date)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${isDateExpanded ? 'bg-muted/30' : ''}`}
                      >
                        {isDateExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-sm">{formatDate(date)}</span>
                        <span className="text-xs text-muted-foreground">({dateVisits.length} kunjungan)</span>
                      </button>

                      {/* Visits under this date */}
                      {isDateExpanded && (
                        <div className="border-t bg-muted/10">
                          {dateVisits.map((visit, visitIdx) => {
                            const isVisitExpanded = expandedVisits.has(visit.id);
                            const isCompleted = visit.status.toLowerCase() === 'selesai';
                            const isLoadingDocs = loadingDocs.has(visit.id);
                            const backendDocs = visitAvailableDocs[visit.id] || [];
                            const isLastVisit = visitIdx === dateVisits.length - 1;

                            return (
                              <div key={visit.id} className="relative">
                                {/* Visit Row - Expandable */}
                                <button
                                  onClick={() => toggleVisit(visit.id, isCompleted)}
                                  className={`w-full flex items-center gap-2 py-2.5 pl-8 pr-4 hover:bg-muted/50 transition-colors text-left ${isVisitExpanded ? 'bg-muted/20' : ''}`}
                                >
                                  {/* Tree connector */}
                                  <div className={`absolute left-[22px] w-px bg-border ${isLastVisit && !isVisitExpanded ? 'top-0 h-1/2' : 'top-0 bottom-0'}`} />
                                  <div className="absolute left-[22px] top-1/2 w-3 h-px bg-border -translate-y-1/2" />
                                  
                                  {isVisitExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground relative z-10 bg-muted rounded" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground relative z-10 bg-muted rounded" />
                                  )}
                                  
                                  <Badge variant="outline" className={`text-[10px] sm:text-xs shrink-0 ${getVisitBadgeStyle(visit.jenis_kunjungan)}`}>
                                    {visit.jenis_kunjungan}
                                  </Badge>
                                  <span className="text-xs sm:text-sm truncate flex-1">{visit.nama_poli || '-'}</span>
                                  <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{formatTime(visit.tanggal_kunjungan)}</span>
                                  {getStatusBadge(visit.status)}
                                </button>

                                {/* Documents Tree */}
                                {isVisitExpanded && (
                                  <div className="relative pl-14 pr-4 pb-3">
                                    {/* Vertical line connector */}
                                    <div className={`absolute left-[22px] w-px bg-border top-0 ${isLastVisit ? 'h-0' : 'bottom-0'}`} />
                                    <div className="absolute left-[37px] w-px bg-border/50 top-0 bottom-3" />
                                    
                                    {!isCompleted ? (
                                      <div className="text-xs text-muted-foreground py-2 pl-4">
                                        Dokumen belum tersedia (kunjungan belum selesai)
                                      </div>
                                    ) : isLoadingDocs ? (
                                      <div className="text-xs text-muted-foreground py-2 pl-4 flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Memuat dokumen...</span>
                                      </div>
                                    ) : backendDocs.length === 0 ? (
                                      <div className="text-xs text-muted-foreground py-2 pl-4">
                                        Tidak ada dokumen tersedia untuk kunjungan ini
                                      </div>
                                    ) : (
                                      <div className="space-y-1 pt-1">
                                        {backendDocs.map((docKey, docIdx) => {
                                          const doc = parseDocKey(docKey, visit.id);
                                          if (!doc) return null;
                                          
                                          const downloadKey = `${doc.type}-${doc.orderId || visit.id}`;
                                          const isDownloading = downloadingDoc === downloadKey;
                                          const isLastDoc = docIdx === backendDocs.length - 1;
                                          const DocIcon = doc.icon;
                                          
                                          return (
                                            <div key={docKey} className="relative flex items-center gap-2 py-1.5 pl-4">
                                              {/* Tree connector */}
                                              <div className={`absolute left-0 w-px bg-border/50 ${isLastDoc ? 'top-0 h-1/2' : 'top-0 bottom-0'}`} />
                                              <div className="absolute left-0 top-1/2 w-3 h-px bg-border/50 -translate-y-1/2" />
                                              
                                              <div className="relative z-10 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                              
                                              <button
                                                onClick={() => handleDownloadDoc(doc)}
                                                disabled={isDownloading}
                                                className="flex items-center gap-2 text-xs sm:text-sm hover:text-primary transition-colors disabled:opacity-50 group"
                                              >
                                                {isDownloading ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <DocIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                                                )}
                                                <span className="group-hover:underline">{doc.label}</span>
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-xs sm:text-sm text-muted-foreground max-w-4xl">
          &copy; {new Date().getFullYear()} {appName}
        </div>
      </footer>

      {/* Document Not Available Dialog */}
      <AlertDialog open={!!docNotAvailableMsg} onOpenChange={(open) => !open && setDocNotAvailableMsg(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Dokumen Tidak Tersedia</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {docNotAvailableMsg}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-8 text-xs">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
