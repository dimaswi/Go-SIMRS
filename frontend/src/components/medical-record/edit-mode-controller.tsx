import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { 
  Pencil, 
  Lock, 
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UseEditModeOptions {
  isPatientDischarged: boolean;
  recordType: string;
  onEditConfirmed?: (reason: string) => void;
}

export function useEditMode({ 
  isPatientDischarged, 
  recordType: _recordType,
  onEditConfirmed 
}: UseEditModeOptions) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!isPatientDischarged);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editReason, setEditReason] = useState("");

  const handleRequestEdit = () => {
    if (!isPatientDischarged) {
      setIsEditing(true);
      return;
    }
    setEditReason("");
    setShowEditDialog(true);
  };

  const handleConfirmEdit = () => {
    if (!editReason.trim()) {
      toast({
        title: "Alasan diperlukan",
        description: "Mohon isi alasan untuk mengedit rekam medis setelah pasien pulang",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);
    setShowEditDialog(false);
    onEditConfirmed?.(editReason);
    toast({
      title: "Mode edit aktif",
      description: "Anda dapat mengedit rekam medis. Perubahan akan dicatat dalam log.",
    });
  };

  const resetEditMode = () => {
    if (isPatientDischarged) {
      setIsEditing(false);
      setEditReason("");
    }
  };

  return {
    isEditing,
    editReason,
    showEditDialog,
    setShowEditDialog,
    setEditReason,
    handleRequestEdit,
    handleConfirmEdit,
    resetEditMode,
  };
}

interface EditModeBannerProps {
  isPatientDischarged: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  recordTypeLabel: string;
}

export function EditModeBanner({
  isPatientDischarged,
  isEditing,
  onRequestEdit,
  recordTypeLabel,
}: EditModeBannerProps) {
  if (!isPatientDischarged) return null;

  return (
    <div className="mb-4 flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-amber-800 dark:text-amber-200">
          {isEditing 
            ? "Mode edit aktif - perubahan akan dicatat dalam log" 
            : "Pasien sudah pulang - klik tombol Edit untuk mengubah data"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <Button
            size="sm"
            onClick={onRequestEdit}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
          >
            <Pencil className="h-4 w-4" />
            Edit {recordTypeLabel}
          </Button>
        ) : (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Mode Edit Aktif
          </Badge>
        )}
      </div>
    </div>
  );
}

interface EditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editReason: string;
  onEditReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function EditConfirmDialog({
  open,
  onOpenChange,
  editReason,
  onEditReasonChange,
  onConfirm,
}: EditConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Konfirmasi Edit Rekam Medis
          </DialogTitle>
          <DialogDescription>
            Pasien sudah pulang. Perubahan pada rekam medis akan dicatat dalam log audit 
            beserta username, waktu, dan IP address Anda.
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
              onChange={(e) => onEditReasonChange(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Contoh: Koreksi data yang salah input, tambahan informasi dari hasil lab, dll.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={!editReason.trim()}>
            Lanjutkan Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
