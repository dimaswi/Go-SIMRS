import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  cpptApi,
  CPPT_PROFESSIONS,
  getCPPTProfessionLabel,
} from "@/lib/api";
import type { CPPT, CreateCPPTInput } from "@/lib/api";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  ClipboardCheck,
  User,
  Heart,
  Thermometer,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CPPTFormProps {
  visitId: number;
  readOnly?: boolean;
}

// Collapsible Row Component for CPPT
function CPPTCollapsibleRow({
  cppt,
  canVerify,
  canEdit,
  canDelete,
  onVerify,
  onEdit,
  onDelete,
  getProfessionColor,
}: {
  cppt: CPPT;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onVerify: (id: number) => void;
  onEdit: (cppt: CPPT) => void;
  onDelete: (id: number) => void;
  getProfessionColor: (profession: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Get summary of SOAP
  const getSoapSummary = () => {
    const parts = [];
    if (cppt.subjective) parts.push(`S: ${cppt.subjective.substring(0, 30)}${cppt.subjective.length > 30 ? '...' : ''}`);
    if (cppt.objective) parts.push(`O: ${cppt.objective.substring(0, 30)}${cppt.objective.length > 30 ? '...' : ''}`);
    if (cppt.assessment) parts.push(`A: ${cppt.assessment.substring(0, 30)}${cppt.assessment.length > 30 ? '...' : ''}`);
    return parts.join(' | ') || '-';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="hover:bg-muted/30">
        {/* Table Row */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
          <div className="col-span-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col">
              <span className="font-medium">{format(new Date(cppt.record_date), "dd MMM yyyy", { locale: idLocale })}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(cppt.record_date), "HH:mm")}</span>
            </div>
          </div>
          <div className="col-span-2">
            <Badge className={getProfessionColor(cppt.profession)}>
              {getCPPTProfessionLabel(cppt.profession)}
            </Badge>
          </div>
          <div className="col-span-4">
            <p className="text-xs text-muted-foreground truncate">{getSoapSummary()}</p>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col gap-0.5">
              {cppt.is_verified ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground w-fit">Pending</Badge>
              )}
              <div className="text-[10px] text-muted-foreground truncate">
                {cppt.created_by && <span>{cppt.created_by.full_name}</span>}
                {cppt.is_verified && cppt.verified_by && <span className="ml-1">• {cppt.verified_by.full_name}</span>}
              </div>
            </div>
          </div>
          <div className="col-span-1 flex items-center gap-1">
            {canVerify && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => onVerify(cppt.id)}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canEdit && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cppt)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(cppt.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 ml-8 mr-4">
            {/* SOAP Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {cppt.subjective && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">S - Subjektif</p>
                  <p className="whitespace-pre-wrap">{cppt.subjective}</p>
                </div>
              )}
              {cppt.objective && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">O - Objektif</p>
                  <p className="whitespace-pre-wrap">{cppt.objective}</p>
                </div>
              )}
              {cppt.assessment && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">A - Asesmen</p>
                  <p className="whitespace-pre-wrap">{cppt.assessment}</p>
                </div>
              )}
              {cppt.plan && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">P - Plan</p>
                  <p className="whitespace-pre-wrap">{cppt.plan}</p>
                </div>
              )}
            </div>

            {/* Vital Signs */}
            {(cppt.blood_pressure || cppt.heart_rate || cppt.temperature || cppt.oxygen_saturation) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {cppt.blood_pressure && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Activity className="h-3 w-3" /> TD: {cppt.blood_pressure} mmHg
                  </span>
                )}
                {cppt.heart_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Heart className="h-3 w-3" /> HR: {cppt.heart_rate} x/mnt
                  </span>
                ) : null}
                {cppt.respiratory_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    RR: {cppt.respiratory_rate} x/mnt
                  </span>
                ) : null}
                {cppt.temperature && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Thermometer className="h-3 w-3" /> T: {cppt.temperature}°C
                  </span>
                )}
                {cppt.oxygen_saturation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    SpO2: {cppt.oxygen_saturation}%
                  </span>
                ) : null}
                {cppt.pain_scale ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    Nyeri: {cppt.pain_scale}/10
                  </span>
                ) : null}
              </div>
            )}

            {/* Instruction */}
            {cppt.instruction && (
              <div className="mt-3 p-2 bg-muted/50 rounded border">
                <p className="text-xs font-medium text-muted-foreground">Instruksi:</p>
                <p className="text-sm">{cppt.instruction}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {cppt.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Dicatat: {cppt.created_by.full_name}
                </span>
              )}
              {cppt.is_verified && cppt.verified_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Diverifikasi: {cppt.verified_by.full_name}
                </span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const defaultFormData: CreateCPPTInput = {
  record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  profession: "dokter",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  instruction: "",
  blood_pressure: "",
  heart_rate: 0,
  respiratory_rate: 0,
  temperature: "",
  oxygen_saturation: 0,
  pain_scale: 0,
};

export function CPPTForm({ visitId, readOnly = false }: CPPTFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cppts, setCppts] = useState<CPPT[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateCPPTInput>(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cpptToDelete, setCpptToDelete] = useState<number | null>(null);

  // Permissions
  const canCreate = hasPermission("medical_records.cppt") && !readOnly;
  const canEdit = hasPermission("medical_records.cppt") && !readOnly;
  const canDelete = hasPermission("medical_records.cppt") && !readOnly;
  const canVerify = hasPermission("medical_records.cppt") && !readOnly;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cpptApi.getAll(visitId);
      setCppts(res.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data CPPT",
      });
    } finally {
      setLoading(false);
    }
  }, [visitId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (cppt: CPPT) => {
    if (cppt.is_verified) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "CPPT yang sudah diverifikasi tidak dapat diubah",
      });
      return;
    }
    setEditingId(cppt.id);
    setFormData({
      record_date: format(new Date(cppt.record_date), "yyyy-MM-dd'T'HH:mm"),
      profession: cppt.profession,
      subjective: cppt.subjective || "",
      objective: cppt.objective || "",
      assessment: cppt.assessment || "",
      plan: cppt.plan || "",
      instruction: cppt.instruction || "",
      blood_pressure: cppt.blood_pressure || "",
      heart_rate: cppt.heart_rate || 0,
      respiratory_rate: cppt.respiratory_rate || 0,
      temperature: cppt.temperature || "",
      oxygen_saturation: cppt.oxygen_saturation || 0,
      pain_scale: cppt.pain_scale || 0,
    });
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateCPPTInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save
  const handleSave = async () => {
    if (!formData.profession) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Profesi harus dipilih",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await cpptApi.update(visitId, editingId, formData);
        toast({
          title: "Berhasil",
          description: "CPPT berhasil diperbarui",
        });
      } else {
        await cpptApi.create(visitId, formData);
        toast({
          title: "Berhasil",
          description: "CPPT berhasil ditambahkan",
        });
      }
      setIsModalOpen(false);
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan CPPT",
      });
    } finally {
      setSaving(false);
    }
  };

  // Verify
  const handleVerify = async (cpptId: number) => {
    try {
      await cpptApi.verify(visitId, cpptId);
      toast({
        title: "Berhasil",
        description: "CPPT berhasil diverifikasi",
      });
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memverifikasi CPPT",
      });
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!cpptToDelete) return;

    try {
      await cpptApi.delete(visitId, cpptToDelete);
      toast({
        title: "Berhasil",
        description: "CPPT berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      setCpptToDelete(null);
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus CPPT",
      });
    }
  };

  // Get profession badge color
  const getProfessionColor = (profession: string) => {
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            CPPT - Catatan Perkembangan Pasien Terintegrasi
          </CardTitle>
          <CardDescription>
            Catatan perkembangan harian pasien oleh berbagai profesi medis
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                CPPT - Catatan Perkembangan Pasien Terintegrasi
                <Badge variant="secondary" className="ml-2">{cppts.length} Catatan</Badge>
              </CardTitle>
              <CardDescription>
                Catatan perkembangan harian pasien oleh berbagai profesi medis
              </CardDescription>
            </div>
            {canCreate && !readOnly && (
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah CPPT
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cppts.length > 0 ? (
            <div>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                <div className="col-span-1"></div>
                <div className="col-span-2">Tanggal/Waktu</div>
                <div className="col-span-2">Profesi</div>
                <div className="col-span-4">Ringkasan SOAP</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Aksi</div>
              </div>
              <div className="divide-y">
                {cppts.map((cppt) => (
                  <CPPTCollapsibleRow
                    key={cppt.id}
                    cppt={cppt}
                    canVerify={canVerify}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onVerify={handleVerify}
                    onEdit={handleOpenEdit}
                    onDelete={(id) => {
                      setCpptToDelete(id);
                      setDeleteDialogOpen(true);
                    }}
                    getProfessionColor={getProfessionColor}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Belum ada catatan CPPT</p>
              <p className="text-sm mt-1">Klik "Tambah CPPT" untuk menambahkan catatan perkembangan.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal - Fullscreen */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-full w-full h-screen max-h-screen flex flex-col p-0 gap-0 rounded-none">
          <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {editingId ? "Edit CPPT" : "Tambah CPPT Baru"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="grid gap-4 pb-4">
              {/* Row 1 - Date, Profession */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal & Waktu</Label>
                  <Input
                    type="datetime-local"
                    value={formData.record_date}
                    onChange={(e) => handleChange("record_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profesi</Label>
                  <Select
                    value={formData.profession}
                    onValueChange={(v) => handleChange("profession", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih profesi" />
                    </SelectTrigger>
                    <SelectContent>
                      {CPPT_PROFESSIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SOAP */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>S - Subjektif (Keluhan)</Label>
                  <Textarea
                    value={formData.subjective}
                    onChange={(e) => handleChange("subjective", e.target.value)}
                    placeholder="Keluhan yang dirasakan pasien..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>O - Objektif (Pemeriksaan)</Label>
                  <Textarea
                    value={formData.objective}
                    onChange={(e) => handleChange("objective", e.target.value)}
                    placeholder="Hasil pemeriksaan fisik, vital sign, lab..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>A - Asesmen (Diagnosis)</Label>
                  <Textarea
                    value={formData.assessment}
                    onChange={(e) => handleChange("assessment", e.target.value)}
                    placeholder="Diagnosis atau masalah keperawatan..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>P - Plan (Rencana)</Label>
                  <Textarea
                    value={formData.plan}
                    onChange={(e) => handleChange("plan", e.target.value)}
                    placeholder="Rencana tindakan atau terapi..."
                    rows={6}
                  />
                </div>
              </div>

            {/* Vital Signs */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium mb-3 block">Tanda Vital (Opsional)</Label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">TD (mmHg)</Label>
                  <Input
                    value={formData.blood_pressure}
                    onChange={(e) => handleChange("blood_pressure", e.target.value)}
                    placeholder="120/80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HR (x/mnt)</Label>
                  <Input
                    type="number"
                    value={formData.heart_rate || ""}
                    onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">RR (x/mnt)</Label>
                  <Input
                    type="number"
                    value={formData.respiratory_rate || ""}
                    onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                    placeholder="18"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Suhu (°C)</Label>
                  <Input
                    value={formData.temperature}
                    onChange={(e) => handleChange("temperature", e.target.value)}
                    placeholder="36.5"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SpO2 (%)</Label>
                  <Input
                    type="number"
                    value={formData.oxygen_saturation || ""}
                    onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                    placeholder="98"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nyeri (0-10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.pain_scale || ""}
                    onChange={(e) => handleChange("pain_scale", parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Instruction */}
            <div className="space-y-2">
              <Label>Instruksi Khusus</Label>
              <Textarea
                value={formData.instruction}
                onChange={(e) => handleChange("instruction", e.target.value)}
                placeholder="Instruksi khusus untuk perawatan pasien..."
                rows={2}
              />
            </div>
          </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-muted/50 shrink-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus CPPT?</AlertDialogTitle>
            <AlertDialogDescription>
              Data CPPT ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
