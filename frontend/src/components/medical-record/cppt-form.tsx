import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Calendar,
  Clock,
  Heart,
  Thermometer,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CPPTFormProps {
  visitId: number;
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

export function CPPTForm({ visitId }: CPPTFormProps) {
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
  const canCreate = hasPermission("medical_records.cppt");
  const canEdit = hasPermission("medical_records.cppt");
  const canDelete = hasPermission("medical_records.cppt");
  const canVerify = hasPermission("medical_records.cppt");

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
    const colors: Record<string, string> = {
      dokter: "bg-blue-100 text-blue-800",
      perawat: "bg-green-100 text-green-800",
      bidan: "bg-pink-100 text-pink-800",
      gizi: "bg-orange-100 text-orange-800",
      farmasi: "bg-purple-100 text-purple-800",
      fisioterapi: "bg-cyan-100 text-cyan-800",
      lainnya: "bg-gray-100 text-gray-800",
    };
    return colors[profession] || colors.lainnya;
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            CPPT - Catatan Perkembangan Pasien Terintegrasi
          </CardTitle>
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
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              CPPT - Catatan Perkembangan Pasien Terintegrasi
              <Badge variant="secondary" className="ml-2">{cppts.length} Catatan</Badge>
            </CardTitle>
            {canCreate && (
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah CPPT
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cppts.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
              <div className="divide-y">
                {cppts.map((cppt) => (
                  <div key={cppt.id} className="p-4 hover:bg-muted/30">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={getProfessionColor(cppt.profession)}>
                          {getCPPTProfessionLabel(cppt.profession)}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(cppt.record_date), "dd MMM yyyy", { locale: idLocale })}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(cppt.record_date), "HH:mm")}
                        </div>
                        {cppt.is_verified && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {canVerify && !cppt.is_verified && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            title="Verifikasi"
                            onClick={() => handleVerify(cppt.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && !cppt.is_verified && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={() => handleOpenEdit(cppt)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && !cppt.is_verified && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Hapus"
                            onClick={() => {
                              setCpptToDelete(cppt.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* SOAP Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {cppt.subjective && (
                        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
                          <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">S - Subjektif</p>
                          <p className="text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{cppt.subjective}</p>
                        </div>
                      )}
                      {cppt.objective && (
                        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                          <p className="font-medium text-green-700 dark:text-green-300 mb-1">O - Objektif</p>
                          <p className="text-green-900 dark:text-green-100 whitespace-pre-wrap">{cppt.objective}</p>
                        </div>
                      )}
                      {cppt.assessment && (
                        <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3">
                          <p className="font-medium text-orange-700 dark:text-orange-300 mb-1">A - Asesmen</p>
                          <p className="text-orange-900 dark:text-orange-100 whitespace-pre-wrap">{cppt.assessment}</p>
                        </div>
                      )}
                      {cppt.plan && (
                        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3">
                          <p className="font-medium text-purple-700 dark:text-purple-300 mb-1">P - Plan</p>
                          <p className="text-purple-900 dark:text-purple-100 whitespace-pre-wrap">{cppt.plan}</p>
                        </div>
                      )}
                    </div>

                    {/* Vital Signs (if any) */}
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
                      <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200">
                        <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Instruksi:</p>
                        <p className="text-sm text-yellow-900 dark:text-yellow-100">{cppt.instruction}</p>
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
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Belum ada catatan CPPT</p>
              <p className="text-sm mt-1">Klik "Tambah CPPT" untuk menambahkan catatan perkembangan.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {editingId ? "Edit CPPT" : "Tambah CPPT Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
                <Label className="text-blue-600">S - Subjektif (Keluhan)</Label>
                <Textarea
                  value={formData.subjective}
                  onChange={(e) => handleChange("subjective", e.target.value)}
                  placeholder="Keluhan yang dirasakan pasien..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-green-600">O - Objektif (Pemeriksaan)</Label>
                <Textarea
                  value={formData.objective}
                  onChange={(e) => handleChange("objective", e.target.value)}
                  placeholder="Hasil pemeriksaan fisik, vital sign, lab..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-orange-600">A - Asesmen (Diagnosis)</Label>
                <Textarea
                  value={formData.assessment}
                  onChange={(e) => handleChange("assessment", e.target.value)}
                  placeholder="Diagnosis atau masalah keperawatan..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-purple-600">P - Plan (Rencana)</Label>
                <Textarea
                  value={formData.plan}
                  onChange={(e) => handleChange("plan", e.target.value)}
                  placeholder="Rencana tindakan atau terapi..."
                  rows={4}
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

          <DialogFooter>
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
