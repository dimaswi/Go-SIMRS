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
        im: !!item.im,
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
        im: !!item.im,
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

  const removeProcEntry = (index: number) => {
    setProcEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateProcMultiplicity = (index: number, mult: number) => {
    setProcEntries(prev => prev.map((e, i) => i === index ? { ...e, multiplicity: mult } : e));
  };

  // ========= API Actions =========
  const handleSetDiagnosa = async () => {
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
      await eklaimLocalApi.sendGrouperIDRG(detail.id);
      setGroupedOverride(true);  // immediately hide coding form
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
          <div className="rounded-lg border p-4 space-y-4">
            {/* --- Diagnosa --- */}
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
                  <DialogContent className="max-w-lg">
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
                        <div className="max-h-60 overflow-y-auto rounded border bg-muted/50 divide-y">
                          {diagSearchResults.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent text-xs flex items-center gap-2"
                              onClick={() => addDiagCode(item.code)}
                            >
                              <span className="font-mono font-medium shrink-0">{item.code}</span>
                              <span className="text-muted-foreground truncate">{item.description}</span>
                              {item.im && (
                                <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-4 border-blue-400 text-blue-600 dark:text-blue-400">IM</Badge>
                              )}
                              {diagCodes.includes(item.code.trim().toUpperCase()) && (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 ml-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
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

            <Separator />

            {/* --- Prosedur --- */}
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
                  <DialogContent className="max-w-lg">
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
                        <div className="max-h-60 overflow-y-auto rounded border bg-muted/50 divide-y">
                          {procSearchResults.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent text-xs flex items-center gap-2"
                              onClick={() => addProcEntry(item.code)}
                            >
                              <span className="font-mono font-medium shrink-0">{item.code}</span>
                              <span className="text-muted-foreground truncate">{item.description}</span>
                              {item.im && (
                                <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-4 border-blue-400 text-blue-600 dark:text-blue-400">IM</Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
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

          <Separator />
        </>
      )}

      {/* ===== GROUPER RESULT — always visible when data exists ===== */}
      {(detail.idrg_code || grouperParsed) && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Hasil Grouping iDRG</Label>
              <p className="text-xs text-muted-foreground">Hasil grouper iDRG</p>
            </div>
            {grouped && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" /> Grouped
              </Badge>
            )}
          </div>

          {/* Main result card */}
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Hasil Grouping iDRG
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">DRG Code</p>
                <p className="font-mono text-lg font-bold text-indigo-700 dark:text-indigo-300">
                  {detail.idrg_code || grouperParsed?.drg_code || '-'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-muted-foreground text-xs">Deskripsi DRG</p>
                <p className="font-medium">
                  {detail.idrg_description || grouperParsed?.drg_description || '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge
                  variant={(detail.idrg_status_cd || grouperParsed?.status_cd) === 'normal' ? 'default' : 'destructive'}
                  className="text-xs mt-0.5"
                >
                  {detail.idrg_status_cd || grouperParsed?.status_cd || '-'}
                </Badge>
              </div>
            </div>

            {/* Cost weight breakdown */}
            <Separator className="my-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total Cost Weight</p>
                <p className="font-mono text-base font-bold">
                  {detail.idrg_cost_weight || grouperParsed?.total_cost_weight || '-'}
                </p>
              </div>
              {grouperParsed?.cost_weight && (
                <div>
                  <p className="text-muted-foreground text-xs">Acute Weight</p>
                  <p className="font-mono font-medium">{grouperParsed.cost_weight}</p>
                </div>
              )}
              {grouperParsed?.sub_acute_weight && (
                <div>
                  <p className="text-muted-foreground text-xs">Sub-Acute Weight</p>
                  <p className="font-mono font-medium">{grouperParsed.sub_acute_weight}</p>
                </div>
              )}
              {grouperParsed?.chronic_weight && (
                <div>
                  <p className="text-muted-foreground text-xs">Chronic Weight</p>
                  <p className="font-mono font-medium">{grouperParsed.chronic_weight}</p>
                </div>
              )}
            </div>

            {/* MDC info */}
            {grouperParsed?.mdc_number && (
              <>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">MDC</p>
                    <p className="font-mono font-medium">{grouperParsed.mdc_number}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs">MDC Deskripsi</p>
                    <p className="font-medium">{grouperParsed.mdc_description || '-'}</p>
                  </div>
                  {grouperParsed.nbr && (
                    <div>
                      <p className="text-muted-foreground text-xs">NBR</p>
                      <p className="font-mono font-medium">{grouperParsed.nbr}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Version info */}
            {(grouperParsed?.script_version || grouperParsed?.logic_version) && (
              <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
                {grouperParsed.script_version && <span>Script: {grouperParsed.script_version}</span>}
                {grouperParsed.logic_version && <span>Logic: {grouperParsed.logic_version}</span>}
              </div>
            )}
          </div>

          {/* Ungroupable warning */}
          {(detail.idrg_status_cd || grouperParsed?.status_cd) &&
           (detail.idrg_status_cd || grouperParsed?.status_cd) !== 'normal' && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Status Tidak Normal</p>
                <p className="text-xs text-destructive/80">
                  Grouping menghasilkan status "{detail.idrg_status_cd || grouperParsed?.status_cd}".
                  Periksa kembali diagnosa dan prosedur yang diinput, atau konsultasikan dengan koder.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== GROUPING / UBAH / FINAL / REEDIT — same row ==================== */}
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
        {grouped && !disabled && (
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
