import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { patientsApi, type Patient } from '@/lib/api';
import { setPageTitle } from '@/lib/page-title';
import {
  User,
  Loader2,
  Eye,
  Filter,
  X,
} from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';

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

      // Jika hanya 1 hasil, langsung ke detail (gunakan replace untuk menghindari loop back)
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

  // Search when query changes
  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

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

  const hasActiveFilters = filters.address || filters.kabupaten || filters.birthDate || filters.parentName;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded-lg border py-16 text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Cari Pasien</h3>
          <p className="text-muted-foreground">
            Gunakan kolom pencarian di header untuk mencari pasien
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Hasil Pencarian</h1>
          <p className="text-sm text-muted-foreground">
            {results.length > 0
              ? `Ditemukan ${results.length} pasien`
              : `Tidak ada pasien yang ditemukan untuk "${query}"`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              Filter aktif
            </Badge>
          )}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
          {results.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {results.length} pasien
            </Badge>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-address">Alamat</Label>
              <Input
                id="filter-address"
                placeholder="Cari berdasarkan alamat..."
                value={filters.address}
                onChange={(e) => setFilters(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-kabupaten">Kabupaten / Kota</Label>
              <Input
                id="filter-kabupaten"
                placeholder="Cari berdasarkan kabupaten..."
                value={filters.kabupaten}
                onChange={(e) => setFilters(prev => ({ ...prev, kabupaten: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-birthdate">Tanggal Lahir</Label>
              <Input
                id="filter-birthdate"
                type="date"
                value={filters.birthDate}
                onChange={(e) => setFilters(prev => ({ ...prev, birthDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-parent">Nama Orang Tua</Label>
              <Input
                id="filter-parent"
                placeholder="Nama ayah atau ibu..."
                value={filters.parentName}
                onChange={(e) => setFilters(prev => ({ ...prev, parentName: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApplyFilters}>
              Terapkan Filter
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                <X className="h-4 w-4 mr-1" />
                Reset Filter
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="rounded-lg border">
          {results.length === 0 ? (
            <div className="py-16 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Tidak Ada Hasil</h3>
              <p className="text-muted-foreground">
                Coba cari dengan kata kunci lain
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">No. RM</TableHead>
                  <TableHead>Nama Pasien</TableHead>
                  <TableHead className="w-[100px]">Jenis Kelamin</TableHead>
                  <TableHead className="w-[100px]">Umur</TableHead>
                  <TableHead className="w-[120px]">Jaminan</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((patient) => (
                  <TableRow 
                    key={patient.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewPatient(patient)}
                  >
                    <TableCell className="font-mono font-medium">
                      {patient.no_rm}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.nama_lengkap}</p>
                          {patient.alamat_ktp && (
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {patient.alamat_ktp}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </TableCell>
                    <TableCell>{calculateAge(patient.tanggal_lahir)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{patient.jenis_jaminan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(patient.status)}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPatient(patient);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </div>
    </div>
  );
}
