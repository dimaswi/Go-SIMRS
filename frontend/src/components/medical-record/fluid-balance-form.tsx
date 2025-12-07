import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  fluidBalanceApi,
  SHIFT_TYPES,
  getShiftTypeLabel,
} from "@/lib/api";
import type { FluidBalance, CreateFluidBalanceInput, FluidBalanceSummary } from "@/lib/api";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface FluidBalanceFormProps {
  visitId: number;
}

const defaultFormData: CreateFluidBalanceInput = {
  record_date: format(new Date(), "yyyy-MM-dd"),
  shift_type: "pagi",
  oral_drink: 0,
  oral_food: 0,
  oral_medicine: 0,
  iv_fluid: 0,
  iv_medicine: 0,
  blood_product: 0,
  enteral_feed: 0,
  other_intake: 0,
  other_intake_note: "",
  urine_amount: 0,
  urine_color: "",
  urine_catheter: false,
  feces_amount: 0,
  feces_freq: 0,
  feces_type: "",
  vomit_amount: 0,
  vomit_freq: 0,
  drain_amount: 0,
  drain_type: "",
  drain_color: "",
  blood_loss: 0,
  blood_loss_note: "",
  iwl: 0,
  other_output: 0,
  other_output_note: "",
  notes: "",
};

export function FluidBalanceForm({ visitId }: FluidBalanceFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<FluidBalance[]>([]);
  const [summary, setSummary] = useState<FluidBalanceSummary[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateFluidBalanceInput>(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [balanceToDelete, setBalanceToDelete] = useState<number | null>(null);

  // Permissions
  const canCreate = hasPermission("medical_records.fluid_balance");
  const canEdit = hasPermission("medical_records.fluid_balance");
  const canDelete = hasPermission("medical_records.fluid_balance");

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balanceRes, summaryRes] = await Promise.all([
        fluidBalanceApi.getAll(visitId),
        fluidBalanceApi.getSummary(visitId),
      ]);
      setBalances(balanceRes.data.data || []);
      setSummary(summaryRes.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data balance cairan",
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
      record_date: format(new Date(), "yyyy-MM-dd"),
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (balance: FluidBalance) => {
    setEditingId(balance.id);
    setFormData({
      record_date: format(new Date(balance.record_date), "yyyy-MM-dd"),
      shift_type: balance.shift_type,
      oral_drink: balance.oral_drink,
      oral_food: balance.oral_food,
      oral_medicine: balance.oral_medicine,
      iv_fluid: balance.iv_fluid,
      iv_medicine: balance.iv_medicine,
      blood_product: balance.blood_product,
      enteral_feed: balance.enteral_feed,
      other_intake: balance.other_intake,
      other_intake_note: balance.other_intake_note || "",
      urine_amount: balance.urine_amount,
      urine_color: balance.urine_color || "",
      urine_catheter: balance.urine_catheter,
      feces_amount: balance.feces_amount,
      feces_freq: balance.feces_freq,
      feces_type: balance.feces_type || "",
      vomit_amount: balance.vomit_amount,
      vomit_freq: balance.vomit_freq,
      drain_amount: balance.drain_amount,
      drain_type: balance.drain_type || "",
      drain_color: balance.drain_color || "",
      blood_loss: balance.blood_loss,
      blood_loss_note: balance.blood_loss_note || "",
      iwl: balance.iwl,
      other_output: balance.other_output,
      other_output_note: balance.other_output_note || "",
      notes: balance.notes || "",
    });
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateFluidBalanceInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate totals for preview
  const calcIntake = () => {
    return (formData.oral_drink || 0) + (formData.oral_food || 0) + (formData.oral_medicine || 0) +
           (formData.iv_fluid || 0) + (formData.iv_medicine || 0) + (formData.blood_product || 0) +
           (formData.enteral_feed || 0) + (formData.other_intake || 0);
  };

  const calcOutput = () => {
    return (formData.urine_amount || 0) + (formData.feces_amount || 0) + (formData.vomit_amount || 0) +
           (formData.drain_amount || 0) + (formData.blood_loss || 0) + (formData.iwl || 0) +
           (formData.other_output || 0);
  };

  // Save
  const handleSave = async () => {
    if (!formData.shift_type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Shift harus dipilih",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await fluidBalanceApi.update(visitId, editingId, formData);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil diperbarui",
        });
      } else {
        await fluidBalanceApi.create(visitId, formData);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil ditambahkan",
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan balance cairan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!balanceToDelete) return;

    try {
      await fluidBalanceApi.delete(visitId, balanceToDelete);
      toast({
        title: "Berhasil",
        description: "Balance cairan berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      setBalanceToDelete(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus balance cairan",
      });
    }
  };

  // Get shift badge color
  const getShiftColor = (shift: string) => {
    const colors: Record<string, string> = {
      pagi: "bg-yellow-100 text-yellow-800",
      siang: "bg-orange-100 text-orange-800",
      malam: "bg-indigo-100 text-indigo-800",
    };
    return colors[shift] || "bg-gray-100 text-gray-800";
  };

  // Get balance status
  const getBalanceStatus = (balance: number) => {
    if (balance > 0) return { icon: TrendingUp, color: "text-green-600", label: "Positif" };
    if (balance < 0) return { icon: TrendingDown, color: "text-red-600", label: "Negatif" };
    return { icon: Minus, color: "text-gray-600", label: "Seimbang" };
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Balance Cairan
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
              <Droplets className="h-5 w-5" />
              Balance Cairan
              <Badge variant="secondary" className="ml-2">{balances.length} Catatan</Badge>
            </CardTitle>
            {canCreate && (
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah Balance
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Summary Cards */}
          {summary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {summary.slice(0, 3).map((s) => {
                const status = getBalanceStatus(s.balance);
                const StatusIcon = status.icon;
                return (
                  <div key={s.date} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.date), "dd MMM yyyy", { locale: idLocale })}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-green-600">
                            <ArrowDownToLine className="h-3 w-3 inline" /> {s.total_intake} ml
                          </span>
                          <span className="text-xs text-red-600">
                            <ArrowUpFromLine className="h-3 w-3 inline" /> {s.total_output} ml
                          </span>
                        </div>
                      </div>
                      <div className={`text-right ${status.color}`}>
                        <StatusIcon className="h-4 w-4 inline" />
                        <p className="text-lg font-bold">{s.balance > 0 ? "+" : ""}{s.balance}</p>
                        <p className="text-xs">ml</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Balance List */}
          {balances.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-500px)] min-h-[200px]">
              <div className="divide-y border rounded-lg">
                {balances.map((balance) => {
                  const status = getBalanceStatus(balance.balance);
                  const StatusIcon = status.icon;
                  return (
                    <div key={balance.id} className="p-4 hover:bg-muted/30">
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={getShiftColor(balance.shift_type)}>
                            {getShiftTypeLabel(balance.shift_type)}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(balance.record_date), "dd MMM yyyy", { locale: idLocale })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${status.color} font-semibold`}>
                            <StatusIcon className="h-4 w-4" />
                            <span>{balance.balance > 0 ? "+" : ""}{balance.balance} ml</span>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenEdit(balance)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                setBalanceToDelete(balance.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Intake/Output Summary */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                          <p className="font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                            <ArrowDownToLine className="h-4 w-4" />
                            Intake: {balance.total_intake} ml
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-xs text-green-800 dark:text-green-200">
                            {balance.oral_drink > 0 && <span>Minum: {balance.oral_drink}</span>}
                            {balance.iv_fluid > 0 && <span>Infus: {balance.iv_fluid}</span>}
                            {balance.oral_food > 0 && <span>Makanan: {balance.oral_food}</span>}
                            {balance.iv_medicine > 0 && <span>Obat IV: {balance.iv_medicine}</span>}
                            {balance.enteral_feed > 0 && <span>NGT: {balance.enteral_feed}</span>}
                            {balance.blood_product > 0 && <span>Darah: {balance.blood_product}</span>}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
                          <p className="font-medium text-red-700 dark:text-red-300 mb-2 flex items-center gap-1">
                            <ArrowUpFromLine className="h-4 w-4" />
                            Output: {balance.total_output} ml
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-xs text-red-800 dark:text-red-200">
                            {balance.urine_amount > 0 && <span>Urine: {balance.urine_amount}</span>}
                            {balance.feces_amount > 0 && <span>BAB: {balance.feces_amount}</span>}
                            {balance.vomit_amount > 0 && <span>Muntah: {balance.vomit_amount}</span>}
                            {balance.drain_amount > 0 && <span>Drain: {balance.drain_amount}</span>}
                            {balance.iwl > 0 && <span>IWL: {balance.iwl}</span>}
                            {balance.blood_loss > 0 && <span>Perdarahan: {balance.blood_loss}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      {balance.created_by && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Dicatat oleh: {balance.created_by.full_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-12 text-center text-muted-foreground border rounded-lg">
              <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Belum ada catatan balance cairan</p>
              <p className="text-sm mt-1">Klik "Tambah Balance" untuk menambahkan catatan.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              {editingId ? "Edit Balance Cairan" : "Tambah Balance Cairan"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Date & Shift */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => handleChange("record_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shift</Label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(v) => handleChange("shift_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Intake Section */}
            <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/30">
              <Label className="text-green-700 dark:text-green-300 font-semibold flex items-center gap-2 mb-3">
                <ArrowDownToLine className="h-4 w-4" />
                INTAKE (Masukan)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Minum (ml)</Label>
                  <Input
                    type="number"
                    value={formData.oral_drink || ""}
                    onChange={(e) => handleChange("oral_drink", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Air Makanan (ml)</Label>
                  <Input
                    type="number"
                    value={formData.oral_food || ""}
                    onChange={(e) => handleChange("oral_food", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Obat Oral (ml)</Label>
                  <Input
                    type="number"
                    value={formData.oral_medicine || ""}
                    onChange={(e) => handleChange("oral_medicine", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cairan Infus (ml)</Label>
                  <Input
                    type="number"
                    value={formData.iv_fluid || ""}
                    onChange={(e) => handleChange("iv_fluid", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Obat IV (ml)</Label>
                  <Input
                    type="number"
                    value={formData.iv_medicine || ""}
                    onChange={(e) => handleChange("iv_medicine", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Produk Darah (ml)</Label>
                  <Input
                    type="number"
                    value={formData.blood_product || ""}
                    onChange={(e) => handleChange("blood_product", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NGT/OGT Feed (ml)</Label>
                  <Input
                    type="number"
                    value={formData.enteral_feed || ""}
                    onChange={(e) => handleChange("enteral_feed", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Intake Lain (ml)</Label>
                  <Input
                    type="number"
                    value={formData.other_intake || ""}
                    onChange={(e) => handleChange("other_intake", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="mt-2 text-right text-sm font-semibold text-green-700">
                Total Intake: {calcIntake()} ml
              </div>
            </div>

            {/* Output Section */}
            <div className="border rounded-lg p-4 bg-red-50/50 dark:bg-red-950/30">
              <Label className="text-red-700 dark:text-red-300 font-semibold flex items-center gap-2 mb-3">
                <ArrowUpFromLine className="h-4 w-4" />
                OUTPUT (Keluaran)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Urine (ml)</Label>
                  <Input
                    type="number"
                    value={formData.urine_amount || ""}
                    onChange={(e) => handleChange("urine_amount", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">BAB (ml)</Label>
                  <Input
                    type="number"
                    value={formData.feces_amount || ""}
                    onChange={(e) => handleChange("feces_amount", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Muntah (ml)</Label>
                  <Input
                    type="number"
                    value={formData.vomit_amount || ""}
                    onChange={(e) => handleChange("vomit_amount", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Drain (ml)</Label>
                  <Input
                    type="number"
                    value={formData.drain_amount || ""}
                    onChange={(e) => handleChange("drain_amount", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Perdarahan (ml)</Label>
                  <Input
                    type="number"
                    value={formData.blood_loss || ""}
                    onChange={(e) => handleChange("blood_loss", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IWL (ml)</Label>
                  <Input
                    type="number"
                    value={formData.iwl || ""}
                    onChange={(e) => handleChange("iwl", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Output Lain (ml)</Label>
                  <Input
                    type="number"
                    value={formData.other_output || ""}
                    onChange={(e) => handleChange("other_output", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="catheter"
                      checked={formData.urine_catheter}
                      onCheckedChange={(checked) => handleChange("urine_catheter", checked)}
                    />
                    <label htmlFor="catheter" className="text-xs">
                      Pakai Kateter
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-right text-sm font-semibold text-red-700">
                Total Output: {calcOutput()} ml
              </div>
            </div>

            {/* Balance Preview */}
            <div className={`border rounded-lg p-4 text-center ${
              calcIntake() - calcOutput() > 0 ? "bg-green-100" : 
              calcIntake() - calcOutput() < 0 ? "bg-red-100" : "bg-gray-100"
            }`}>
              <p className="text-sm font-medium">BALANCE</p>
              <p className={`text-2xl font-bold ${
                calcIntake() - calcOutput() > 0 ? "text-green-700" : 
                calcIntake() - calcOutput() < 0 ? "text-red-700" : "text-gray-700"
              }`}>
                {calcIntake() - calcOutput() > 0 ? "+" : ""}{calcIntake() - calcOutput()} ml
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Catatan tambahan..."
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
            <AlertDialogTitle>Hapus Balance Cairan?</AlertDialogTitle>
            <AlertDialogDescription>
              Data balance cairan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
