import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Pill,
  Link2,
  Plus,
  Trash2,
  Check,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Search,
  Send,
} from "lucide-react";
import {
  kfaMappingApi,
  kfaStatsApi,
  kfaLookupApi,
  type MedicineKFAMapping,
  type KFAMappingStats,
  type UnmappedMedicine,
  type KFALookupResult,
} from "@/lib/api/kfa";
import type { ColumnDef } from "@tanstack/react-table";

export function KfaMappingTab() {
  const { toast } = useToast();

  // States
  const [kfaMappings, setKfaMappings] = useState<MedicineKFAMapping[]>([]);
  const [kfaStats, setKfaStats] = useState<KFAMappingStats | null>(null);
  const [unmappedMedicines, setUnmappedMedicines] = useState<UnmappedMedicine[]>([]);
  const [kfaSearchQuery, setKfaSearchQuery] = useState("");
  const [kfaSearchResults, setKfaSearchResults] = useState<KFALookupResult[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<UnmappedMedicine | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    kfa_code: "",
    kfa_name: "",
    kfa_display_name: "",
    kfa_form: "",
    kfa_strength: "",
    kfa_manufacturer: "",
    kfa_farmalkes: "",
    notes: "",
  });
  const [savingMapping, setSavingMapping] = useState(false);
  const [lookingUpKFA, setLookingUpKFA] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKFAData();
  }, []);

  const loadKFAData = async () => {
    setLoading(true);
    try {
      const [statsRes, mappingsRes, unmappedRes] = await Promise.all([
        kfaStatsApi.getStats(),
        kfaMappingApi.getAll({ limit: 100 }),
        kfaStatsApi.getUnmapped({ limit: 100 }),
      ]);
      setKfaStats(statsRes.data);
      setKfaMappings(mappingsRes.data.data || []);
      setUnmappedMedicines(unmappedRes.data.data || []);
    } catch (error) {
      console.error("Failed to load KFA data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKFA = async (query: string) => {
    setKfaSearchQuery(query);
    if (query.length < 2) {
      setKfaSearchResults([]);
      return;
    }
    try {
      const res = await kfaLookupApi.search(query);
      setKfaSearchResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search KFA:", error);
      setKfaSearchResults([]);
    }
  };

  const handleSelectKFA = (kfa: KFALookupResult) => {
    setNewMapping({
      kfa_code: kfa.kfa_code,
      kfa_name: kfa.name,
      kfa_display_name: kfa.display_name || kfa.name,
      kfa_form: kfa.dosage_form || "",
      kfa_strength: "",
      kfa_manufacturer: kfa.manufacturer || "",
      kfa_farmalkes: kfa.farmalkes || "",
      notes: "",
    });
    setKfaSearchQuery(kfa.name);
    setKfaSearchResults([]);
  };

  const handleLookupKFAByCode = async (code: string) => {
    if (!code || code.length < 5) return;

    setLookingUpKFA(true);
    try {
      const res = await kfaLookupApi.lookupByCode(code);
      if (res.data.found && res.data.data) {
        const kfa = res.data.data;
        setNewMapping({
          ...newMapping,
          kfa_code: kfa.kfa_code,
          kfa_name: kfa.name,
          kfa_display_name: kfa.display_name || kfa.name,
          kfa_form: kfa.dosage_form || "",
          kfa_manufacturer: kfa.manufacturer || "",
          kfa_farmalkes: kfa.farmalkes || "",
        });
        toast({
          variant: "success",
          title: "KFA Ditemukan",
          description: `${kfa.name} - ${kfa.manufacturer || 'N/A'}`,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 404) {
        toast({
          variant: "destructive",
          title: "Tidak Ditemukan",
          description: "Kode KFA tidak ditemukan di SatuSehat",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Lookup",
          description: err.response?.data?.error || "Gagal mencari kode KFA",
        });
      }
    } finally {
      setLookingUpKFA(false);
    }
  };

  const handleCreateMapping = async () => {
    if (!selectedMedicine || !newMapping.kfa_code) return;

    setSavingMapping(true);
    try {
      await kfaMappingApi.create({
        medicine_id: selectedMedicine.id,
        kfa_code: newMapping.kfa_code,
        kfa_name: newMapping.kfa_name,
        kfa_display_name: newMapping.kfa_display_name,
        kfa_form: newMapping.kfa_form,
        kfa_strength: newMapping.kfa_strength,
        kfa_manufacturer: newMapping.kfa_manufacturer,
        kfa_farmalkes: newMapping.kfa_farmalkes,
        notes: newMapping.notes,
      });
      toast({
        variant: "success",
        title: "Berhasil",
        description: `Mapping KFA untuk ${selectedMedicine.name} berhasil dibuat`,
      });
      setMappingDialogOpen(false);
      setSelectedMedicine(null);
      setNewMapping({
        kfa_code: "",
        kfa_name: "",
        kfa_display_name: "",
        kfa_form: "",
        kfa_strength: "",
        kfa_manufacturer: "",
        kfa_farmalkes: "",
        notes: "",
      });
      setKfaSearchQuery("");
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal membuat mapping KFA",
      });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: number) => {
    try {
      await kfaMappingApi.delete(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping KFA berhasil dihapus",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal menghapus mapping",
      });
    }
  };

  const handleVerifyMapping = async (mappingId: number) => {
    try {
      await kfaMappingApi.verify(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping KFA berhasil diverifikasi",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal memverifikasi mapping",
      });
    }
  };

  const handleSendMedication = async (mappingId: number) => {
    setSending(`medication-standalone-${mappingId}`);
    try {
      const res = await kfaMappingApi.sendToSatuSehat(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: res.data.message || "Medication berhasil dikirim ke SatuSehat",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim Medication ke SatuSehat",
      });
    } finally {
      setSending(null);
    }
  };

  // Column definitions for KFA Mapping DataTable
  const kfaMappingColumns: ColumnDef<MedicineKFAMapping>[] = [
    {
      accessorKey: "medicine.code",
      header: "Kode Obat",
      cell: ({ row }) => <span className="font-mono">{row.original.medicine?.code || '-'}</span>,
    },
    {
      accessorKey: "medicine.name",
      header: "Nama Obat Lokal",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.medicine?.name || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.original.medicine?.generic_name}</p>
        </div>
      ),
    },
    {
      accessorKey: "kfa_code",
      header: "Kode KFA",
      cell: ({ row }) => <span className="font-mono text-primary">{row.original.kfa_code}</span>,
    },
    {
      accessorKey: "kfa_name",
      header: "Nama KFA",
      cell: ({ row }) => (
        <div>
          <p>{row.original.kfa_name}</p>
          {row.original.kfa_display_name && row.original.kfa_display_name !== row.original.kfa_name && (
            <p className="text-xs text-muted-foreground">{row.original.kfa_display_name}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "is_verified",
      header: "Verifikasi",
      cell: ({ row }) => {
        const mapping = row.original;
        if (mapping.is_verified) {
          return (
            <Badge className="bg-green-100 text-green-800 gap-1">
              <CheckCircle className="h-3 w-3" />
              Terverifikasi
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Verifikasi
          </Badge>
        );
      },
    },
    {
      accessorKey: "satusehat_medication_id",
      header: "Medication",
      cell: ({ row }) => {
        const mapping = row.original;
        if (mapping.satusehat_medication_id) {
          return (
            <div>
              <Badge className="bg-green-100 text-green-800 gap-1">
                <CheckCircle className="h-3 w-3" />
                Terkirim
              </Badge>
              <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[120px]" title={mapping.satusehat_medication_id}>
                {mapping.satusehat_medication_id}
              </p>
            </div>
          );
        }
        return (
          <Badge variant="outline" className="text-orange-600 gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Dikirim
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const mapping = row.original;
        return (
          <div className="text-right flex gap-2 justify-end">
            {!mapping.satusehat_medication_id && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleSendMedication(mapping.id)}
                disabled={sending === `medication-standalone-${mapping.id}`}
                title="Kirim Medication ke SatuSehat"
              >
                {sending === `medication-standalone-${mapping.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Kirim
              </Button>
            )}
            {!mapping.is_verified && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVerifyMapping(mapping.id)}
                title="Verifikasi mapping"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteMapping(mapping.id)}
              className="text-red-600 hover:text-red-700"
              title="Hapus mapping"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // Column definitions for Unmapped Medicines DataTable
  const unmappedMedicineColumns: ColumnDef<UnmappedMedicine>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Nama Obat",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.generic_name}</p>
        </div>
      ),
    },
    {
      accessorKey: "form",
      header: "Bentuk",
      cell: ({ row }) => <Badge variant="outline">{row.original.form}</Badge>,
    },
    {
      accessorKey: "strength",
      header: "Kekuatan",
      cell: ({ row }) => row.original.strength || '-',
    },
    {
      accessorKey: "manufacturer",
      header: "Produsen",
      cell: ({ row }) => row.original.manufacturer || '-',
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const medicine = row.original;
        return (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedMedicine(medicine);
                setMappingDialogOpen(true);
              }}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Map KFA
            </Button>
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KFA Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Pill className="h-4 w-4 text-blue-500" />
              Total Obat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kfaStats?.total_medicines || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Obat aktif di sistem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-green-500" />
              Sudah Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kfaStats?.total_mapped || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({kfaStats?.mapped_percentage?.toFixed(1) || 0}%)
              </span>
            </div>
            <Progress
              value={kfaStats?.mapped_percentage || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Terverifikasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kfaStats?.total_verified || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({kfaStats?.verified_percentage?.toFixed(1) || 0}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Siap untuk SatuSehat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Belum Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{kfaStats?.total_unmapped || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Perlu dipetakan ke KFA</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mapped Medicines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Mapping KFA ({kfaMappings.length})
              </span>
              <Button variant="outline" size="sm" onClick={loadKFAData}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>Obat yang sudah dipetakan ke kode KFA</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={kfaMappingColumns}
              data={kfaMappings}
              searchPlaceholder="Cari nama obat atau kode KFA..."
              pageSize={5}
              tableId="kfa-mappings"
            />
          </CardContent>
        </Card>

        {/* Unmapped Medicines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Obat Belum Mapping ({unmappedMedicines.length})
            </CardTitle>
            <CardDescription>Obat yang perlu dipetakan ke kode KFA untuk MedicationRequest</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={unmappedMedicineColumns}
              data={unmappedMedicines}
              searchPlaceholder="Cari nama obat..."
              pageSize={5}
              tableId="unmapped-medicines"
            />
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Tentang Kode KFA (Kode Farmasi Indonesia)
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                KFA adalah standar kode obat nasional dari Kemenkes RI yang digunakan untuk MedicationRequest di SatuSehat.
                Setiap obat lokal perlu dipetakan ke kode KFA yang sesuai agar dapat dikirim ke SatuSehat.
                Anda dapat mencari kode KFA di{" "}
                <a
                  href="https://dto.kemkes.go.id/kfa-browser"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium hover:text-blue-800 dark:hover:text-blue-200"
                >
                  KFA Browser Kemenkes
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KFA Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Mapping Kode KFA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Medicine Info */}
            {selectedMedicine && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1">
                <p className="text-sm font-medium">{selectedMedicine.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedMedicine.generic_name} | {selectedMedicine.form} | {selectedMedicine.strength}
                </p>
                <p className="text-xs text-muted-foreground">Kode: {selectedMedicine.code}</p>
              </div>
            )}

            {/* Input Kode KFA with Auto-lookup */}
            <div className="space-y-2">
              <Label htmlFor="kfa-code">Kode KFA</Label>
              <div className="flex gap-2">
                <Input
                  id="kfa-code"
                  placeholder="Contoh: 93001295"
                  value={newMapping.kfa_code}
                  onChange={(e) => setNewMapping({ ...newMapping, kfa_code: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleLookupKFAByCode(newMapping.kfa_code)}
                  disabled={!newMapping.kfa_code || newMapping.kfa_code.length < 5 || lookingUpKFA}
                >
                  {lookingUpKFA ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Masukkan kode KFA lalu klik tombol cari untuk auto-fill nama obat dari SatuSehat
              </p>
            </div>

            {/* Nama KFA (auto-filled or manual) */}
            <div className="space-y-2">
              <Label htmlFor="kfa-name">Nama KFA *</Label>
              <Input
                id="kfa-name"
                placeholder="Nama obat di KFA (akan terisi otomatis)"
                value={newMapping.kfa_name}
                onChange={(e) => setNewMapping({ ...newMapping, kfa_name: e.target.value })}
                className={newMapping.kfa_name ? "border-green-500" : ""}
              />
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="kfa-display-name">Display Name *</Label>
              <Input
                id="kfa-display-name"
                placeholder="Nama tampilan untuk FHIR (auto-filled)"
                value={newMapping.kfa_display_name}
                onChange={(e) => setNewMapping({ ...newMapping, kfa_display_name: e.target.value })}
                className={newMapping.kfa_display_name ? "border-green-500" : ""}
              />
              <p className="text-xs text-muted-foreground">Digunakan untuk tampilan di FHIR MedicationRequest</p>
            </div>

            {/* Grid 2 columns untuk form & manufacturer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kfa-form">Bentuk Sediaan</Label>
                <Input
                  id="kfa-form"
                  placeholder="Tablet, Kapsul, dll (auto-filled)"
                  value={newMapping.kfa_form}
                  onChange={(e) => setNewMapping({ ...newMapping, kfa_form: e.target.value })}
                  className={newMapping.kfa_form ? "border-green-500" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kfa-strength">Kekuatan/Dosis</Label>
                <Input
                  id="kfa-strength"
                  placeholder="Contoh: 500 mg"
                  value={newMapping.kfa_strength}
                  onChange={(e) => setNewMapping({ ...newMapping, kfa_strength: e.target.value })}
                />
              </div>
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <Label htmlFor="kfa-manufacturer">Produsen</Label>
              <Input
                id="kfa-manufacturer"
                placeholder="Nama produsen (auto-filled)"
                value={newMapping.kfa_manufacturer}
                onChange={(e) => setNewMapping({ ...newMapping, kfa_manufacturer: e.target.value })}
                className={newMapping.kfa_manufacturer ? "border-green-500" : ""}
              />
            </div>

            {/* Farmalkes */}
            <div className="space-y-2">
              <Label htmlFor="kfa-farmalkes">Kode Farmalkes (opsional)</Label>
              <Input
                id="kfa-farmalkes"
                placeholder="Kode Farmalkes (auto-filled)"
                value={newMapping.kfa_farmalkes}
                onChange={(e) => setNewMapping({ ...newMapping, kfa_farmalkes: e.target.value })}
                className={newMapping.kfa_farmalkes ? "border-green-500" : ""}
              />
            </div>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">atau cari berdasarkan nama</span>
              </div>
            </div>

            {/* KFA Search by Name */}
            <div className="space-y-2">
              <Label htmlFor="kfa-search">Cari di SatuSehat</Label>
              <div className="relative">
                <Input
                  id="kfa-search"
                  placeholder="Ketik nama obat untuk mencari..."
                  value={kfaSearchQuery}
                  onChange={(e) => handleSearchKFA(e.target.value)}
                />
                {kfaSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {kfaSearchResults.map((kfa, idx) => (
                      <button
                        key={`${kfa.kfa_code}-${idx}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                        onClick={() => handleSelectKFA(kfa)}
                      >
                        <p className="font-medium">{kfa.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Kode: {kfa.kfa_code} {kfa.manufacturer && `| ${kfa.manufacturer}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Minimal 2 karakter untuk mencari nama obat di database SatuSehat
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="kfa-notes">Catatan (opsional)</Label>
              <Input
                id="kfa-notes"
                placeholder="Catatan tambahan..."
                value={newMapping.notes}
                onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleCreateMapping}
              disabled={!newMapping.kfa_code || !newMapping.kfa_name || savingMapping}
            >
              {savingMapping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Simpan Mapping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
