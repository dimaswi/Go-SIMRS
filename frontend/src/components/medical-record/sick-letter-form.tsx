/**
 * Sick Letter Form Component
 * Form untuk membuat dan mencetak Surat Keterangan Sakit
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { 
  Save, 
  Loader2, 
  FileText, 
  Calendar,
  Printer,
  Trash2,
  Clock,
  Plus,
  Edit,
  ShieldCheck
} from "lucide-react";
import { medicalRecordsApi, printApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import type { SickLetter } from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface SickLetterFormProps {
  visitId: number;
  onSave?: (data: SickLetter) => void;
  readOnly?: boolean;
}

const defaultFormData = {
  start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: format(new Date(), "yyyy-MM-dd"),
  days: 1,
  reason: "",
  purpose: "Untuk dapat dipergunakan sebagaimana mestinya",
  institution: "",
  notes: "",
};

export function SickLetterForm({ visitId, onSave, readOnly = false }: SickLetterFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  
  // Form state for new/edit
  const [formData, setFormData] = useState(defaultFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // List of saved sick letters
  const [sickLetters, setSickLetters] = useState<SickLetter[]>([]);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Active tab
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // Signature state
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean; signer_name?: string }>>({});

  // Load existing sick letters on mount
  useEffect(() => {
    loadSickLetters();
  }, [visitId]);

  const checkSignatureStatus = async (letterId: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.SICK_LETTER, letterId);
      setSignatureStatuses(prev => ({ ...prev, [letterId]: res.data }));
    } catch {
      setSignatureStatuses(prev => ({ ...prev, [letterId]: { is_signed: false } }));
    }
  };

  const handleSignatureSuccess = () => {
    if (signatureLetterId) {
      checkSignatureStatus(signatureLetterId);
    }
    setSignatureLetterId(null);
    toast({ variant: "success", title: "Berhasil", description: "Surat sakit berhasil ditandatangani" });
  };

  const loadSickLetters = async () => {
    try {
      setLoading(true);
      const response = await medicalRecordsApi.getSickLetters(visitId);
      const letters = response.data || [];
      setSickLetters(letters);
      // Check signature status for each letter
      letters.forEach((letter: SickLetter) => checkSignatureStatus(letter.id));
    } catch (error) {
      console.error("Error loading sick letters:", error);
      setSickLetters([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate days when dates change
  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const newData = { ...formData, [field]: value };
    
    if (newData.start_date && newData.end_date) {
      const start = new Date(newData.start_date);
      const end = new Date(newData.end_date);
      const days = differenceInDays(end, start) + 1;
      newData.days = days > 0 ? days : 1;
    }
    
    setFormData(newData);
  };

  // Calculate end date when days change
  const handleDaysChange = (value: number) => {
    const days = value > 0 ? value : 1;
    const start = new Date(formData.start_date);
    const end = addDays(start, days - 1);
    
    setFormData({
      ...formData,
      days,
      end_date: format(end, "yyyy-MM-dd"),
    });
  };

  // Save sick letter
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        visit_id: visitId,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days: formData.days,
        reason: formData.reason,
        purpose: formData.purpose,
        institution: formData.institution,
        notes: formData.notes,
      };

      const response = await medicalRecordsApi.saveSickLetter(visitId, payload);
      
      toast({
        title: "Berhasil",
        description: editingId ? "Surat sakit berhasil diperbarui" : "Surat sakit berhasil disimpan",
      });

      // Reload list
      await loadSickLetters();
      
      // Reset form
      setFormData(defaultFormData);
      setEditingId(null);
      
      // Trigger print refresh
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      
      if (onSave) {
        onSave(response.data);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.response?.data?.error || "Terjadi kesalahan saat menyimpan surat sakit",
      });
    } finally {
      setSaving(false);
    }
  };

  // Edit sick letter
  const handleEdit = (letter: SickLetter) => {
    setFormData({
      start_date: letter.start_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      end_date: letter.end_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      days: letter.days || 1,
      reason: letter.reason || "",
      purpose: letter.purpose || "Untuk dapat dipergunakan sebagaimana mestinya",
      institution: letter.institution || "",
      notes: letter.notes || "",
    });
    setEditingId(letter.id);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  // Delete sick letter
  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      await medicalRecordsApi.deleteSickLetter(visitId, deletingId);
      
      toast({
        title: "Berhasil",
        description: "Surat sakit berhasil dihapus",
      });

      // Reload list
      await loadSickLetters();
      
      // If we were editing this one, reset form
      if (editingId === deletingId) {
        setFormData(defaultFormData);
        setEditingId(null);
      }
      
      // Trigger print refresh
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: error.response?.data?.error || "Terjadi kesalahan saat menghapus surat sakit",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // Print sick letter
  const handlePrint = async (letterId: number) => {
    setPrinting(true);
    try {
      await printApi.sickLetterById(visitId, letterId);
      toast({
        title: "Berhasil",
        description: "Surat sakit berhasil dicetak",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mencetak",
        description: error.response?.data?.error || "Terjadi kesalahan saat mencetak surat sakit",
      });
    } finally {
      setPrinting(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMMM yyyy", { locale: localeId });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="p-0">
        {/* Inline Tabs with Underline */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "form"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {editingId ? "Edit Surat" : "Buat Surat"}
              </span>
              {activeTab === "form" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "history"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Riwayat Surat
                {sickLetters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {sickLetters.length}
                  </Badge>
                )}
              </span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
            {/* Form Tab */}
            {activeTab === "form" && (
              <div className="space-y-4">
                <fieldset disabled={readOnly}>
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">
                  <Calendar className="h-3.5 w-3.5 inline mr-1" />
                  Tanggal Mulai
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleDateChange("start_date", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">
                  <Calendar className="h-3.5 w-3.5 inline mr-1" />
                  Tanggal Selesai
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleDateChange("end_date", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="days">
                  <Clock className="h-3.5 w-3.5 inline mr-1" />
                  Jumlah Hari
                </Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  value={formData.days}
                  onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="reason">Alasan / Keluhan</Label>
              <Textarea
                id="reason"
                placeholder="Alasan sakit / keluhan pasien"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                disabled={readOnly}
                rows={2}
              />
            </div>

            {/* Purpose */}
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="purpose">Tujuan / Keperluan</Label>
              <Input
                id="purpose"
                placeholder="Untuk dapat dipergunakan sebagaimana mestinya"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                disabled={readOnly}
              />
            </div>

            {/* Institution */}
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="institution">Instansi / Perusahaan</Label>
              <Input
                id="institution"
                placeholder="Nama instansi / sekolah / perusahaan (opsional)"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                disabled={readOnly}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="notes">Catatan Tambahan</Label>
              <Textarea
                id="notes"
                placeholder="Catatan tambahan (opsional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={readOnly}
                rows={2}
              />
            </div>

            {/* Actions */}
                {!readOnly && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="gap-1.5"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {editingId ? "Update Surat" : "Simpan Surat"}
                    </Button>
                    {editingId && (
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Batal Edit
                      </Button>
                    )}
                  </div>
                )}
                </fieldset>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-4">
        {sickLetters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Surat</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Lama</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sickLetters.map((letter) => (
                    <TableRow key={letter.id}>
                      <TableCell className="font-medium">
                        {letter.letter_number || "-"}
                      </TableCell>
                      <TableCell>
                        {formatDate(letter.start_date)}
                        {letter.days > 1 && (
                          <span className="text-muted-foreground">
                            {" → "}{formatDate(letter.end_date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {letter.days} hari
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {letter.institution || letter.purpose || "-"}
                      </TableCell>
                      <TableCell>
                        {signatureStatuses[letter.id]?.is_signed ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <ShieldCheck className="h-3 w-3" />
                            Signed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Belum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrint(letter.id)}
                            disabled={printing}
                            title="Cetak"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {!signatureStatuses[letter.id]?.is_signed && !readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSignatureLetterId(letter.id);
                                setShowSignatureDialog(true);
                              }}
                              title="Tanda Tangan"
                              className="text-primary"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {!readOnly && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  handleEdit(letter);
                                  setActiveTab("form");
                                }}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeletingId(letter.id);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Hapus"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
        ) : (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Belum ada surat keterangan sakit untuk kunjungan ini. 
                  Silakan buat surat baru di tab "Buat Surat".
                </AlertDescription>
              </Alert>
        )}
              </div>
            )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat Keterangan Sakit?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus surat keterangan sakit ini? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Dialog */}
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.SICK_LETTER}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle={sickLetters.find(l => l.id === signatureLetterId)?.letter_number || "Surat Sakit"}
          onSuccess={handleSignatureSuccess}
        />
      )}
    </div>
  );
}
