import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi, type Patient } from '@/lib/api';
import { formatPatientName } from '@/lib/print-utils';
import { Search, Loader2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { differenceInYears, parseISO } from 'date-fns';

export function PatientSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Global "/" keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '/' && !isInput && !open) {
        e.preventDefault();
        setOpen(true);
      }

      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await patientsApi.search(searchQuery.trim(), 10);
      const patients: Patient[] = response.data || [];
      setResults(patients);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error searching patients:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  const handleSelect = (patient: Patient) => {
    setOpen(false);
    navigate(`/patient-search/${patient.id}?q=${encodeURIComponent(query.trim())}`);
  };

  const handleEnter = () => {
    if (results.length === 1) {
      handleSelect(results[0]);
    } else if (results.length > 1 && selectedIndex >= 0) {
      handleSelect(results[selectedIndex]);
    } else if (query.trim()) {
      setOpen(false);
      navigate(`/patient-search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleEnter();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    try {
      return `${differenceInYears(new Date(), parseISO(birthDate))} th`;
    } catch {
      return '-';
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-muted/40 hover:bg-muted text-sm text-muted-foreground transition-colors w-[220px] lg:w-[280px]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate text-muted-foreground/70">Cari pasien...</span>
        <Kbd>/</Kbd>
      </button>

      {/* Dialog overlay + content */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Search panel */}
          <div className="relative flex justify-center pt-[15vh] px-4 pointer-events-none">
            <div className="w-full max-w-2xl pointer-events-auto animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="rounded-xl border bg-background shadow-2xl overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 border-b">
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 shrink-0 text-muted-foreground animate-spin" />
                  ) : (
                    <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Cari No. RM, Nama, NIK, atau No. BPJS..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 h-14 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
                  />
                  <kbd
                    onClick={() => setOpen(false)}
                    className="cursor-pointer shrink-0 inline-flex h-6 items-center rounded border bg-muted px-1.5 text-xs text-muted-foreground hover:bg-muted/80"
                  >
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[400px] overflow-y-auto">
                  {query.trim() === '' ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Ketik untuk mulai mencari pasien
                    </div>
                  ) : isSearching && results.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Mencari...
                    </div>
                  ) : results.length === 0 && query.trim() ? (
                    <div className="py-10 text-center">
                      <User className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Tidak ada pasien ditemukan</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Tekan Enter untuk ke halaman pencarian lengkap
                      </p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {results.map((patient, index) => (
                        <button
                          key={patient.id}
                          data-selected={index === selectedIndex}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleSelect(patient)}
                          onMouseEnter={() => setSelectedIndex(index)}
                        >
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</span>
                              <Badge variant="outline" className="shrink-0 text-xs font-mono">
                                {patient.no_rm}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>{patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                              <span>·</span>
                              <span>{calculateAge(patient.tanggal_lahir)}</span>
                              {patient.alamat_ktp && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{patient.alamat_ktp}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {patient.jenis_jaminan}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer hint */}
                {results.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 text-[10px]">↑</kbd>
                        <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 text-[10px]">↓</kbd>
                        navigasi
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 text-[10px]">Enter</kbd>
                        pilih
                      </span>
                    </div>
                    <span>{results.length} hasil</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
