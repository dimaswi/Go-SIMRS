import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { eklaimLocalApi } from '@/lib/api/eklaim-local';
import type { EKlaimLocal } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Play,
  BarChart3,
  RotateCcw,
  AlertTriangle,
  Plus,
  Trash2,
  Code2,
} from 'lucide-react';

interface IDRGCodingTabProps {
  detail: EKlaimLocal;
  onRefresh: () => void;
}

interface SearchResultItem {
  code: string;
  description: string;
  im?: boolean;
  validcode?: string;
  accpdx?: string;
}

interface ExpandedItem {
  code: string;
  display: string;
  multiplicity?: number;
  no: string;
  validcode: string;
  metadata?: { code: string; message: string; error_no?: string };
}

interface IDRGGrouperParsed {
  mdc_number?: string;
  mdc_description?: string;
  drg_code?: string;
  drg_description?: string;
  script_version?: string;
  logic_version?: string;
  cost_weight?: string;
  sub_acute_weight?: string;
  chronic_weight?: string;
  total_cost_weight?: string;
  nbr?: string;
  status_cd?: string;
}

const isValidCodeOne = (value: unknown): boolean => {
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 't';
  }
  // Default true to avoid blocking when source does not provide validcode.
  return true;
};

const isAccPdxPrimaryAllowed = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().toUpperCase() === 'Y';
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  // Default allow when source does not provide ACCPDX explicitly.
  return true;
};

export default function IDRGCodingTab({ detail, onRefresh }: IDRGCodingTabProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [diagDialogOpen, setDiagDialogOpen] = useState(false);
  const [procDialogOpen, setProcDialogOpen] = useState(false);

  // After grouping: hide entire coding form, only show result.
  // "Ubah Coding" re-shows the form for re-coding / re-grouping.
  const [groupedOverride, setGroupedOverride] = useState(false);
  const grouped = detail.idrg_grouper_success || groupedOverride;
  const [codingEditMode, setCodingEditMode] = useState(false);
  const showCodingForm = !grouped || codingEditMode;

  // Parse the grouper response JSON for structured display
  const grouperParsed = useMemo<IDRGGrouperParsed | null>(() => {
    if (!detail.idrg_grouper_response) return null;
    try {
      const raw = JSON.parse(detail.idrg_grouper_response);
      // E-Klaim may nest the result under different keys
      const candidates = [
        raw?.response_idrg,
        raw?.response?.response_idrg,
        raw?.response,
        raw?.data?.response_idrg,
        raw?.data,
      ];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === 'string') {
          try {
            const p = JSON.parse(c);
            if (p?.drg_code || p?.status_cd) return p;
          } catch { /* skip */ }
        }
        if (typeof c === 'object' && (c.drg_code || c.status_cd)) {
          return c as IDRGGrouperParsed;
        }
      }
      // last resort: use raw itself if it has relevant keys
      if (raw?.drg_code || raw?.status_cd) return raw as IDRGGrouperParsed;
      return null;
    } catch {
      return null;
    }
  }, [detail.idrg_grouper_response]);

  // Diagnosa state
  const [diagCodes, setDiagCodes] = useState<string[]>(() => {
    if (detail.idrg_diagnosa) return detail.idrg_diagnosa.split('#').filter(Boolean);
    return [];
  });
  const [diagInput, setDiagInput] = useState('');
  const [diagSearchKeyword, setDiagSearchKeyword] = useState('');
  const [diagSearchResults, setDiagSearchResults] = useState<SearchResultItem[]>([]);
  const [diagSearching, setDiagSearching] = useState(false);
  const [diagExpanded, setDiagExpanded] = useState<ExpandedItem[]>(() => {
    if (detail.idrg_diagnosa_response) {
      try {
        const parsed = JSON.parse(detail.idrg_diagnosa_response);
        return parsed?.expanded || parsed?.data?.expanded || [];
      } catch { return []; }
    }
    return [];
  });

  // Procedure state
  const [procEntries, setProcEntries] = useState<{ code: string; multiplicity: number }[]>(() => {
    if (detail.idrg_procedure) {
      return detail.idrg_procedure.split('#').filter(Boolean).map(entry => {
        const parts = entry.split('+');
        return { code: parts[0], multiplicity: parts[1] ? parseInt(parts[1]) : 1 };
      });
    }
    return [];
  });
  const [procInput, setProcInput] = useState('');
  const [procMultiplicity, setProcMultiplicity] = useState(1);
  const [procSearchKeyword, setProcSearchKeyword] = useState('');
  const [procSearchResults, setProcSearchResults] = useState<SearchResultItem[]>([]);
  const [procSearching, setProcSearching] = useState(false);
  const [procExpanded, setProcExpanded] = useState<ExpandedItem[]>(() => {
    if (detail.idrg_procedure_response) {
      try {
        const parsed = JSON.parse(detail.idrg_procedure_response);
        return parsed?.expanded || parsed?.data?.expanded || [];
      } catch { return []; }
    }
    return [];
  });

  const disabled = detail.idrg_final_success;
  const buttons = detail.buttons || {};

  // Sync local state when detail prop changes (e.g. after onRefresh)
  useEffect(() => {
    const codes = detail.idrg_diagnosa ? detail.idrg_diagnosa.split('#').filter(Boolean) : [];
    setDiagCodes(codes);
  }, [detail.idrg_diagnosa]);

  useEffect(() => {
    if (detail.idrg_diagnosa_response) {
      try {
        const parsed = JSON.parse(detail.idrg_diagnosa_response);
        setDiagExpanded(parsed?.data?.expanded || parsed?.expanded || []);
      } catch { setDiagExpanded([]); }
    } else {
      setDiagExpanded([]);
    }
  }, [detail.idrg_diagnosa_response]);

  useEffect(() => {
    const entries = detail.idrg_procedure
      ? detail.idrg_procedure.split('#').filter(Boolean).map(entry => {
          const parts = entry.split('+');
          return { code: parts[0], multiplicity: parts[1] ? parseInt(parts[1]) : 1 };
        })
      : [];
    setProcEntries(entries);
  }, [detail.idrg_procedure]);

  useEffect(() => {
    if (detail.idrg_procedure_response) {
      try {
        const parsed = JSON.parse(detail.idrg_procedure_response);
        setProcExpanded(parsed?.data?.expanded || parsed?.expanded || []);
      } catch { setProcExpanded([]); }
    } else {
      setProcExpanded([]);
    }
  }, [detail.idrg_procedure_response]);

  // Auto-close coding form when grouping succeeds (e.g. after re-group)
  useEffect(() => {
    setGroupedOverride(false); // reset local override when actual data arrives
    if (detail.idrg_grouper_success) setCodingEditMode(false);
  }, [detail.idrg_grouper_success]);

  // ========= Diagnosa Search =========
  const searchDiagnosa = useCallback(async () => {
    if (!diagSearchKeyword.trim()) return;
    setDiagSearching(true);
    try {
      const res = await eklaimLocalApi.searchDiagnosisIDRG(diagSearchKeyword.trim());
      const raw = res?.data;
      const data: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setDiagSearchResults(data.map((item: any) => ({
        code: item.code || item[1] || '',
        description: item.description || item[0] || '',
        validcode: item.validcode ?? item.valid_code ?? '1',
        accpdx: item.accpdx ?? item.acc_pdx ?? 'Y',
      })));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal mencari diagnosa.' });
    } finally {
      setDiagSearching(false);
    }
  }, [diagSearchKeyword, toast]);

  const addDiagCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || diagCodes.includes(trimmed)) return;
    setDiagCodes(prev => [...prev, trimmed]);
    setDiagInput('');
  };

  const addDiagFromSearch = (item: SearchResultItem) => {
    if (!isValidCodeOne(item.validcode)) {
      toast({
        variant: 'destructive',
        title: 'Diagnosa tidak valid untuk grouping',
        description: `Kode ${item.code} memiliki VALIDCODE 0.`,
      });
      return;
    }

    const canBePrimary = isAccPdxPrimaryAllowed(item.accpdx);
    if (diagCodes.length === 0 && !canBePrimary) {
      toast({
        variant: 'destructive',
        title: 'Diagnosa utama tidak valid',
        description: `Kode ${item.code} ACCPDX=N, hanya boleh sebagai diagnosa sekunder. Pilih diagnosa utama (ACCPDX=Y) terlebih dahulu.`,
      });
      return;
    }

    addDiagCode(item.code);
  };

  const removeDiagCode = (index: number) => {
    setDiagCodes(prev => prev.filter((_, i) => i !== index));
  };

  // ========= Procedure Search =========
  const searchProcedure = useCallback(async () => {
    if (!procSearchKeyword.trim()) return;
    setProcSearching(true);
    try {
      const res = await eklaimLocalApi.searchProceduresIDRG(procSearchKeyword.trim());
      const raw = res?.data;
      const data: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setProcSearchResults(data.map((item: any) => ({
        code: item.code || item[1] || '',
        description: item.description || item[0] || '',
        validcode: item.validcode ?? item.valid_code ?? '1',
        accpdx: item.accpdx ?? item.acc_pdx ?? 'Y',
      })));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal mencari prosedur.' });
    } finally {
      setProcSearching(false);
    }
  }, [procSearchKeyword, toast]);

  const addProcEntry = (code: string, mult?: number) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setProcEntries(prev => [...prev, { code: trimmed, multiplicity: mult || procMultiplicity || 1 }]);
    setProcInput('');
    setProcMultiplicity(1);
  };

  const addProcFromSearch = (item: SearchResultItem) => {
    if (!isValidCodeOne(item.validcode)) {
      toast({
        variant: 'destructive',
        title: 'Procedure tidak valid untuk grouping',
        description: `Kode ${item.code} memiliki VALIDCODE 0.`,
      });
      return;
    }
    if (!isAccPdxPrimaryAllowed(item.accpdx)) {
      toast({
        variant: 'destructive',
        title: 'Procedure tidak valid untuk grouping',
        description: `Kode ${item.code} memiliki ACCPDX=N.`,
      });
      return;
    }
    addProcEntry(item.code);
  };

  const removeProcEntry = (index: number) => {
    setProcEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateProcMultiplicity = (index: number, mult: number) => {
    setProcEntries(prev => prev.map((e, i) => i === index ? { ...e, multiplicity: mult } : e));
  };

  // ========= API Actions =========
  const handleSetDiagnosa = async () => {
    const primaryCode = diagCodes[0];
    if (primaryCode) {
      const primaryMeta = diagSearchResults.find((it) => it.code.trim().toUpperCase() === primaryCode.trim().toUpperCase());
      if (primaryMeta && !isAccPdxPrimaryAllowed(primaryMeta.accpdx)) {
        toast({
          variant: 'destructive',
          title: 'Diagnosa utama tidak valid',
          description: `Kode utama ${primaryCode} memiliki ACCPDX=N. Diagnosa utama wajib ACCPDX=Y.`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const diagnosa = diagCodes.length > 0 ? diagCodes.join('#') : '#';
      const res = await eklaimLocalApi.sendIDRGDiagnosaSet(detail.id, { diagnosa });
      const expanded = res?.response?.data?.expanded || res?.data?.expanded || res?.expanded || [];
      setDiagExpanded(expanded);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Diagnosa iDRG berhasil diset.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal set diagnosa iDRG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetProcedure = async () => {
    setSubmitting(true);
    try {
      const procedure = procEntries.length > 0
        ? procEntries.map(e => e.multiplicity > 1 ? `${e.code}+${e.multiplicity}` : e.code).join('#')
        : '#';
      const res = await eklaimLocalApi.sendIDRGProcedureSet(detail.id, { procedure });
      const expanded = res?.response?.data?.expanded || res?.data?.expanded || res?.expanded || [];
      setProcExpanded(expanded);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Prosedur iDRG berhasil diset.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal set prosedur iDRG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrouper = async () => {
    setSubmitting(true);
    try {
      // Auto set diagnosa before grouping
      const diagnosa = diagCodes.length > 0 ? diagCodes.join('#') : '#';
      const diagRes = await eklaimLocalApi.sendIDRGDiagnosaSet(detail.id, { diagnosa });
      setDiagExpanded(diagRes?.response?.data?.expanded || diagRes?.data?.expanded || diagRes?.expanded || []);

      // Auto set procedure before grouping
      const procedure = procEntries.length > 0
        ? procEntries.map(e => e.multiplicity > 1 ? `${e.code}+${e.multiplicity}` : e.code).join('#')
        : '#';
      await eklaimLocalApi.sendIDRGProcedureSet(detail.id, { procedure });

      // Grouping
      await eklaimLocalApi.sendGrouperIDRG(detail.id);
      setGroupedOverride(true);
      setCodingEditMode(false);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Grouping iDRG berhasil.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal grouping iDRG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinal = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.sendFinalIDRG(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'iDRG berhasil di-finalisasi.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal finalisasi iDRG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReedit = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.sendReeditIDRG(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'iDRG berhasil di-reedit. Status INACBG di-reset.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal reedit iDRG.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Coding iDRG</h3>
          <p className="text-xs text-muted-foreground">
            Set diagnosa dan prosedur untuk iDRG grouping (INA-Grouper / 25 Kriteria KEMENKES)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {disabled && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="mr-1 h-3 w-3" /> iDRG Final
            </Badge>
          )}
        </div>
      </div>

      {/* Warning: claim data not set */}
      {!buttons.idrg_coding && !disabled && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Claim Data Belum Diset</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Silakan kirim "Set Claim Data" pada tab Data Klaim terlebih dahulu sebelum melakukan coding iDRG.
            </p>
          </div>
        </div>
      )}

      {/* ===== CODING FORM — hidden after grouping, re-shown via "Ubah Coding" ===== */}
      {showCodingForm && (
        <>
          {/* ==================== DIAGNOSA & PROSEDUR ==================== */}
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-6">
            {/* --- Diagnosa --- */}
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Diagnosa (ICD-10 IM)</Label>
              {detail.idrg_diagnosa && (
                <span className="text-xs text-muted-foreground font-mono">{detail.idrg_diagnosa}</span>
              )}
            </div>

            {/* Code chips */}
            {diagCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {diagCodes.map((code, i) => (
                  <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                    {i === 0 && <span className="text-[10px] text-muted-foreground mr-0.5">P:</span>}
                    {code}
                    {!disabled && (
                      <button type="button" onClick={() => removeDiagCode(i)} className="ml-0.5 hover:text-destructive">
                        <XCircle className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}

            {/* Add + Set buttons */}
            {!disabled && (
              <div className="flex gap-2">
                <Dialog open={diagDialogOpen} onOpenChange={setDiagDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Tambah Diagnosa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Cari & Tambah Diagnosa ICD-10 IM</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {/* Search */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Cari diagnosa... (misal: S71 atau fracture)"
                          value={diagSearchKeyword}
                          onChange={e => setDiagSearchKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && searchDiagnosa()}
                          autoFocus
                        />
                        <Button variant="outline" size="sm" onClick={searchDiagnosa} disabled={diagSearching}>
                          {diagSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      {/* Search results */}
                      {diagSearchResults.length > 0 && (
                        <div className="max-h-64 overflow-y-auto rounded border bg-background divide-y">
                          {diagSearchResults.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              className={`w-full text-left px-3 py-2.5 text-xs ${isValidCodeOne(item.validcode) ? 'hover:bg-accent' : 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                              onClick={() => addDiagFromSearch(item)}
                            >
                              <div className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 w-full">
                                <span className="font-mono font-medium">{item.code}</span>
                                <span className="text-muted-foreground truncate pr-2">{item.description}</span>
                                <div className="justify-self-end flex items-center justify-end gap-1.5 flex-wrap max-w-[260px]">
                                  {isValidCodeOne(item.validcode) ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-400 text-emerald-700 dark:text-emerald-400">VALIDCODE: 1</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">VALIDCODE: 0</Badge>
                                  )}
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${isAccPdxPrimaryAllowed(item.accpdx) ? 'border-sky-400 text-sky-700 dark:text-sky-400' : 'border-rose-400 text-rose-700 dark:text-rose-400'}`}>
                                    ACCPDX: {isAccPdxPrimaryAllowed(item.accpdx) ? 'Y' : 'N'}
                                  </Badge>
                                  {!isValidCodeOne(item.validcode) && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                                  {diagCodes.includes(item.code.trim().toUpperCase()) && (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Kode dengan VALIDCODE 0 tetap ditampilkan. Jika diklik, akan muncul peringatan.
                      </p>
                      <p className="text-[11px] text-sky-700 dark:text-sky-400">
                        ACCPDX=Y boleh jadi diagnosa utama. ACCPDX=N hanya boleh sebagai diagnosa sekunder.
                      </p>
                      {/* Manual input */}
                      <Separator />
                      <p className="text-xs text-muted-foreground">Atau masukkan kode manual:</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Kode ICD-10 (misal: S71.0)"
                          value={diagInput}
                          onChange={e => setDiagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addDiagCode(diagInput)}
                          className="font-mono"
                        />
                        <Button variant="outline" size="sm" onClick={() => addDiagCode(diagInput)} disabled={!diagInput.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Current selection preview */}
                      {diagCodes.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1.5">Kode terpilih ({diagCodes.length}):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {diagCodes.map((code, i) => (
                              <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                                {i === 0 && <span className="text-[10px] text-muted-foreground mr-0.5">P:</span>}
                                {code}
                                <button type="button" onClick={() => removeDiagCode(i)} className="ml-0.5 hover:text-destructive">
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button size="sm" onClick={handleSetDiagnosa} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                  Set Diagnosa iDRG
                </Button>
              </div>
            )}

            {/* Expanded result */}
            {diagExpanded.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hasil validasi:</p>
                <div className="rounded border divide-y text-xs">
                  {diagExpanded.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                      {item.validcode === '1' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-mono font-medium shrink-0">{item.code}</span>
                      <span className="text-muted-foreground truncate">{item.display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>
            {/* --- Prosedur --- */}
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Prosedur (ICD-9-CM IM)</Label>
              {detail.idrg_procedure && (
                <span className="text-xs text-muted-foreground font-mono">{detail.idrg_procedure}</span>
              )}
            </div>

            {/* Entries */}
            {procEntries.length > 0 && (
              <div className="space-y-1">
                {procEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="font-mono gap-1">
                      {entry.code}
                      {entry.multiplicity > 1 && <span className="text-muted-foreground">+{entry.multiplicity}</span>}
                    </Badge>
                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={entry.multiplicity}
                          onChange={e => updateProcMultiplicity(i, parseInt(e.target.value) || 1)}
                          className="w-14 h-6 text-xs text-center"
                        />
                        <button type="button" onClick={() => removeProcEntry(i)} className="hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add + Set buttons */}
            {!disabled && (
              <div className="flex gap-2">
                <Dialog open={procDialogOpen} onOpenChange={setProcDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Tambah Prosedur
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Cari & Tambah Prosedur ICD-9-CM IM</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {/* Search */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Cari prosedur... (misal: 81.51 atau appendectomy)"
                          value={procSearchKeyword}
                          onChange={e => setProcSearchKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && searchProcedure()}
                          autoFocus
                        />
                        <Button variant="outline" size="sm" onClick={searchProcedure} disabled={procSearching}>
                          {procSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      {/* Search results */}
                      {procSearchResults.length > 0 && (
                        <div className="max-h-64 overflow-y-auto rounded border bg-background divide-y">
                          {procSearchResults.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              className={`w-full text-left px-3 py-2.5 text-xs ${isValidCodeOne(item.validcode) ? 'hover:bg-accent' : 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                              onClick={() => addProcFromSearch(item)}
                            >
                              <div className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 w-full">
                                <span className="font-mono font-medium">{item.code}</span>
                                <span className="text-muted-foreground truncate pr-2">{item.description}</span>
                                <div className="justify-self-end flex items-center justify-end gap-1.5 flex-wrap max-w-[260px]">
                                  {isValidCodeOne(item.validcode) ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-400 text-emerald-700 dark:text-emerald-400">VALIDCODE: 1</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">VALIDCODE: 0</Badge>
                                  )}
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${isAccPdxPrimaryAllowed(item.accpdx) ? 'border-sky-400 text-sky-700 dark:text-sky-400' : 'border-rose-400 text-rose-700 dark:text-rose-400'}`}>
                                    ACCPDX: {isAccPdxPrimaryAllowed(item.accpdx) ? 'Y' : 'N'}
                                  </Badge>
                                  {!isValidCodeOne(item.validcode) && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                                  {!isAccPdxPrimaryAllowed(item.accpdx) && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
                                  {procEntries.some((e) => e.code.trim().toUpperCase() === item.code.trim().toUpperCase()) && (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Prosedur dengan VALIDCODE 0 tetap ditampilkan. Jika diklik, akan muncul peringatan.
                      </p>
                      <p className="text-[11px] text-sky-700 dark:text-sky-400">
                        Prosedur dengan ACCPDX=N tetap ditampilkan. Jika diklik, akan muncul peringatan.
                      </p>
                      {/* Manual input */}
                      <Separator />
                      <p className="text-xs text-muted-foreground">Atau masukkan kode manual:</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Kode ICD-9-CM (misal: 81.51)"
                          value={procInput}
                          onChange={e => setProcInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProcEntry(procInput)}
                          className="font-mono flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          placeholder="x"
                          value={procMultiplicity}
                          onChange={e => setProcMultiplicity(parseInt(e.target.value) || 1)}
                          className="w-16 text-center"
                        />
                        <Button variant="outline" size="sm" onClick={() => addProcEntry(procInput)} disabled={!procInput.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Current selection preview */}
                      {procEntries.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1.5">Prosedur terpilih ({procEntries.length}):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {procEntries.map((entry, i) => (
                              <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                                {entry.code}
                                {entry.multiplicity > 1 && <span className="text-muted-foreground">+{entry.multiplicity}</span>}
                                <button type="button" onClick={() => removeProcEntry(i)} className="ml-0.5 hover:text-destructive">
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button size="sm" onClick={handleSetProcedure} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                  Set Prosedur iDRG
                </Button>
              </div>
            )}

            {/* Expanded result */}
            {procExpanded.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hasil validasi:</p>
                <div className="rounded border divide-y text-xs">
                  {procExpanded.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                      {item.validcode === '1' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-mono font-medium shrink-0">{item.code}</span>
                      {item.multiplicity && item.multiplicity > 1 && (
                        <span className="text-muted-foreground">x{item.multiplicity}</span>
                      )}
                      <span className="text-muted-foreground truncate">{item.display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* ===== GROUPER RESULT — hidden when editing ===== */}
      {(detail.idrg_code || grouperParsed) && !codingEditMode && (
        (() => {
          const isFinal = !!detail.idrg_final_success;
          const formatDateTime = (value?: string) => {
            if (!value) return '';
            const dt = new Date(value);
            if (Number.isNaN(dt.getTime())) return value;
            return new Intl.DateTimeFormat('id-ID', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(dt);
          };
          const jenisRawatLabel = (() => {
            const jr = String(detail.jenis_rawat || '').trim();
            if (jr === '1') return '1 - Rawat Inap (RI)';
            if (jr === '2') return '2 - Rawat Jalan (RJ)';
            return jr || '-';
          })();
          const mdcDescription = String(grouperParsed?.mdc_description || '').trim();
          const drgDescription = String(detail.idrg_description || grouperParsed?.drg_description || '').trim();
          const isUngroupableIDRG = /ungroupable|unrelated/.test(`${mdcDescription} ${drgDescription}`.toLowerCase());
          const infoParts = [
            formatDateTime(detail.idrg_grouper_sent_at || ''),
            grouperParsed?.script_version || '',
            grouperParsed?.logic_version || '',
          ].filter(Boolean);

          const rowClass = isFinal
            ? 'border-b border-[#b7c7b7]'
            : 'border-b border-[#c9c9c9]';
          const leftCellClass = isFinal
            ? 'w-44 px-3 py-2 text-right border-r border-[#b7c7b7] font-medium text-[#111]'
            : 'w-44 px-3 py-2 text-right border-r border-[#c9c9c9] font-medium text-[#111]';
          const rightCellClass = 'px-3 py-2 text-[#111]';

          return (
            <div className={`rounded border overflow-hidden ${isFinal ? 'bg-[#d6e4d6] border-[#b7c7b7]' : 'bg-[#f2f2f2] border-[#c9c9c9]'}`}>
              <div className={`text-center font-semibold py-2 ${isFinal ? 'bg-[#bccfbc]' : 'bg-[#e8e8e8]'}`}>
                {isFinal ? 'Hasil Grouping iDRG - Final' : 'Hasil Grouping iDRG'}
              </div>

              <table className="w-full text-sm border-collapse">
                <tbody>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>Info</td>
                    <td className={rightCellClass}>{infoParts.length > 0 ? infoParts.join(' | ') : '-'}</td>
                  </tr>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>Jenis Rawat</td>
                    <td className={rightCellClass}>{jenisRawatLabel}</td>
                  </tr>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>MDC</td>
                    <td className={rightCellClass}>
                      <div className="flex justify-between gap-3">
                        <span className={isUngroupableIDRG ? 'text-red-600 font-semibold' : ''}>{grouperParsed?.mdc_description || '-'}</span>
                        <span className="font-mono">{grouperParsed?.mdc_number || '-'}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>DRG</td>
                    <td className={rightCellClass}>
                      <div className="flex justify-between gap-3">
                        <span className={isUngroupableIDRG ? 'text-red-600 font-semibold' : ''}>{detail.idrg_description || grouperParsed?.drg_description || '-'}</span>
                        <span className="font-mono">{detail.idrg_code || grouperParsed?.drg_code || '-'}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>Cost Weight ** )</td>
                    <td className={rightCellClass}>{detail.idrg_cost_weight || grouperParsed?.total_cost_weight || '-'}</td>
                  </tr>
                  <tr className={rowClass}>
                    <td className={leftCellClass}>NBR ** )</td>
                    <td className={rightCellClass}>{grouperParsed?.nbr || '-'}</td>
                  </tr>
                  <tr>
                    <td className={leftCellClass}>Status</td>
                    <td className={rightCellClass}>{detail.idrg_status_cd || grouperParsed?.status_cd || (isFinal ? 'final' : '-')}</td>
                  </tr>
                </tbody>
              </table>

              <div className={`px-3 py-2 text-blue-700 italic text-sm ${isFinal ? 'border-t border-[#b7c7b7]' : 'border-t border-[#c9c9c9]'}`}>
                ** ) Catatan: Nilai belum final, sewaktu-waktu bisa berubah
              </div>

              <div className={`px-3 py-2 min-h-12 flex items-center justify-end gap-2 ${isFinal ? 'border-t border-[#b7c7b7]' : 'border-t border-[#c9c9c9]'}`}>
                {/* Grouping iDRG */}
                {buttons.grouping_idrg && !disabled && (!grouped || codingEditMode) && (
                  <Button size="sm" onClick={handleGrouper} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1 h-4 w-4" />}
                    Grouping iDRG
                  </Button>
                )}
                {isUngroupableIDRG && !disabled && (
                  <p className="text-xs text-red-600 self-center">
                    Hasil grouper menunjukkan ungroupable/unrelated. Final iDRG dinonaktifkan.
                  </p>
                )}
                {/* Ubah Coding iDRG: when grouped, not final, not already editing */}
                {grouped && !disabled && !codingEditMode && (
                  <Button variant="outline" size="sm" onClick={() => setCodingEditMode(true)}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Ubah Coding iDRG
                  </Button>
                )}
                {/* Final iDRG button: show after valid grouping */}
                {grouped && !disabled && !isUngroupableIDRG && (
                  <Button
                    size="sm"
                    onClick={handleFinal}
                    disabled={submitting || !buttons.final_idrg}
                  >
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                    Final iDRG
                  </Button>
                )}
                {/* Edit Ulang iDRG: show when final */}
                {buttons.reedit_idrg && disabled && (
                  <Button variant="outline" size="sm" onClick={handleReedit} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
                    Edit Ulang iDRG
                  </Button>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* ==================== GROUPING / UBAH / FINAL / REEDIT — same row ==================== */}
      {(!(detail.idrg_code || grouperParsed) || codingEditMode) && (
      <div className="flex flex-wrap items-center gap-2">
        {/* Grouping iDRG */}
        {buttons.grouping_idrg && !disabled && (!grouped || codingEditMode) && (
          <Button size="sm" onClick={handleGrouper} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1 h-4 w-4" />}
            Grouping iDRG
          </Button>
        )}
        {/* Ubah Coding iDRG: when grouped, not final, not already editing */}
        {grouped && !disabled && !codingEditMode && (
          <Button variant="outline" size="sm" onClick={() => setCodingEditMode(true)}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Ubah Coding iDRG
          </Button>
        )}
        {/* Final iDRG button: show after valid grouping */}
        {grouped && !disabled && !codingEditMode && (
          <Button
            size="sm"
            onClick={handleFinal}
            disabled={submitting || !buttons.final_idrg}
          >
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
            Final iDRG
          </Button>
        )}
        {/* Warning if grouped but ungroupable */}
        {grouped && !disabled && detail.idrg_status_cd && detail.idrg_status_cd !== 'normal' && (
          <p className="text-xs text-destructive self-center">
            Status "{detail.idrg_status_cd}" — tidak dapat di-finalisasi. Perbaiki coding terlebih dahulu.
          </p>
        )}
        {/* Edit Ulang iDRG: show when final */}
        {buttons.reedit_idrg && disabled && (
          <Button variant="outline" size="sm" onClick={handleReedit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
            Edit Ulang iDRG
          </Button>
        )}
      </div>
      )}

      {/* Raw Response JSON — Dialog modal */}
      {detail.idrg_grouper_response && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Code2 className="h-3.5 w-3.5" />
              Lihat Raw Response JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Raw Response JSON — iDRG Grouper</DialogTitle>
            </DialogHeader>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{
              (() => {
                try { return JSON.stringify(JSON.parse(detail.idrg_grouper_response), null, 2); }
                catch { return detail.idrg_grouper_response; }
              })()
            }</pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
