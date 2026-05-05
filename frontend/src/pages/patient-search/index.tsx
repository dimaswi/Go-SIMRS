import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { patientsApi, type Patient } from '@/lib/api';
import { setPageTitle } from '@/lib/page-title';
import {
  User,
  Loader2,
  Eye,
  Filter,
  X,
  Search,
} from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';
import { formatPatientName } from '@/lib/print-utils';
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";

export default function PatientSearchIndex() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    address: '',
    kabupaten: '',
    birthDate: '',
    parentName: '',
  });

  useEffect(() => {
    setPageTitle('Pencarian Pasien');
  }, []);

  const performSearch = useCallback(async (searchQuery: string, activeFilters = filters) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const hasFilters = activeFilters.address || activeFilters.kabupaten || activeFilters.birthDate || activeFilters.parentName;
      const response = await patientsApi.search(
        searchQuery.trim(),
        100,
        hasFilters ? {
          address: activeFilters.address || undefined,
          kabupaten: activeFilters.kabupaten || undefined,
          birthDate: activeFilters.birthDate || undefined,
          parentName: activeFilters.parentName || undefined,
        } : undefined
      );
      const patients: Patient[] = response.data || [];
      setResults(patients);

      if (patients.length === 1) {
        navigate(`/patient-search/${patients[0].id}?q=${encodeURIComponent(searchQuery)}`, { replace: true });
      }
    } catch (error) {
      console.error('Error searching patients:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters, navigate]);

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query, performSearch]);

  const handleApplyFilters = () => {
    if (query) {
      performSearch(query, filters);
    }
  };

  const handleResetFilters = () => {
    const emptyFilters = { address: '', kabupaten: '', birthDate: '', parentName: '' };
    setFilters(emptyFilters);
    if (query) {
      performSearch(query, emptyFilters);
    }
  };

  const hasActiveFilters = !!(filters.address || filters.kabupaten || filters.birthDate || filters.parentName);

  const handleViewPatient = (patient: Patient) => {
    navigate(`/patient-search/${patient.id}?q=${encodeURIComponent(query)}`);
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    try {
      const age = differenceInYears(new Date(), parseISO(birthDate));
      return `${age} tahun`;
    } catch {
      return '-';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Aktif':
        return 'default';
      case 'Tidak Aktif':
        return 'secondary';
      case 'Meninggal':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const columns = useMemo<ColumnDef<Patient>[]>(() => [
    {
      accessorKey: 'no_rm',
      header: 'No. RM',
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.no_rm}</span>,
    },
    {
      accessorKey: 'nama_lengkap',
      header: 'Nama Pasien',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">
                {formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}
              </span>
              {patient.alamat_ktp && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {patient.alamat_ktp}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'jenis_kelamin',
      header: 'L/P',
      cell: ({ row }) => row.original.jenis_kelamin === 'L' ? 'L' : 'P',
    },
    {
      id: 'age',
      header: 'Umur',
      cell: ({ row }) => calculateAge(row.original.tanggal_lahir),
    },
    {
      accessorKey: 'jenis_jaminan',
      header: 'Jaminan',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-normal">
          {row.original.jenis_jaminan}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)} className="text-[10px]">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              handleViewPatient(row.original);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [query]);

  return (
    <PageShell>
      <PageHeader
        title={query ? "Hasil Pencarian Pasien" : "Cari Pasien"}
        description={query
          ? `Menampilkan hasil untuk "${query}"`
          : "Gunakan fitur pencarian di header untuk mencari data pasien"
        }
        count={results.length}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 text-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] text-primary">
                  !
                </span>
              )}
            </Button>
          </div>
        }
      />

      <PageContent>
        <div className="">
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent>
              <div className="rounded-lg border bg-card p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="filter-address" className="text-xs">Alamat</Label>
                    <Input
                      id="filter-address"
                      placeholder="Alamat..."
                      value={filters.address}
                      onChange={(e) => setFilters(prev => ({ ...prev, address: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="filter-kabupaten" className="text-xs">Kabupaten / Kota</Label>
                    <Input
                      id="filter-kabupaten"
                      placeholder="Kabupaten..."
                      value={filters.kabupaten}
                      onChange={(e) => setFilters(prev => ({ ...prev, kabupaten: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="filter-birthdate" className="text-xs">Tanggal Lahir</Label>
                    <Input
                      id="filter-birthdate"
                      type="date"
                      value={filters.birthDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, birthDate: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="filter-parent" className="text-xs">Nama Orang Tua</Label>
                    <Input
                      id="filter-parent"
                      placeholder="Ayah/Ibu..."
                      value={filters.parentName}
                      onChange={(e) => setFilters(prev => ({ ...prev, parentName: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button size="sm" onClick={handleApplyFilters} className="h-8 text-xs px-4">
                    Terapkan Filter
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-8 text-xs">
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Reset
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-lg border border-dashed">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Mencari data pasien...</p>
            </div>
          ) : !query ? (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-lg border border-dashed">
              <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Pencarian Pasien</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Gunakan kotak pencarian di bagian atas untuk menemukan data pasien berdasarkan nama, No. RM, atau NIK.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-lg border border-dashed">
              <div className="h-16 w-16 rounded-full bg-destructive/5 flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-destructive/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Pasien Tidak Ditemukan</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Tidak ada data yang cocok dengan kriteria pencarian Anda. Pastikan ejaan benar atau coba gunakan filter tambahan.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4">
                Reset Semua Filter
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={results}
              searchPlaceholder="Filter hasil..."
              pageSize={10}
              tableId="patient-search-results"
            />
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}
