import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Pencil } from "lucide-react";
import type { BersalinRecord } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PartografProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

const initialRow = {
  waktu: "",
  djj: "",
  air_ketuban: "",
  penyusupan: "",
  pembukaan: "",
  turunnya_kepala: "",
  kontraksi_jumlah: "",
  kontraksi_durasi: "",
  oksitosin: "",
  obat_cairan: "",
  nadi: "",
  tekanan_darah: "",
  suhu: "",
  urin_protein: "",
  urin_aseton: "",
  urin_volume: ""
};

export function PartografBersalin({ formData, onChange, isReadOnly }: PartografProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState(initialRow);

  const partografData = Array.isArray(formData.partograf_data) ? formData.partograf_data : [];

  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleOpenModal = (index?: number) => {
    if (index !== undefined) {
      setEditIndex(index);
      setModalData(partografData[index]);
    } else {
      setEditIndex(null);
      setModalData(initialRow);
    }
    setIsModalOpen(true);
  };

  const handleSaveData = () => {
    if (editIndex !== null) {
      const newList = [...partografData];
      newList[editIndex] = modalData;
      onChange("partograf_data", newList);
      setEditIndex(null);
    } else {
      onChange("partograf_data", [...partografData, modalData]);
    }
    setIsModalOpen(false);
  };

  const removeRow = (index: number) => {
    const newList = [...partografData];
    newList.splice(index, 1);
    onChange("partograf_data", newList);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Informasi Umum Partograf
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div className="space-y-2">
              <Label>Ketuban pecah sejak jam</Label>
              <TimeInput
                value={formData.ketuban_pecah_jam || ""}
                onChange={(e) => onChange("ketuban_pecah_jam", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Mules sejak jam</Label>
              <TimeInput
                value={formData.mules_sejak_jam || ""}
                onChange={(e) => onChange("mules_sejak_jam", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Data Partograf (Observasi per Jam/30 Menit)
          </div>
          {!isReadOnly && (
            <Button type="button" onClick={() => handleOpenModal()} variant="secondary" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-b-lg">
          <table className="w-full text-[11px] min-w-[700px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>Waktu<br />(Jam)</th>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>DJJ<br />(x/mnt)</th>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>Air<br />Ketuban</th>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>Penyu-<br />supan</th>
                <th className="p-2 border-r text-center font-medium" colSpan={2}>Kemajuan Persalinan</th>
                <th className="p-2 border-r text-center font-medium" colSpan={2}>Kontraksi / 10mnt</th>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>Oksitosin<br />U/L tts/mnt</th>
                <th className="p-2 border-r align-bottom font-medium" rowSpan={2}>Obat &<br />Cairan IV</th>
                <th className="p-2 border-r text-center font-medium" colSpan={3}>Tanda Vital Ibu</th>
                <th className="p-2 text-center font-medium" colSpan={3}>Urin</th>
                {!isReadOnly && <th className="p-2 align-bottom font-medium" rowSpan={2}></th>}
              </tr>
              <tr className="border-b">
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Pembukaan (cm)</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Trn. Kepala</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Jumlah</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Durasi (dtk)</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Nadi</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">TD</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Suhu</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Protein</th>
                <th className="p-1 border-r font-medium text-muted-foreground text-[10px]">Aseton</th>
                <th className="p-1 font-medium text-muted-foreground text-[10px]">Vol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {partografData.length === 0 ? (
                <tr>
                  <td colSpan={17} className="p-6 text-center text-muted-foreground">Belum ada data partograf</td>
                </tr>
              ) : (
                partografData.map((item: any, i: number) => (
                  <tr key={i} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="p-1 border-r text-center">{item.waktu || "-"}</td>
                    <td className="p-1 border-r text-center">{item.djj || "-"}</td>
                    <td className="p-1 border-r text-center">{item.air_ketuban || "-"}</td>
                    <td className="p-1 border-r text-center">{item.penyusupan || "-"}</td>
                    <td className="p-1 border-r text-center">{item.pembukaan || "-"}</td>
                    <td className="p-1 border-r text-center">{item.turunnya_kepala || "-"}</td>
                    <td className="p-1 border-r text-center">{item.kontraksi_jumlah || "-"}</td>
                    <td className="p-1 border-r text-center">{item.kontraksi_durasi || "-"}</td>
                    <td className="p-1 border-r text-center">{item.oksitosin || "-"}</td>
                    <td className="p-1 border-r text-center">{item.obat_cairan || "-"}</td>
                    <td className="p-1 border-r text-center">{item.nadi || "-"}</td>
                    <td className="p-1 border-r text-center">{item.tekanan_darah || "-"}</td>
                    <td className="p-1 border-r text-center">{item.suhu || "-"}</td>
                    <td className="p-1 border-r text-center">{item.urin_protein || "-"}</td>
                    <td className="p-1 border-r text-center">{item.urin_aseton || "-"}</td>
                    <td className="p-1 text-center">{item.urin_volume || "-"}</td>
                    {!isReadOnly && (
                      <td className="p-1 border-l">
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
        <div className="p-3 bg-muted/10 border-t flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary/20 text-primary text-[8px] font-bold">i</span>
            Isi data setiap 30 menit atau 1 jam sesuai kebutuhan observasi partograf.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Laporan Tindakan Persalinan
        </div>
        <div className="p-4 sm:p-6">
          <Textarea
            value={formData.laporan_tindakan?.keterangan || ""}
            onChange={(e) => onChange("laporan_tindakan", { ...formData.laporan_tindakan, keterangan: e.target.value })}
            disabled={isReadOnly}
            rows={6}
            placeholder="Tgl: ..... Jam: ..... s/d .....&#10;Tindakan: ...."
            className="resize-none"
          />
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditIndex(null); }}>
        <DialogContent className="max-w-md sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Data Partograf</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            
            {/* Dasar */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Waktu (Jam)</Label>
                <TimeInput value={modalData.waktu} onChange={(e) => setModalData({ ...modalData, waktu: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">DJJ (x/mnt)</Label>
                <Input value={modalData.djj} onChange={(e) => setModalData({ ...modalData, djj: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Air Ketuban</Label>
                <Input value={modalData.air_ketuban} onChange={(e) => setModalData({ ...modalData, air_ketuban: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Penyusupan</Label>
                <Input value={modalData.penyusupan} onChange={(e) => setModalData({ ...modalData, penyusupan: e.target.value })} className="h-9" />
              </div>
            </div>

            {/* Kemajuan & Kontraksi */}
            <div className="rounded-lg border border-border/70 p-4 bg-muted/20 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Kemajuan Persalinan & Kontraksi</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Pembukaan (cm)</Label>
                  <Input value={modalData.pembukaan} onChange={(e) => setModalData({ ...modalData, pembukaan: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Turunnya Kepala</Label>
                  <Input value={modalData.turunnya_kepala} onChange={(e) => setModalData({ ...modalData, turunnya_kepala: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Jumlah Kontraksi / 10mnt</Label>
                  <Input value={modalData.kontraksi_jumlah} onChange={(e) => setModalData({ ...modalData, kontraksi_jumlah: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Durasi Kontraksi (dtk)</Label>
                  <Input value={modalData.kontraksi_durasi} onChange={(e) => setModalData({ ...modalData, kontraksi_durasi: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>

            {/* Obat & Cairan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Oksitosin U/L tts/mnt</Label>
                <Input value={modalData.oksitosin} onChange={(e) => setModalData({ ...modalData, oksitosin: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Obat & Cairan IV</Label>
                <Input value={modalData.obat_cairan} onChange={(e) => setModalData({ ...modalData, obat_cairan: e.target.value })} className="h-9" />
              </div>
            </div>

            {/* Tanda Vital & Urin */}
            <div className="rounded-lg border border-border/70 p-4 bg-muted/20 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Tanda Vital Ibu & Urin</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tekanan Darah</Label>
                  <Input value={modalData.tekanan_darah} onChange={(e) => setModalData({ ...modalData, tekanan_darah: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Suhu</Label>
                  <Input value={modalData.suhu} onChange={(e) => setModalData({ ...modalData, suhu: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nadi</Label>
                  <Input value={modalData.nadi} onChange={(e) => setModalData({ ...modalData, nadi: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Volume Urin</Label>
                  <Input value={modalData.urin_volume} onChange={(e) => setModalData({ ...modalData, urin_volume: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Protein Urin</Label>
                  <Input value={modalData.urin_protein} onChange={(e) => setModalData({ ...modalData, urin_protein: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Aseton Urin</Label>
                  <Input value={modalData.urin_aseton} onChange={(e) => setModalData({ ...modalData, urin_aseton: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveData}>Simpan Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
