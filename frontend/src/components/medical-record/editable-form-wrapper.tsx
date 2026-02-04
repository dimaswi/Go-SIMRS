import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Pencil, 
  Lock, 
  History, 
  AlertTriangle,
  Clock,
  User,
  FileText
} from "lucide-react";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import type { MedicalRecordEditLog } from "@/lib/api/visits";
import { useToast } from "@/hooks/use-toast";

interface EditableFormWrapperProps {
  visitId: number;
  recordType: string;
  recordId?: number;
  isPatientDischarged: boolean;
  children: (props: { isEditing: boolean; onSaveComplete: (recordId: number) => void }) => React.ReactNode;
  title?: string;
}

export function EditableFormWrapper({
  visitId,
  recordType,
  recordId,
  isPatientDischarged,
  children,
  title
}: EditableFormWrapperProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editLogs, setEditLogs] = useState<MedicalRecordEditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // If patient is not discharged, always allow editing
  useEffect(() => {
    if (!isPatientDischarged) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isPatientDischarged]);

  const loadEditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await medicalRecordEditLogApi.getByVisit(visitId, recordType);
      setEditLogs(response.data || []);
    } catch (error) {
      console.error("Failed to load edit logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  }, [visitId, recordType]);

  // Load edit logs when history dialog opens
  useEffect(() => {
    if (showHistoryDialog) {
      loadEditLogs();
    }
  }, [showHistoryDialog, loadEditLogs]);

  const handleRequestEdit = () => {
    setEditReason("");
    setShowEditDialog(true);
  };

  const handleConfirmEdit = async () => {
    if (!editReason.trim()) {
      toast({
        title: "Alasan diperlukan",
        description: "Mohon isi alasan untuk mengedit rekam medis setelah pasien pulang",
        variant: "destructive",
      });
      return;
    }

    // Log the edit request
    try {
      if (recordId) {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: recordType,
          record_id: recordId,
          action: "edit",
          reason: editReason,
        });
      }
    } catch (error) {
      console.error("Failed to log edit request:", error);
      // Continue with edit even if logging fails
    }

    setIsEditing(true);
    setShowEditDialog(false);
    toast({
      title: "Mode edit aktif",
      description: "Anda dapat mengedit rekam medis. Perubahan akan dicatat dalam log.",
    });
  };

  const handleSaveComplete = async (savedRecordId: number) => {
    // Log the successful edit
    try {
      await medicalRecordEditLogApi.create(visitId, {
        record_type: recordType,
        record_id: savedRecordId,
        action: "edit",
        reason: editReason || "Edit setelah pasien pulang",
        notes: "Perubahan berhasil disimpan",
      });
    } catch (error) {
      console.error("Failed to log edit:", error);
    }

    // Reset editing state after save
    if (isPatientDischarged) {
      setIsEditing(false);
      setEditReason("");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRecordTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      triage: "Triage",
      anamnesis: "Anamnesis",
      physical_exam: "Pemeriksaan Fisik",
      diagnosis: "Diagnosis",
      assessment_plan: "Assessment & Plan",
      cppt: "CPPT",
      nursing_care: "Asuhan Keperawatan",
      fluid_balance: "Balance Cairan",
      disposition: "Disposisi",
    };
    return labels[type] || type;
  };

  return (
    <div className="relative">
      {/* Header with Edit/History buttons for discharged patients */}
      {isPatientDischarged && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {isEditing 
                ? "Mode edit aktif - perubahan akan dicatat" 
                : "Pasien sudah pulang - klik Edit untuk mengubah"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryDialog(true)}
              className="gap-1.5"
            >
              <History className="h-4 w-4" />
              Riwayat Edit
            </Button>
            {!isEditing && (
              <Button
                size="sm"
                onClick={handleRequestEdit}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
              >
                <Pencil className="h-4 w-4" />
                Edit {title || getRecordTypeLabel(recordType)}
              </Button>
            )}
            {isEditing && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Mode Edit Aktif
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* The actual form */}
      {children({ isEditing, onSaveComplete: handleSaveComplete })}

      {/* Edit Confirmation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Konfirmasi Edit Rekam Medis
            </DialogTitle>
            <DialogDescription>
              Pasien sudah pulang. Perubahan pada rekam medis akan dicatat dalam log audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-reason" className="text-sm font-medium">
                Alasan Edit <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-reason"
                placeholder="Jelaskan alasan mengapa rekam medis perlu diedit setelah pasien pulang..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Alasan ini akan dicatat bersama dengan username, waktu, dan IP address Anda.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleConfirmEdit} disabled={!editReason.trim()}>
              Lanjutkan Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Riwayat Edit {title || getRecordTypeLabel(recordType)}
            </DialogTitle>
            <DialogDescription>
              Log perubahan rekam medis setelah pasien pulang
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {loadingLogs ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : editLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada riwayat edit untuk {title || getRecordTypeLabel(recordType)}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {editLogs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.action === "edit" ? "Diedit" : log.action === "create" ? "Dibuat" : "Dihapus"}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.edited_at)}
                            </span>
                          </div>
                          {log.reason && (
                            <p className="text-sm mt-2">
                              <span className="font-medium">Alasan:</span> {log.reason}
                            </p>
                          )}
                          {log.notes && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Catatan:</span> {log.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 justify-end">
                            <User className="h-3 w-3" />
                            {log.edited_by?.name || log.edited_by?.username || `User #${log.edited_by_id}`}
                          </div>
                          {log.ip_address && (
                            <div className="mt-1 font-mono">{log.ip_address}</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
