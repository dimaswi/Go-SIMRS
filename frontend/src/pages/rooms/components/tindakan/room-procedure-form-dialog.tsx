import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  proceduresApi,
  roomProceduresApi,
  getProcedureTypeLabel,
} from "@/lib/api/procedures";
import type {
  Procedure,
  RoomProcedure,
  CreateRoomProcedureRequest,
} from "@/lib/api/procedures";

interface RoomProcedureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  roomProcedure?: RoomProcedure | null;
  onSuccess: () => void;
}

export function RoomProcedureFormDialog({
  open,
  onOpenChange,
  roomId,
  roomProcedure,
  onSuccess,
}: RoomProcedureFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [procedureOpen, setProcedureOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);

  const [formData, setFormData] = useState<CreateRoomProcedureRequest>({
    procedure_id: 0,
    is_available: true,
    max_per_day: 0,
    requires_booking: false,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadProcedures();
      if (roomProcedure) {
        setFormData({
          procedure_id: roomProcedure.procedure_id,
          is_available: roomProcedure.is_available,
          max_per_day: roomProcedure.max_per_day,
          requires_booking: roomProcedure.requires_booking,
          notes: roomProcedure.notes || "",
        });
        if (roomProcedure.procedure) {
          setSelectedProcedure(roomProcedure.procedure);
        }
      } else {
        setFormData({
          procedure_id: 0,
          is_available: true,
          max_per_day: 0,
          requires_booking: false,
          notes: "",
        });
        setSelectedProcedure(null);
      }
    }
  }, [roomProcedure, open]);

  const loadProcedures = async () => {
    setLoadingProcedures(true);
    try {
      const res = await proceduresApi.getAll({ is_active: true });
      setProcedures(res.data.data || []);
    } catch (error) {
      console.error("Failed to load procedures:", error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.procedure_id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih tindakan terlebih dahulu.",
      });
      return;
    }

    setLoading(true);

    try {
      if (roomProcedure) {
        await roomProceduresApi.update(roomId, roomProcedure.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Tindakan berhasil diperbarui.",
        });
      } else {
        await roomProceduresApi.create(roomId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Tindakan berhasil ditambahkan ke ruangan.",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan tindakan.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcedureSelect = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setFormData((prev) => ({
      ...prev,
      procedure_id: procedure.id,
    }));
    setProcedureOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {roomProcedure ? "Edit Tindakan" : "Tambah Tindakan"}
          </DialogTitle>
          <DialogDescription>
            {roomProcedure
              ? "Edit pengaturan tindakan di ruangan ini"
              : "Pilih dan tambahkan tindakan ke ruangan ini"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Procedure Selection */}
          <div className="space-y-2">
            <Label>Tindakan *</Label>
            <Popover open={procedureOpen} onOpenChange={setProcedureOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={procedureOpen}
                  className="w-full justify-between"
                  disabled={!!roomProcedure}
                >
                  {selectedProcedure
                    ? `${selectedProcedure.code} - ${selectedProcedure.name}`
                    : "Pilih tindakan..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Cari tindakan..." />
                  <CommandList>
                    <CommandEmpty>
                      {loadingProcedures
                        ? "Memuat..."
                        : "Tidak ada tindakan ditemukan."}
                    </CommandEmpty>
                    <CommandGroup>
                      {procedures.map((procedure) => (
                        <CommandItem
                          key={procedure.id}
                          value={`${procedure.code} ${procedure.name}`}
                          onSelect={() => handleProcedureSelect(procedure)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProcedure?.id === procedure.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {procedure.code} - {procedure.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getProcedureTypeLabel(procedure.procedure_type)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_per_day">Maks. per Hari</Label>
              <Input
                id="max_per_day"
                type="number"
                value={formData.max_per_day}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    max_per_day: Number(e.target.value),
                  }))
                }
                placeholder="0 = unlimited"
              />
            </div>
            <div className="flex flex-col justify-end gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_available"
                  checked={formData.is_available}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, is_available: v }))
                  }
                />
                <Label htmlFor="is_available">Tersedia</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requires_booking"
                  checked={formData.requires_booking}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, requires_booking: v }))
                  }
                />
                <Label htmlFor="requires_booking">Perlu Booking</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Catatan tambahan..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
