import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
  Download,
  Code2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface INACBGCodingTabProps {
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
  no: string;
  validcode: string;
  metadata?: { code: string; message: string; error_no?: string };
}

interface SpecialCMGOptionItem {
  code: string;
  description: string;
  type: string;
}

export default function INACBGCodingTab({ detail, onRefresh }: INACBGCodingTabProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [diagDialogOpen, setDiagDialogOpen] = useState(false);
  const [procDialogOpen, setProcDialogOpen] = useState(false);

  // After grouping: hide entire coding form, only show result.
  // "Ubah Coding" re-shows the form for re-coding / re-grouping.
  const grouped = detail.inacbg_grouper_stage1_success || detail.inacbg_grouper_stage2_success;
  const [codingEditMode, setCodingEditMode] = useState(false);
  const showCodingForm = !grouped || codingEditMode;

  // Diagnosa state
  const [diagCodes, setDiagCodes] = useState<string[]>(() => {
    if (detail.inacbg_diagnosa) return detail.inacbg_diagnosa.split('#').filter(Boolean);
    return [];
  });
  const [diagInput, setDiagInput] = useState('');
  const [diagSearchKeyword, setDiagSearchKeyword] = useState('');
  const [diagSearchResults, setDiagSearchResults] = useState<SearchResultItem[]>([]);
  const [diagSearching, setDiagSearching] = useState(false);
  const [diagExpanded, setDiagExpanded] = useState<ExpandedItem[]>(() => {
    if (detail.inacbg_diagnosa_response) {
      try {
        const parsed = JSON.parse(detail.inacbg_diagnosa_response);
        return parsed?.expanded || parsed?.data?.expanded || [];
      } catch { return []; }
    }
    return [];
  });

  // Procedure state
  const [procCodes, setProcCodes] = useState<string[]>(() => {
    if (detail.inacbg_procedure) return detail.inacbg_procedure.split('#').filter(Boolean);
    return [];
  });
  const [procInput, setProcInput] = useState('');
  const [procSearchKeyword, setProcSearchKeyword] = useState('');
  const [procSearchResults, setProcSearchResults] = useState<SearchResultItem[]>([]);
  const [procSearching, setProcSearching] = useState(false);
  const [procExpanded, setProcExpanded] = useState<ExpandedItem[]>(() => {
    if (detail.inacbg_procedure_response) {
      try {
        const parsed = JSON.parse(detail.inacbg_procedure_response);
        return parsed?.expanded || parsed?.data?.expanded || [];
      } catch { return []; }
    }
    return [];
  });

  // Special CMG
  const specialCMGOptions: SpecialCMGOptionItem[] = (() => {
    if (detail.special_cmg_options) {
      try { return JSON.parse(detail.special_cmg_options) || []; } catch { return []; }
    }
    return [];
  })();
  const [selectedCMG, setSelectedCMG] = useState<string[]>(() => {
    if (detail.selected_special_cmg) return detail.selected_special_cmg.split('#').filter(Boolean);
    return [];
  });

  const disabled = detail.inacbg_final_success;
  const buttons = detail.buttons || {};

  // Sync local state when detail prop changes (e.g. after onRefresh)
  useEffect(() => {
    const codes = detail.inacbg_diagnosa ? detail.inacbg_diagnosa.split('#').filter(Boolean) : [];
    setDiagCodes(codes);
  }, [detail.inacbg_diagnosa]);

  useEffect(() => {
    if (detail.inacbg_diagnosa_response) {
      try {
        const parsed = JSON.parse(detail.inacbg_diagnosa_response);
        setDiagExpanded(parsed?.data?.expanded || parsed?.expanded || []);
      } catch { setDiagExpanded([]); }
    } else {
      setDiagExpanded([]);
    }
  }, [detail.inacbg_diagnosa_response]);

  useEffect(() => {
    const codes = detail.inacbg_procedure ? detail.inacbg_procedure.split('#').filter(Boolean) : [];
    setProcCodes(codes);
  }, [detail.inacbg_procedure]);

  useEffect(() => {
    if (detail.inacbg_procedure_response) {
      try {
        const parsed = JSON.parse(detail.inacbg_procedure_response);
        setProcExpanded(parsed?.data?.expanded || parsed?.expanded || []);
      } catch { setProcExpanded([]); }
    } else {
      setProcExpanded([]);
    }
  }, [detail.inacbg_procedure_response]);

  useEffect(() => {
    const cmg = detail.selected_special_cmg ? detail.selected_special_cmg.split('#').filter(Boolean) : [];
    setSelectedCMG(cmg);
  }, [detail.selected_special_cmg]);

  // Auto-close coding form when grouping succeeds
  useEffect(() => {
    if (detail.inacbg_grouper_stage1_success || detail.inacbg_grouper_stage2_success) {
      setCodingEditMode(false);
    }
  }, [detail.inacbg_grouper_stage1_success, detail.inacbg_grouper_stage2_success]);

  // ========= Diagnosa Search =========
  const searchDiagnosa = useCallback(async () => {
    if (!diagSearchKeyword.trim()) return;
    setDiagSearching(true);
    try {
      const res = await eklaimLocalApi.searchDiagnosisINACBG(diagSearchKeyword.trim());
      const raw = res?.data;
      const data: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setDiagSearchResults(data.map((item: any) => ({ code: item.code || item[1] || '', description: item.description || item[0] || '', im: !!item.im })));
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
      const res = await eklaimLocalApi.searchProceduresINACBG(procSearchKeyword.trim());
      const raw = res?.data;
      const data: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setProcSearchResults(data.map((item: any) => ({ code: item.code || item[1] || '', description: item.description || item[0] || '', im: !!item.im })));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal mencari prosedur.' });
    } finally {
      setProcSearching(false);
    }
  }, [procSearchKeyword, toast]);

  const addProcCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || procCodes.includes(trimmed)) return;
    setProcCodes(prev => [...prev, trimmed]);
    setProcInput('');
  };

  const removeProcCode = (index: number) => {
    setProcCodes(prev => prev.filter((_, i) => i !== index));
  };

  // ========= Special CMG Toggle =========
  const toggleCMG = (code: string) => {
    setSelectedCMG(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // ========= API Actions =========
  const handleImport = async () => {
    setSubmitting(true);
    try {
      const res = await eklaimLocalApi.sendImportINACBG(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Import iDRG ke INACBG berhasil.' });
      // Update local codes from import response
      // Backend returns: { response: { data: { diagnosa: { string, expanded }, procedure: { string, expanded } } } }
      const importData = res?.response?.data || res?.data || res;
      if (importData?.diagnosa?.string) {
        setDiagCodes(importData.diagnosa.string.split('#').filter(Boolean));
        setDiagExpanded(importData.diagnosa.expanded || []);
      }
      if (importData?.procedure?.string) {
        setProcCodes(importData.procedure.string.split('#').filter(Boolean));
        setProcExpanded(importData.procedure.expanded || []);
      }
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal import iDRG ke INACBG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDiagnosa = async () => {
    if (diagCodes.length === 0) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Masukkan minimal 1 kode diagnosa.' });
      return;
    }
    setSubmitting(true);
    try {
      const diagnosa = diagCodes.join('#');
      const res = await eklaimLocalApi.sendINACBGDiagnosaSet(detail.id, { diagnosa });
      const expanded = res?.response?.data?.expanded || res?.data?.expanded || res?.expanded || [];
      setDiagExpanded(expanded);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Diagnosa INACBG berhasil diset.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal set diagnosa INACBG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetProcedure = async () => {
    if (procCodes.length === 0) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Masukkan minimal 1 kode prosedur.' });
      return;
    }
    setSubmitting(true);
    try {
      const procedure = procCodes.join('#');
      const res = await eklaimLocalApi.sendINACBGProcedureSet(detail.id, { procedure });
      const expanded = res?.response?.data?.expanded || res?.data?.expanded || res?.expanded || [];
      setProcExpanded(expanded);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Prosedur INACBG berhasil diset.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal set prosedur INACBG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrouperStage1 = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.sendGrouperINACBGStage1(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Grouping INACBG Stage 1 berhasil.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal grouping INACBG stage 1.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrouperStage2 = async () => {
    setSubmitting(true);
    try {
      const special_cmg = selectedCMG.join('#');
      await eklaimLocalApi.sendGrouperINACBGStage2(detail.id, { special_cmg });
      toast({ variant: 'success', title: 'Berhasil!', description: 'Grouping INACBG Stage 2 berhasil.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal grouping INACBG stage 2.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinal = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.sendFinalINACBG(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'INACBG berhasil di-finalisasi.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal finalisasi INACBG.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReedit = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.sendReeditINACBG(detail.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'INACBG berhasil di-reedit.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal reedit INACBG.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency for tariff display
  const formatCurrency = (value?: string | number) => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Coding INACBG</h3>
          <p className="text-xs text-muted-foreground">
            Coding diagnosa dan prosedur untuk INACBG grouping (INA-CBG)
          </p>
        </div>
        {disabled && (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" /> INACBG Final
          </Badge>
        )}
      </div>

      {/* ===== CODING FORM — hidden after grouping, re-shown via "Ubah Coding" ===== */}
      {showCodingForm && (
        <>
          {/* ==================== IMPORT FROM iDRG ==================== */}
          {!disabled && (
            <div className="rounded-lg border border-dashed p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Import dari iDRG</p>
                  <p className="text-xs text-muted-foreground">
                    Import kode diagnosa dan prosedur dari iDRG ke INACBG.
                    {detail.inacbg_import_response && ' (Sudah pernah import)'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleImport} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                  Import
                </Button>
              </div>
            </div>
          )}

          {/* ==================== DIAGNOSA & PROSEDUR ==================== */}
          <div className="rounded-lg border p-4 space-y-4">
            {/* --- Diagnosa --- */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Diagnosa (ICD-10)</Label>
              {detail.inacbg_diagnosa && (
                <span className="text-xs text-muted-foreground font-mono">{detail.inacbg_diagnosa}</span>
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
                      <DialogTitle>Cari & Tambah Diagnosa ICD-10</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {/* Search */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Cari diagnosa INACBG..."
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
                              className={`w-full text-left px-3 py-2 hover:bg-accent text-xs flex items-center gap-2 ${item.im ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                              onClick={() => addDiagCode(item.code)}
                            >
                              <span className="font-mono font-medium shrink-0">{item.code}</span>
                              <span className="text-muted-foreground truncate">{item.description}</span>
                              {item.im && (
                                <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0 h-4">IM - TIDAK BERLAKU</Badge>
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
                          placeholder="Kode ICD-10"
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
                <Button size="sm" onClick={handleSetDiagnosa} disabled={submitting || diagCodes.length === 0}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                  Set Diagnosa INACBG
                </Button>
              </div>
            )}

            {/* Expanded result */}
            {diagExpanded.length > 0 && (
              <div className="space-y-2">
                {diagExpanded.some(item => item.validcode !== '1') && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-destructive">Kode Tidak Valid pada INACBG (IM)</p>
                      <p className="text-xs text-destructive/80">
                        Terdapat kode diagnosa yang tidak berlaku pada INACBG. Kode bertanda IM harus diganti dengan kode yang valid untuk INACBG agar grouping menghasilkan hasil yang benar.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Hasil validasi:</p>
                <div className="rounded border divide-y text-xs">
                  {diagExpanded.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-1.5 ${item.validcode !== '1' ? 'bg-destructive/5' : ''}`}>
                      {item.validcode === '1' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-mono font-medium shrink-0">{item.code}</span>
                      <span className="text-muted-foreground truncate">{item.display}</span>
                      {item.validcode !== '1' && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">TIDAK BERLAKU</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* --- Prosedur --- */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Prosedur (ICD-9-CM)</Label>
              {detail.inacbg_procedure && (
                <span className="text-xs text-muted-foreground font-mono">{detail.inacbg_procedure}</span>
              )}
            </div>

            {/* Code chips */}
            {procCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {procCodes.map((code, i) => (
                  <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                    {code}
                    {!disabled && (
                      <button type="button" onClick={() => removeProcCode(i)} className="ml-0.5 hover:text-destructive">
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
                <Dialog open={procDialogOpen} onOpenChange={setProcDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Tambah Prosedur
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Cari & Tambah Prosedur ICD-9-CM</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {/* Search */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Cari prosedur INACBG..."
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
                              className={`w-full text-left px-3 py-2 hover:bg-accent text-xs flex items-center gap-2 ${item.im ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                              onClick={() => addProcCode(item.code)}
                            >
                              <span className="font-mono font-medium shrink-0">{item.code}</span>
                              <span className="text-muted-foreground truncate">{item.description}</span>
                              {item.im && (
                                <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0 h-4">IM - TIDAK BERLAKU</Badge>
                              )}
                              {procCodes.includes(item.code.trim().toUpperCase()) && (
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
                          placeholder="Kode ICD-9-CM"
                          value={procInput}
                          onChange={e => setProcInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProcCode(procInput)}
                          className="font-mono"
                        />
                        <Button variant="outline" size="sm" onClick={() => addProcCode(procInput)} disabled={!procInput.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Current selection preview */}
                      {procCodes.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1.5">Prosedur terpilih ({procCodes.length}):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {procCodes.map((code, i) => (
                              <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                                {code}
                                <button type="button" onClick={() => removeProcCode(i)} className="ml-0.5 hover:text-destructive">
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
                <Button size="sm" onClick={handleSetProcedure} disabled={submitting || procCodes.length === 0}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                  Set Prosedur INACBG
                </Button>
              </div>
            )}

            {/* Expanded result */}
            {procExpanded.length > 0 && (
              <div className="space-y-2">
                {procExpanded.some(item => item.validcode !== '1') && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-destructive">Kode Prosedur Tidak Valid pada INACBG (IM)</p>
                      <p className="text-xs text-destructive/80">
                        Terdapat kode prosedur yang tidak berlaku pada INACBG. Ganti dengan kode yang valid agar grouping akurat.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Hasil validasi:</p>
                <div className="rounded border divide-y text-xs">
                  {procExpanded.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-1.5 ${item.validcode !== '1' ? 'bg-destructive/5' : ''}`}>
                      {item.validcode === '1' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-mono font-medium shrink-0">{item.code}</span>
                      <span className="text-muted-foreground truncate">{item.display}</span>
                      {item.validcode !== '1' && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">TIDAK BERLAKU</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Special CMG (shown after stage 1) */}
          {specialCMGOptions.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Special CMG Options</p>
                <p className="text-xs text-muted-foreground">Pilih special CMG yang berlaku untuk klaim ini</p>
              </div>
              <div className="space-y-2">
                {specialCMGOptions.map((opt, i) => (
                  <label key={i} className="flex items-start gap-3 p-2 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={selectedCMG.includes(opt.code)}
                      onCheckedChange={() => toggleCMG(opt.code)}
                      disabled={disabled}
                    />
                    <div className="text-sm">
                      <p className="font-mono font-medium">{opt.code}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                      {opt.type && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">{opt.type}</Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== GROUPER RESULT — always visible when data exists ===== */}
      {detail.inacbg_cbg_code && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Hasil Grouping INACBG</Label>
              <p className="text-xs text-muted-foreground">Hasil grouper INACBG</p>
            </div>
            {grouped && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" /> Grouped
              </Badge>
            )}
          </div>

          <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-3 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Hasil Grouping INACBG
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Kode CBG</p>
                <p className="font-mono text-lg font-bold text-teal-700 dark:text-teal-300">
                  {detail.inacbg_cbg_code}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-muted-foreground text-xs">Deskripsi</p>
                <p className="font-medium">{detail.inacbg_cbg_description || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge
                  variant={detail.inacbg_status_cd === 'normal' ? 'default' : 'destructive'}
                  className="text-xs mt-0.5"
                >
                  {detail.inacbg_status_cd || '-'}
                </Badge>
              </div>
            </div>

            <Separator className="my-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Base Tarif</p>
                <p className="font-mono font-medium">{formatCurrency(detail.inacbg_base_tariff)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tarif INACBG</p>
                <p className="font-mono text-base font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(detail.inacbg_tariff)}
                </p>
              </div>
            </div>
          </div>

          {/* Ungroupable warning */}
          {detail.inacbg_status_cd && detail.inacbg_status_cd !== 'normal' && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Status Tidak Normal</p>
                <p className="text-xs text-destructive/80">
                  Status "{detail.inacbg_status_cd}" — periksa kembali coding diagnosa dan prosedur.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== GROUPING / UBAH / FINAL / REEDIT — same row ==================== */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Grouping Stage 1 */}
        {buttons.grouping_inacbg && !disabled && (!grouped || codingEditMode) && (
          <Button size="sm" onClick={handleGrouperStage1} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1 h-4 w-4" />}
            Grouping Stage 1
          </Button>
        )}
        {/* Grouping Stage 2 */}
        {!disabled && specialCMGOptions.length > 0 && (
          <Button size="sm" onClick={handleGrouperStage2} disabled={submitting || selectedCMG.length === 0}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1 h-4 w-4" />}
            Grouping Stage 2
          </Button>
        )}
        {/* Ubah Coding INACBG: when grouped, not final, not already editing */}
        {grouped && !disabled && !codingEditMode && (
          <Button variant="outline" size="sm" onClick={() => setCodingEditMode(true)}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Ubah Coding INACBG
          </Button>
        )}
        {grouped && !disabled && (
          <Button
            size="sm"
            onClick={handleFinal}
            disabled={submitting || !buttons.final_inacbg}
          >
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
            Final INACBG
          </Button>
        )}
        {grouped && !disabled && detail.inacbg_status_cd && detail.inacbg_status_cd !== 'normal' && (
          <p className="text-xs text-destructive self-center">
            Status "{detail.inacbg_status_cd}" — tidak dapat di-finalisasi. Perbaiki coding terlebih dahulu.
          </p>
        )}
        {buttons.reedit_inacbg && disabled && (
          <Button variant="outline" size="sm" onClick={handleReedit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
            Edit Ulang INACBG
          </Button>
        )}
      </div>

      {/* Raw Response JSON — Dialog modal */}
      {(detail.inacbg_grouper_stage1_response || detail.inacbg_grouper_stage2_response) && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Code2 className="h-3.5 w-3.5" />
              Lihat Raw Response JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Raw Response JSON — INACBG Grouper</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {detail.inacbg_grouper_stage1_response && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Response Grouper Stage 1</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{
                    (() => {
                      try { return JSON.stringify(JSON.parse(detail.inacbg_grouper_stage1_response), null, 2); }
                      catch { return detail.inacbg_grouper_stage1_response; }
                    })()
                  }</pre>
                </div>
              )}
              {detail.inacbg_grouper_stage2_response && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Response Grouper Stage 2</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{
                    (() => {
                      try { return JSON.stringify(JSON.parse(detail.inacbg_grouper_stage2_response), null, 2); }
                      catch { return detail.inacbg_grouper_stage2_response; }
                    })()
                  }</pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
