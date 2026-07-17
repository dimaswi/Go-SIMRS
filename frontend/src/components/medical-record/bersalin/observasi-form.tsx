import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TimeInput } from "@/components/ui/time-input";
import type { BersalinRecord } from "@/lib/api";

interface ObservasiProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function ObservasiBersalin({ formData, onChange, isReadOnly }: ObservasiProps) {
  const observasi = Array.isArray(formData.lembar_observasi) ? formData.lembar_observasi : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialRow = { tanggal: "", jam: "", cairan: "", his: "", djj: "", keterangan: "" };
  const [modalData, setModalData] = useState(initialRow);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleOpenModal = (index?: number) => {
    if (index !== undefined) {
      setEditIndex(index);
      const row = observasi[index];
      const [tanggal = "", jam = ""] = row.tanggal_jam ? row.tanggal_jam.split("T") : ["", ""];
      setModalData({
        tanggal,
        jam,
        cairan: row.cairan || "",
        his: row.his || "",
        djj: row.djj || "",
        keterangan: row.keterangan || ""
      });
    } else {
      setEditIndex(null);
      setModalData(initialRow);
    }
    setIsModalOpen(true);
  };

  const handleSaveData = () => {
    // combine tanggal and jam for the final object
    const tanggal_jam = (modalData.tanggal && modalData.jam) ? `${modalData.tanggal}T${modalData.jam}` : "";
    const newRow = {
      tanggal_jam,
      cairan: modalData.cairan,
      his: modalData.his,
      djj: modalData.djj,
      keterangan: modalData.keterangan
    };

    if (editIndex !== null) {
      const newList = [...observasi];
      newList[editIndex] = newRow;
      onChange("lembar_observasi", newList);
      setEditIndex(null);
    } else {
      onChange("lembar_observasi", [...observasi, newRow]);
    }
    setIsModalOpen(false);
  };

  const removeRow = (index: number) => {
    const newList = [...observasi];
    newList.splice(index, 1);
    onChange("lembar_observasi", newList);
  };

  // Helper to format display
  const formatDateTime = (val: string) => {
    if (!val) return "-";
    return val.replace("T", " ");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Lembar Observasi Bersalin
          </div>
          {!isReadOnly && (
            <Button type="button" onClick={() => handleOpenModal()} variant="secondary" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-b-lg">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-3 text-left font-medium w-40">Tanggal / Jam</th>
                <th className="p-3 text-left font-medium">Cairan / Obat yang diberikan</th>
                <th className="p-3 text-center font-medium w-32">His</th>
                <th className="p-3 text-center font-medium w-32">DJJ</th>
                <th className="p-3 text-left font-medium">Keterangan</th>
                {!isReadOnly && <th className="p-3 w-12"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {observasi.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                    Belum ada data observasi. Silakan tambah data baru.
                  </td>
                </tr>
              ) : (
                observasi.map((item: any, i: number) => (
                  <tr key={i} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="p-2 border-r border-border">{formatDateTime(item.tanggal_jam)}</td>
                    <td className="p-2 border-r border-border">{item.cairan || "-"}</td>
                    <td className="p-2 border-r border-border text-center">{item.his || "-"}</td>
                    <td className="p-2 border-r border-border text-center">{item.djj || "-"}</td>
                    <td className="p-2">{item.keterangan || "-"}</td>
                    {!isReadOnly && (
                      <td className="p-1.5 border-l border-border">
                        <div className="flex items-center justify-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleOpenModal(i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeRow(i)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditIndex(null); }}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIndex !== null ? "Edit Data Observasi" : "Tambah Data Observasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={modalData.tanggal} onChange={(e) => setModalData({ ...modalData, tanggal: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jam</Label>
                <TimeInput value={modalData.jam} onChange={(e) => setModalData({ ...modalData, jam: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Kontraksi Rahim</Label>
                <Input value={modalData.his} onChange={(e) => setModalData({ ...modalData, his: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Denyut Jantung Janin (DJJ)</Label>
                <div className="relative">
                  <Input value={modalData.djj} onChange={(e) => setModalData({ ...modalData, djj: e.target.value })} className="h-9 pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x/mnt</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cairan / Obat yang diberikan</Label>
              <Input value={modalData.cairan} onChange={(e) => setModalData({ ...modalData, cairan: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Keterangan</Label>
              <Input value={modalData.keterangan} onChange={(e) => setModalData({ ...modalData, keterangan: e.target.value })} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveData}>Simpan Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
