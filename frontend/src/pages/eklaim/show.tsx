import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  eklaimApi,
  eklaimStateLabels,
  eklaimStateColors,
  procedureSettingLabels,
  jenisRawatLabels,
} from '@/lib/api/eklaim';
import type { EKlaim, EKlaimLog, EKlaimState, AddDiagnosisInput, AddProcedureInput } from '@/lib/api/eklaim';
import { icd10Api, icd9cmApi } from '@/lib/api/icd';
import type { ICD10, ICD9CM } from '@/lib/api/icd';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  ArrowLeft,
  Plus,
  X,
  CheckCircle,
  Send,
  FileCheck,
  RefreshCw,
  History,
  AlertTriangle,
  Stethoscope,
  Clipboard,
  Calculator,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EKlaimShow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [claim, setClaim] = useState<EKlaim | null>(null);
  const [logs, setLogs] = useState<EKlaimLog[]>([]);
  
  // ICD-10 search state
  const [icd10SearchOpen, setIcd10SearchOpen] = useState(false);
  const [icd10SearchValue, setIcd10SearchValue] = useState('');
  const [icd10Results, setIcd10Results] = useState<ICD10[]>([]);
  const [icd10Loading, setIcd10Loading] = useState(false);
  const debouncedIcd10Search = useDebounce(icd10SearchValue, 300);
  
  // ICD-9-CM search state  
  const [icd9SearchOpen, setIcd9SearchOpen] = useState(false);
  const [icd9SearchValue, setIcd9SearchValue] = useState('');
  const [icd9Results, setIcd9Results] = useState<ICD9CM[]>([]);
  const [icd9Loading, setIcd9Loading] = useState(false);
  const debouncedIcd9Search = useDebounce(icd9SearchValue, 300);
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search ICD-10
  useEffect(() => {
    if (debouncedIcd10Search.length >= 2) {
      setIcd10Loading(true);
      icd10Api
        .search({ search: debouncedIcd10Search, limit: 30, valid_only: true })
        .then((data) => setIcd10Results(data))
        .catch(() => setIcd10Results([]))
        .finally(() => setIcd10Loading(false));
    } else {
      setIcd10Results([]);
    }
  }, [debouncedIcd10Search]);
  
  // Search ICD-9-CM
  useEffect(() => {
    if (debouncedIcd9Search.length >= 2) {
      setIcd9Loading(true);
      icd9cmApi
        .search({ search: debouncedIcd9Search, limit: 30, valid_only: true })
        .then((data) => setIcd9Results(data))
        .catch(() => setIcd9Results([]))
        .finally(() => setIcd9Loading(false));
    } else {
      setIcd9Results([]);
    }
  }, [debouncedIcd9Search]);

  const loadData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [claimResponse, logsResponse] = await Promise.all([
        eklaimApi.getById(Number(id)),
        eklaimApi.getLogs(Number(id)),
      ]);
      setClaim(claimResponse.data);
      setLogs(logsResponse.data || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data E-Klaim.',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    setPageTitle('Detail E-Klaim');
    loadData();
  }, [loadData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Add diagnosis
  const handleAddDiagnosis = async (code: string, name: string) => {
    if (!id) return;
    
    setSaving(true);
    try {
      const input: AddDiagnosisInput = {
        code,
        name,
        is_primary: (claim?.diagnoses?.length || 0) === 0,
      };
      await eklaimApi.addDiagnosis(Number(id), input, 'idrg');
      toast({ title: 'Berhasil!', description: 'Diagnosis ditambahkan.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Gagal menambahkan diagnosis.',
      });
    } finally {
      setSaving(false);
      setIcd10SearchOpen(false);
      setIcd10SearchValue('');
    }
  };

  // Remove diagnosis
  const handleRemoveDiagnosis = async (diagnosisId: number) => {
    if (!id) return;
    
    setSaving(true);
    try {
      await eklaimApi.removeDiagnosis(Number(id), diagnosisId);
      toast({ title: 'Berhasil!', description: 'Diagnosis dihapus.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Gagal menghapus diagnosis.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Add procedure
  const handleAddProcedure = async (code: string, name: string) => {
    if (!id) return;
    
    setSaving(true);
    try {
      const input: AddProcedureInput = {
        code,
        name,
        multiplicity: 1,
        setting: 'NON_OR',
      };
      await eklaimApi.addProcedure(Number(id), input, 'idrg');
      toast({ title: 'Berhasil!', description: 'Prosedur ditambahkan.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Gagal menambahkan prosedur.',
      });
    } finally {
      setSaving(false);
      setIcd9SearchOpen(false);
      setIcd9SearchValue('');
    }
  };

  // Remove procedure
  const handleRemoveProcedure = async (procedureId: number) => {
    if (!id) return;
    
    setSaving(true);
    try {
      await eklaimApi.removeProcedure(Number(id), procedureId);
      toast({ title: 'Berhasil!', description: 'Prosedur dihapus.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Gagal menghapus prosedur.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Action handlers
  const handleGroupingIDRG = async () => {
    if (!id) return;
    setActionLoading('grouping_idrg');
    try {
      await eklaimApi.groupingIDRG(Number(id));
      toast({ title: 'Berhasil!', description: 'iDRG Grouping berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Grouping iDRG gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalIDRG = async () => {
    if (!id) return;
    setActionLoading('final_idrg');
    try {
      await eklaimApi.finalIDRG(Number(id));
      toast({ title: 'Berhasil!', description: 'iDRG Final berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Final iDRG gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportToINACBG = async () => {
    if (!id) return;
    setActionLoading('import_inacbg');
    try {
      await eklaimApi.importToINACBG(Number(id));
      toast({ title: 'Berhasil!', description: 'Import ke INA-CBG berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Import ke INA-CBG gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleGroupingINACBG = async () => {
    if (!id) return;
    setActionLoading('grouping_inacbg');
    try {
      await eklaimApi.groupingINACBG(Number(id));
      toast({ title: 'Berhasil!', description: 'INA-CBG Grouping berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Grouping INA-CBG gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalINACBG = async () => {
    if (!id) return;
    setActionLoading('final_inacbg');
    try {
      await eklaimApi.finalINACBG(Number(id));
      toast({ title: 'Berhasil!', description: 'INA-CBG Final berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Final INA-CBG gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalClaim = async () => {
    if (!id) return;
    setActionLoading('final_claim');
    try {
      await eklaimApi.finalClaim(Number(id));
      toast({ title: 'Berhasil!', description: 'Klaim Final berhasil.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Final Klaim gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendClaim = async () => {
    if (!id) return;
    setActionLoading('send_claim');
    try {
      await eklaimApi.sendClaim(Number(id));
      toast({ title: 'Berhasil!', description: 'Klaim berhasil dikirim ke BPJS.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Kirim Klaim gagal.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Get available actions based on button visibility from backend
  const getAvailableActions = () => {
    if (!claim?.buttons) return [];
    
    const actions: Array<{
      key: string;
      label: string;
      onClick: () => void;
      icon: React.ReactNode;
      variant?: 'default' | 'secondary' | 'destructive' | 'outline';
      confirm?: boolean;
    }> = [];

    if (claim.buttons.grouping_idrg) {
      actions.push({
        key: 'grouping_idrg',
        label: 'Grouping iDRG',
        onClick: handleGroupingIDRG,
        icon: <Calculator className="mr-2 h-4 w-4" />,
        variant: 'default',
      });
    }

    if (claim.buttons.final_idrg) {
      actions.push({
        key: 'final_idrg',
        label: 'Final iDRG',
        onClick: handleFinalIDRG,
        icon: <CheckCircle className="mr-2 h-4 w-4" />,
        variant: 'default',
      });
    }

    // After iDRG Final, we can import to INACBG
    if (claim.state === 'IDRG_FINAL') {
      actions.push({
        key: 'import_inacbg',
        label: 'Import ke INA-CBG',
        onClick: handleImportToINACBG,
        icon: <RefreshCw className="mr-2 h-4 w-4" />,
        variant: 'default',
      });
    }

    if (claim.buttons.grouping_inacbg) {
      actions.push({
        key: 'grouping_inacbg',
        label: 'Grouping INA-CBG',
        onClick: handleGroupingINACBG,
        icon: <Calculator className="mr-2 h-4 w-4" />,
        variant: 'secondary',
      });
    }

    if (claim.buttons.final_inacbg) {
      actions.push({
        key: 'final_inacbg',
        label: 'Final INA-CBG',
        onClick: handleFinalINACBG,
        icon: <CheckCircle className="mr-2 h-4 w-4" />,
        variant: 'default',
      });
    }

    if (claim.buttons.final_claim) {
      actions.push({
        key: 'final_claim',
        label: 'Final Klaim',
        onClick: handleFinalClaim,
        icon: <FileCheck className="mr-2 h-4 w-4" />,
        variant: 'default',
        confirm: true,
      });
    }

    if (claim.buttons.send_claim) {
      actions.push({
        key: 'send_claim',
        label: 'Kirim ke BPJS',
        onClick: handleSendClaim,
        icon: <Send className="mr-2 h-4 w-4" />,
        variant: 'default',
        confirm: true,
      });
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded-lg border">
          <div className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Data E-Klaim tidak ditemukan.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/eklaim')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canEdit = !claim.buttons?.form_disabled;
  const availableActions = getAvailableActions();
  const diagnoses = claim.diagnoses || [];
  const procedures = claim.procedures || [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/eklaim')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  E-Klaim: {claim.no_sep || 'Draft'}
                </h1>
                <Badge className={eklaimStateColors[claim.state] || ''}>
                  {eklaimStateLabels[claim.state] || claim.state}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                No. Kartu BPJS: {claim.no_kartu} • {jenisRawatLabels[claim.jenis_rawat] || claim.jenis_rawat}
              </p>
            </div>
            
            <div className="flex gap-2">
              {availableActions.map((action) => (
                action.confirm ? (
                  <AlertDialog key={action.key}>
                    <AlertDialogTrigger asChild>
                      <Button variant={action.variant} disabled={actionLoading === action.key}>
                        {actionLoading === action.key ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          action.icon
                        )}
                        {action.label}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin melakukan {action.label}? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={action.onClick}>
                          Ya, Lanjutkan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    key={action.key}
                    variant={action.variant}
                    onClick={action.onClick}
                    disabled={actionLoading === action.key}
                  >
                    {actionLoading === action.key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      action.icon
                    )}
                    {action.label}
                  </Button>
                )
              ))}
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border p-6">
          {/* Patient Info Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label className="text-xs text-muted-foreground">Tipe Pelayanan</Label>
              <p className="font-medium">{jenisRawatLabels[claim.jenis_rawat || ''] || claim.jenis_rawat}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tanggal Masuk</Label>
              <p className="font-medium">{formatDate(claim.tgl_masuk)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tanggal Keluar</Label>
              <p className="font-medium">{formatDate(claim.tgl_pulang)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">LOS</Label>
              <p className="font-medium">{claim.los || 0} hari</p>
            </div>
          </div>
          
          <Separator className="mb-6" />
          
          {/* Tariff Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
              <Label className="text-xs text-muted-foreground">iDRG Code</Label>
              <p className="font-mono font-bold text-lg">{claim.idrg_code || '-'}</p>
              <p className="text-sm text-orange-600">{formatCurrency(claim.idrg_tarif)}</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Label className="text-xs text-muted-foreground">INA-CBG Code</Label>
              <p className="font-mono font-bold text-lg">{claim.inacbg_code || '-'}</p>
              <p className="text-sm text-blue-600">{formatCurrency(claim.inacbg_tarif)}</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <Label className="text-xs text-muted-foreground">Tarif Verifikasi</Label>
              <p className="font-mono font-bold text-lg">{formatCurrency(claim.tarif_verifikasi)}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
              <Label className="text-xs text-muted-foreground">Total Tarif RS</Label>
              <p className="font-mono font-bold text-lg">{formatCurrency(claim.total_tarif_rs)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="diagnoses" variant="inline">
        <TabsList>
          <TabsTrigger value="diagnoses" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Diagnoses ({diagnoses.length})
          </TabsTrigger>
          <TabsTrigger value="procedures" className="gap-2">
            <Clipboard className="h-4 w-4" />
            Procedures ({procedures.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        {/* Diagnoses Tab */}
        <TabsContent value="diagnoses">
          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Diagnoses (ICD-10)</h3>
                  <p className="text-sm text-muted-foreground">
                    25 Kriteria: Diagnosis Utama (1) + Diagnosis Sekunder per klaim
                  </p>
                </div>
                {canEdit && (
                  <Popover open={icd10SearchOpen} onOpenChange={setIcd10SearchOpen}>
                    <PopoverTrigger asChild>
                      <Button size="sm" disabled={saving}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Diagnosis
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Cari kode atau nama ICD-10..."
                          value={icd10SearchValue}
                          onValueChange={setIcd10SearchValue}
                        />
                        <CommandList>
                          {icd10Loading ? (
                            <div className="py-6 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          ) : icd10SearchValue.length < 2 ? (
                            <CommandEmpty>Ketik minimal 2 karakter...</CommandEmpty>
                          ) : icd10Results.length === 0 ? (
                            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              <ScrollArea className="h-[300px]">
                                {icd10Results.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    onSelect={() => handleAddDiagnosis(item.code, item.display)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {item.code}
                                        </Badge>
                                        {item.valid_code && (
                                          <Badge variant="secondary" className="text-xs">Valid</Badge>
                                        )}
                                      </div>
                                      <span className="text-sm mt-1">{item.display}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            <div className="px-6 pb-6">
              {diagnoses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada diagnosis.</p>
                  {canEdit && <p className="text-sm">Klik "Tambah Diagnosis" untuk menambahkan.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnoses.map((diagnosis) => (
                    <div
                      key={diagnosis.id}
                      className={`p-4 rounded-lg border ${
                        diagnosis.is_primary ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={diagnosis.is_primary ? 'default' : 'outline'}
                              className="font-mono text-xs"
                            >
                              {diagnosis.code}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {diagnosis.is_primary ? 'Utama' : 'Sekunder'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {diagnosis.source.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">#{diagnosis.sequence}</span>
                          </div>
                          <p className="text-sm">{diagnosis.name}</p>
                          {diagnosis.has_warning && (
                            <p className="text-xs text-yellow-600 mt-1">
                              ⚠️ {diagnosis.warning_message}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDiagnosis(diagnosis.id)}
                            disabled={saving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Procedures Tab */}
        <TabsContent value="procedures">
          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Procedures (ICD-9-CM)</h3>
                  <p className="text-sm text-muted-foreground">
                    25 Kriteria: Setting (OR/Non-OR/ICU) + Multiplicity
                  </p>
                </div>
                {canEdit && (
                  <Popover open={icd9SearchOpen} onOpenChange={setIcd9SearchOpen}>
                    <PopoverTrigger asChild>
                      <Button size="sm" disabled={saving}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Prosedur
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Cari kode atau nama ICD-9-CM..."
                          value={icd9SearchValue}
                          onValueChange={setIcd9SearchValue}
                        />
                        <CommandList>
                          {icd9Loading ? (
                            <div className="py-6 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          ) : icd9SearchValue.length < 2 ? (
                            <CommandEmpty>Ketik minimal 2 karakter...</CommandEmpty>
                          ) : icd9Results.length === 0 ? (
                            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              <ScrollArea className="h-[300px]">
                                {icd9Results.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    onSelect={() => handleAddProcedure(item.code, item.display)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {item.code}
                                        </Badge>
                                        {item.valid_code && (
                                          <Badge variant="secondary" className="text-xs">Valid</Badge>
                                        )}
                                      </div>
                                      <span className="text-sm mt-1">{item.display}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            <div className="px-6 pb-6">
              {procedures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clipboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada prosedur.</p>
                  {canEdit && <p className="text-sm">Klik "Tambah Prosedur" untuk menambahkan.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {procedures.map((procedure) => (
                    <div key={procedure.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {procedure.code}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {procedure.source.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">#{procedure.sequence}</span>
                          </div>
                          <p className="text-sm mb-3">{procedure.name}</p>
                          
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              {procedureSettingLabels[procedure.setting] || procedure.setting}
                            </Badge>
                            <Badge variant="secondary">
                              x{procedure.multiplicity}
                            </Badge>
                          </div>
                          
                          {procedure.has_warning && (
                            <p className="text-xs text-yellow-600 mt-2">
                              ⚠️ {procedure.warning_message}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProcedure(procedure.id)}
                            disabled={saving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="rounded-lg border">
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium">Riwayat Perubahan</h3>
              <p className="text-sm text-muted-foreground">Log aktivitas dan perubahan status klaim</p>
            </div>
            <div className="px-6 pb-6">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada riwayat.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 p-3 rounded-lg border">
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          log.is_error ? 'bg-red-100 dark:bg-red-900' : 'bg-primary/10'
                        }`}>
                          <History className={`h-5 w-5 ${log.is_error ? 'text-red-600' : 'text-primary'}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{log.action}</span>
                          {log.from_state && log.to_state && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {eklaimStateLabels[log.from_state as EKlaimState] || log.from_state}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge className={`text-xs ${eklaimStateColors[log.to_state as EKlaimState] || ''}`}>
                                {eklaimStateLabels[log.to_state as EKlaimState] || log.to_state}
                              </Badge>
                            </>
                          )}
                        </div>
                        {log.description && <p className="text-sm text-muted-foreground">{log.description}</p>}
                        {log.error_message && (
                          <p className="text-sm text-red-600 mt-1">Error: {log.error_message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(log.created_at)} • {log.user?.name || 'System'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
