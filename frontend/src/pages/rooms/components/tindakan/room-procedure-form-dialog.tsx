import { useEffect, useState, useMemo, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState<CreateRoomProcedureRequest>({
    procedure_id: 0,
    is_available: true,
    max_per_day: 0,
    requires_booking: false,
    notes: "",
  });

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (open) {
      if (!hasInitialized.current) {
        if (!roomProcedure) {
          loadProcedures();
          setSelectedIds(new Set());
          setSearch("");
        }
        if (roomProcedure) {
          setFormData({
            procedure_id: roomProcedure.procedure_id,
            is_available: roomProcedure.is_available,
            max_per_day: roomProcedure.max_per_day,
            requires_booking: roomProcedure.requires_booking,
            notes: roomProcedure.notes || "",
          });
        } else {
          setFormData({
            procedure_id: 0,
            is_available: true,
            max_per_day: 0,
            requires_booking: false,
            notes: "",
          });
        }
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
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

  const filteredProcedures = useMemo(() => {
    if (!search) return procedures;
    const lowerSearch = search.toLowerCase();
    return procedures.filter(
      p =>
        p.name.toLowerCase().includes(lowerSearch) ||
        p.code.toLowerCase().includes(lowerSearch)
    );
  }, [procedures, search]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProcedures.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomProcedure && selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih minimal satu tindakan terlebih dahulu.",
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
        const promises = Array.from(selectedIds).map(procId =>
          roomProceduresApi.create(roomId, {
            ...formData,
            procedure_id: procId,
          })
        );
        await Promise.all(promises);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: `${selectedIds.size} tindakan berhasil ditambahkan ke ruangan.`,
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

  const isEditMode = !!roomProcedure;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isEditMode ? "sm:max-w-[425px]" : "sm:max-w-[80vw] h-[85vh] flex flex-col"}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Tindakan" : "Tambah Tindakan"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Edit pengaturan tindakan di ruangan ini"
              : "Pilih dan tambahkan tindakan ke ruangan ini"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={isEditMode ? "space-y-4" : "flex-1 flex flex-col min-h-0"}>
          {isEditMode ? (
            // Form Area for Edit Mode
            <>
              <div className="space-y-2">
                <Label>Tindakan</Label>
                <Input disabled value={`${roomProcedure.procedure?.code} - ${roomProcedure.procedure?.name}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_per_day">Maks. per Hari</Label>
                  <Input
                    id="max_per_day"
                    type="number"
                    value={formData.max_per_day}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max_per_day: Number(e.target.value) }))}
                    placeholder="0 = unlimited"
                  />
                </div>
                <div className="flex flex-col justify-end gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_available"
                      checked={formData.is_available}
                      onCheckedChange={(v) => setFormData((prev) => ({ ...prev, is_available: v }))}
                    />
                    <Label htmlFor="is_available">Tersedia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requires_booking"
                      checked={formData.requires_booking}
                      onCheckedChange={(v) => setFormData((prev) => ({ ...prev, requires_booking: v }))}
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan tambahan..."
                  rows={2}
                />
              </div>
            </>
          ) : (
            // Table and Form Area for Create Mode
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 pb-4">
              <div className="md:col-span-2 flex flex-col border rounded-md min-h-0 overflow-hidden">
                <div className="p-3 border-b flex items-center gap-2 bg-muted/30">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari kode atau nama tindakan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
                  />
                </div>
                <div className="flex-1 overflow-auto">
                  <Table containerClassName="border-0 rounded-none">
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[50px] text-center">
                          <Checkbox
                            checked={filteredProcedures.length > 0 && selectedIds.size === filteredProcedures.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama Tindakan</TableHead>
                        <TableHead>Jenis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingProcedures ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : filteredProcedures.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            Tidak ada tindakan ditemukan.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProcedures.map((proc) => (
                          <TableRow
                            key={proc.id}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(proc.id)}
                                onCheckedChange={(c) => handleSelectOne(proc.id, !!c)}
                              />
                            </TableCell>
                            <TableCell onClick={() => handleSelectOne(proc.id, !selectedIds.has(proc.id))} className="font-medium">{proc.code}</TableCell>
                            <TableCell onClick={() => handleSelectOne(proc.id, !selectedIds.has(proc.id))}>{proc.name}</TableCell>
                            <TableCell onClick={() => handleSelectOne(proc.id, !selectedIds.has(proc.id))}>
                              <span className="text-xs text-muted-foreground">
                                {getProcedureTypeLabel(proc.procedure_type)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-2 border-t text-xs text-muted-foreground flex justify-between bg-muted/30">
                  <span>Total: {filteredProcedures.length} tindakan</span>
                  <span>Terpilih: {selectedIds.size}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label htmlFor="max_per_day">Maks. per Hari</Label>
                  <Input
                    id="max_per_day"
                    type="number"
                    value={formData.max_per_day}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max_per_day: Number(e.target.value) }))}
                    placeholder="0 = unlimited"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="is_available"
                    checked={formData.is_available}
                    onCheckedChange={(v) => setFormData((prev) => ({ ...prev, is_available: v }))}
                  />
                  <Label htmlFor="is_available" className="cursor-pointer">Tersedia</Label>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="requires_booking"
                    checked={formData.requires_booking}
                    onCheckedChange={(v) => setFormData((prev) => ({ ...prev, requires_booking: v }))}
                  />
                  <Label htmlFor="requires_booking" className="cursor-pointer">Perlu Booking</Label>
                </div>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="notes">Catatan</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Catatan tambahan..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className={isEditMode ? "" : "mt-auto pt-4"}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading || (!isEditMode && loadingProcedures) || (!isEditMode && selectedIds.size === 0)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Simpan Perubahan" : `Simpan (${selectedIds.size}) Tindakan`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
