import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, X, Pencil } from "lucide-react";
import type { BersalinRecord } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CatatanPersalinanProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function CatatanPersalinanBersalin({ formData, onChange, isReadOnly }: CatatanPersalinanProps) {
  const kala1 = formData.catatan_kala_1 || {};
  const kala2 = formData.catatan_kala_2 || {};
  const kala3 = formData.catatan_kala_3 || {};
  const kala4 = Array.isArray(formData.pemantauan_kala_4) ? formData.pemantauan_kala_4 : [];

  const updateKala1 = (key: string, value: any) => onChange("catatan_kala_1", { ...kala1, [key]: value });
  const updateKala2 = (key: string, value: any) => onChange("catatan_kala_2", { ...kala2, [key]: value });
  const updateKala3 = (key: string, value: any) => onChange("catatan_kala_3", { ...kala3, [key]: value });

  const [isKala4ModalOpen, setIsKala4ModalOpen] = useState(false);
  const initialKala4Row = { jam_ke: "", waktu: "", tekanan_darah: "", nadi: "", suhu: "", tinggi_fundus: "", kontraksi: "", kandung_kemih: "", pendarahan: "" };
  const [kala4ModalData, setKala4ModalData] = useState(initialKala4Row);
  const [editKala4Index, setEditKala4Index] = useState<number | null>(null);

  const handleOpenKala4Modal = (index?: number) => {
    if (index !== undefined) {
      setEditKala4Index(index);
      setKala4ModalData(kala4[index]);
    } else {
      setEditKala4Index(null);
      setKala4ModalData(initialKala4Row);
    }
    setIsKala4ModalOpen(true);
  };

  const handleSaveKala4Data = () => {
    if (editKala4Index !== null) {
      const newList = [...kala4];
      newList[editKala4Index] = kala4ModalData;
      onChange("pemantauan_kala_4", newList);
      setEditKala4Index(null);
    } else {
      onChange("pemantauan_kala_4", [...kala4, kala4ModalData]);
    }
    setIsKala4ModalOpen(false);
  };

  const removeKala4Row = (index: number) => {
    const newList = [...kala4];
    newList.splice(index, 1);
    onChange("pemantauan_kala_4", newList);
  };

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9):not(.h-8)]:h-10 [&_[role=combobox]:not(.h-9):not(.h-8)]:h-10">

      {/* SINGLE CARD WRAPPER */}
      <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b border-border/50 bg-muted/40 px-4 py-3 flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Catatan Persalinan (Kala I - IV)
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-8 bg-slate-50/40 dark:bg-transparent">
          {/* DATA UMUM */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Data Umum</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={kala1.tanggal || ""} onChange={e => updateKala1("tanggal", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nama Bidan</Label>
                <Input value={kala1.nama_bidan || ""} onChange={e => updateKala1("nama_bidan", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tempat persalinan</Label>
                <Select value={kala1.tempat || "Klinik swasta"} onValueChange={v => updateKala1("tempat", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    {['Rumah Ibu', 'Puskesmas', 'Polindes', 'Rumah Sakit', 'Klinik swasta', 'Lainnya'].map(item => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label className="text-xs">Alamat tempat persalinan</Label>
                <Textarea value={kala1.alamat || ""} onChange={e => updateKala1("alamat", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Catatan (Rujuk, kala : I / II / III / IV)</Label>
                <Input value={kala1.catatan_rujuk || ""} onChange={e => updateKala1("catatan_rujuk", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alasan merujuk</Label>
                <Input value={kala1.alasan_merujuk || ""} onChange={e => updateKala1("alasan_merujuk", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tempat merujuk</Label>
                <Input value={kala1.tempat_merujuk || ""} onChange={e => updateKala1("tempat_merujuk", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-3 md:col-span-3">
                <Label className="text-xs">Pendamping pada saat merujuk</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {['Bidan', 'Teman', 'Suami', 'Dukun', 'Keluarga', 'Tidak ada'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox checked={(kala1.pendamping_rujuk || []).includes(item)} onCheckedChange={(c) => {
                        const curr = kala1.pendamping_rujuk || [];
                        updateKala1("pendamping_rujuk", c ? [...curr, item] : curr.filter((x: string) => x !== item));
                      }} disabled={isReadOnly} />
                      <span className="font-normal cursor-pointer select-none text-sm" onClick={() => {
                        if (isReadOnly) return;
                        const curr = kala1.pendamping_rujuk || [];
                        const isChecked = curr.includes(item);
                        updateKala1("pendamping_rujuk", !isChecked ? [...curr, item] : curr.filter((x: string) => x !== item));
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* KALA I */}
          <div className="pt-6 border-t border-border/40 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Kala I</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Partograf melewati garis waspada</Label>
                <Select value={kala1.waspada || "T"} onValueChange={v => updateKala1("waspada", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y">Ya (Y)</SelectItem>
                    <SelectItem value="T">Tidak (T)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">Masalah lain, sebutkan:</Label>
                <Input value={kala1.masalah_lain || ""} onChange={e => updateKala1("masalah_lain", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Penatalaksanaan masalah tersebut:</Label>
                <Textarea value={kala1.penatalaksanaan || ""} onChange={e => updateKala1("penatalaksanaan", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Hasilnya:</Label>
                <Textarea value={kala1.hasil || ""} onChange={e => updateKala1("hasil", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
            </div>
          </div>

          {/* KALA II */}
          <div className="pt-6 border-t border-border/40 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Kala II</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label className="text-xs">Episiotomi</Label>
                <Select value={kala2.episiotomi || "Tidak"} onValueChange={v => updateKala2("episiotomi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.episiotomi === "Ya" && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Indikasi:</Label>
                    <Input value={kala2.episiotomi_indikasi || ""} onChange={e => updateKala2("episiotomi_indikasi", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Gawat Janin</Label>
                <Select value={kala2.gawat_janin || "Tidak"} onValueChange={v => updateKala2("gawat_janin", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.gawat_janin === "Ya" && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Tindakan:</Label>
                    <Input value={kala2.gawat_janin_tindakan || ""} onChange={e => updateKala2("gawat_janin_tindakan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Distosia bahu</Label>
                <Select value={kala2.distosia || "Tidak"} onValueChange={v => updateKala2("distosia", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.distosia === "Ya" && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Tindakan:</Label>
                    <Input value={kala2.distosia_tindakan || ""} onChange={e => updateKala2("distosia_tindakan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3 md:col-span-3 pt-2">
                <Label className="text-xs">Pendamping pada saat persalinan</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {['Suami', 'Keluarga', 'Teman', 'Dukun', 'Tidak ada'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox checked={(kala2.pendamping || []).includes(item)} onCheckedChange={(c) => {
                        const curr = kala2.pendamping || [];
                        updateKala2("pendamping", c ? [...curr, item] : curr.filter((x: string) => x !== item));
                      }} disabled={isReadOnly} />
                      <span className="font-normal cursor-pointer select-none text-sm" onClick={() => {
                        if (isReadOnly) return;
                        const curr = kala2.pendamping || [];
                        const isChecked = curr.includes(item);
                        updateKala2("pendamping", !isChecked ? [...curr, item] : curr.filter((x: string) => x !== item));
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">Masalah lain, sebutkan:</Label>
                <Input value={kala2.masalah_lain || ""} onChange={e => updateKala2("masalah_lain", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1 md:col-span-3 lg:col-span-2">
                <Label className="text-xs">Penatalaksanaan masalah tersebut:</Label>
                <Textarea value={kala2.penatalaksanaan || ""} onChange={e => updateKala2("penatalaksanaan", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
              <div className="space-y-1 md:col-span-3 lg:col-span-1">
                <Label className="text-xs">Hasilnya:</Label>
                <Textarea value={kala2.hasil || ""} onChange={e => updateKala2("hasil", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
            </div>
          </div>

          {/* KALA III */}
          <div className="pt-6 border-t border-border/40 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase text-muted-foreground">Kala III</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Lama Kala III</Label>
                <div className="relative w-full">
                  <Input type="number" value={kala3.lama ?? ""} onChange={e => updateKala3("lama", e.target.value)} disabled={isReadOnly} className="pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">menit</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Jumlah pendarahan</Label>
                <div className="relative w-full">
                  <Input type="number" value={kala3.jumlah_pendarahan ?? ""} onChange={e => updateKala3("jumlah_pendarahan", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ml</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Pemberian Oksitosin 10 iu?</Label>
                <Select value={kala3.oksitosin_10 || ""} onValueChange={v => updateKala3("oksitosin_10", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.oksitosin_10 === "Ya" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground truncate" title="Waktu (menit sesudah persalinan)">Waktu (menit stlh lahir)</Label>
                    <Input type="number" value={kala3.oksitosin_10_waktu ?? ""} onChange={e => updateKala3("oksitosin_10_waktu", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
                {kala3.oksitosin_10 === "Tidak" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Alasan tidak:</Label>
                    <Input value={kala3.oksitosin_10_alasan || ""} onChange={e => updateKala3("oksitosin_10_alasan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Pemberian ulang Oksitosin?</Label>
                <Select value={kala3.oksitosin_ulang || "Tidak"} onValueChange={v => updateKala3("oksitosin_ulang", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.oksitosin_ulang === "Ya" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Alasan diulang:</Label>
                    <Input value={kala3.oksitosin_ulang_alasan || ""} onChange={e => updateKala3("oksitosin_ulang_alasan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Penegangan tali pusat tkk:</Label>
                <Select value={kala3.penegangan_tali || "Ya"} onValueChange={v => updateKala3("penegangan_tali", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.penegangan_tali === "Tidak" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Alasan:</Label>
                    <Input value={kala3.penegangan_tali_alasan || ""} onChange={e => updateKala3("penegangan_tali_alasan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Masase fundus uteri?</Label>
                <Select value={kala3.masase_fundus || "Ya"} onValueChange={v => updateKala3("masase_fundus", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.masase_fundus === "Tidak" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Alasan:</Label>
                    <Input value={kala3.masase_fundus_alasan || ""} onChange={e => updateKala3("masase_fundus_alasan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Plasenta lahir:</Label>
                <Select value={kala3.plasenta_lahir || "Lengkap"} onValueChange={v => updateKala3("plasenta_lahir", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lengkap">Lengkap (Intake)</SelectItem>
                    <SelectItem value="Tidak lengkap">Tidak lengkap</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.plasenta_lahir === "Tidak lengkap" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Tindakan:</Label>
                    <Input value={kala3.plasenta_tindakan || ""} onChange={e => updateKala3("plasenta_tindakan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Plasenta tidak lahir &gt; 30 mnt:</Label>
                <Select value={kala3.plasenta_lambat || "Tidak"} onValueChange={v => updateKala3("plasenta_lambat", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.plasenta_lambat === "Ya" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Tindakan:</Label>
                    <Input value={kala3.plasenta_lambat_tindakan || ""} onChange={e => updateKala3("plasenta_lambat_tindakan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <Label className="text-xs">Atoni uteri:</Label>
                <Select value={kala3.atoni_uteri || "Tidak"} onValueChange={v => updateKala3("atoni_uteri", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.atoni_uteri === "Ya" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Tindakan:</Label>
                    <Input value={kala3.atoni_tindakan || ""} onChange={e => updateKala3("atoni_tindakan", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Laserasi:</Label>
                <Select value={kala3.laserasi || "Tidak"} onValueChange={v => updateKala3("laserasi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
                {kala3.laserasi === "Ya" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Lokasi:</Label>
                    <Input value={kala3.laserasi_lokasi || ""} onChange={e => updateKala3("laserasi_lokasi", e.target.value)} disabled={isReadOnly} />
                  </div>
                )}
              </div>

              {kala3.laserasi === "Ya" && (
                <div className="space-y-3">
                  <Label className="text-xs">Derajat Laserasi:</Label>
                  <Select value={kala3.laserasi_derajat || ""} onValueChange={(v) => updateKala3("laserasi_derajat", v)} disabled={isReadOnly}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
              {kala3.laserasi === "Ya" && (
                <div className="space-y-3">
                  <Label className="text-xs">Tindakan Laserasi:</Label>
                  <Select value={kala3.laserasi_tindakan || ""} onValueChange={(v) => updateKala3("laserasi_tindakan", v)} disabled={isReadOnly}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Penjahitan dengan anestesi">Penjahitan dengan anestesi</SelectItem>
                      <SelectItem value="Penjahitan tanpa anestesi">Penjahitan tanpa anestesi</SelectItem>
                      <SelectItem value="Tidak dijahit">Tidak dijahit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1 md:col-span-4">
                <Label className="text-xs">Masalah lain, sebutkan:</Label>
                <Input value={kala3.masalah_lain || ""} onChange={e => updateKala3("masalah_lain", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1 md:col-span-4 lg:col-span-2">
                <Label className="text-xs">Penatalaksanaan masalah tersebut:</Label>
                <Textarea value={kala3.penatalaksanaan || ""} onChange={e => updateKala3("penatalaksanaan", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
              <div className="space-y-1 md:col-span-4 lg:col-span-2">
                <Label className="text-xs">Hasilnya:</Label>
                <Textarea value={kala3.hasil || ""} onChange={e => updateKala3("hasil", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
            </div>
          </div>

          {/* KALA IV */}
          <div className="pt-6 border-t border-border/40 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase text-muted-foreground tracking-[0.1em]">
                Kala IV (Pemantauan)
              </h4>
              {!isReadOnly && (
                <Button type="button" onClick={() => handleOpenKala4Modal()} variant="secondary" size="sm" className="h-7 text-xs gap-1.5 px-3">
                  <Plus className="h-3.5 w-3.5" /> Tambah Data
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[11px] min-w-[700px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-2 border-r text-center font-medium w-16">Jam Ke</th>
                    <th className="p-2 border-r text-center font-medium w-24">Waktu</th>
                    <th className="p-2 border-r text-center font-medium w-20">TD</th>
                    <th className="p-2 border-r text-center font-medium w-16">Nadi</th>
                    <th className="p-2 border-r text-center font-medium w-16">Suhu</th>
                    <th className="p-2 border-r text-center font-medium">TFU</th>
                    <th className="p-2 border-r text-center font-medium">Kontraksi</th>
                    <th className="p-2 border-r text-center font-medium">Kdg Kemih</th>
                    <th className="p-2 text-center font-medium">Pendarahan</th>
                    {!isReadOnly && <th className="p-2 w-12 border-l"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {kala4.length === 0 ? (
                    <tr><td colSpan={10} className="p-6 text-center text-muted-foreground text-[11px] bg-card">Belum ada pemantauan kala IV</td></tr>
                  ) : (
                    kala4.map((item: any, i: number) => (
                      <tr key={i} className="bg-card hover:bg-muted/30 transition-colors">
                        <td className="p-1 border-r border-border text-center">{item.jam_ke || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.waktu || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.tekanan_darah || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.nadi || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.suhu || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.tinggi_fundus || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.kontraksi || "-"}</td>
                        <td className="p-1 border-r border-border text-center">{item.kandung_kemih || "-"}</td>
                        <td className="p-1 text-center">{item.pendarahan || "-"}</td>
                        {!isReadOnly && (
                          <td className="p-1 border-l">
                            <div className="flex items-center justify-center gap-1">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleOpenKala4Modal(i)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeKala4Row(i)}>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Masalah kala IV:</Label>
                <Textarea value={formData.catatan_kala_4?.masalah_kala_4 || ""} onChange={e => onChange("catatan_kala_4", { ...formData.catatan_kala_4, masalah_kala_4: e.target.value })} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Hasilnya:</Label>
                <Textarea value={formData.catatan_kala_4?.hasil_kala_4 || ""} onChange={e => onChange("catatan_kala_4", { ...formData.catatan_kala_4, hasil_kala_4: e.target.value })} disabled={isReadOnly} rows={2} className="resize-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isKala4ModalOpen} onOpenChange={(open) => { setIsKala4ModalOpen(open); if (!open) setEditKala4Index(null); }}>
        <DialogContent className="max-w-md sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editKala4Index !== null ? "Edit Pemantauan Kala IV" : "Tambah Pemantauan Kala IV"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">

            {/* Waktu */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Jam Ke</Label>
                <Input value={kala4ModalData.jam_ke} onChange={(e) => setKala4ModalData({ ...kala4ModalData, jam_ke: e.target.value })} className="h-9" placeholder="1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Waktu</Label>
                <TimeInput value={kala4ModalData.waktu} onChange={(e) => setKala4ModalData({ ...kala4ModalData, waktu: e.target.value })} className="h-9" />
              </div>
            </div>

            {/* Tanda Vital */}
            <div className="rounded-lg border border-border/70 p-4 bg-muted/20 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Tanda Vital</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Tekanan Darah</Label>
                  <Input value={kala4ModalData.tekanan_darah} onChange={(e) => setKala4ModalData({ ...kala4ModalData, tekanan_darah: e.target.value })} className="h-9" placeholder="120/80" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nadi</Label>
                  <Input value={kala4ModalData.nadi} onChange={(e) => setKala4ModalData({ ...kala4ModalData, nadi: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Suhu</Label>
                  <Input value={kala4ModalData.suhu} onChange={(e) => setKala4ModalData({ ...kala4ModalData, suhu: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>

            {/* Kondisi Rahim & Pendarahan */}
            <div className="rounded-lg border border-border/70 p-4 bg-muted/20 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Kondisi & Pemantauan</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tinggi Fundus</Label>
                  <Input value={kala4ModalData.tinggi_fundus} onChange={(e) => setKala4ModalData({ ...kala4ModalData, tinggi_fundus: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Kontraksi</Label>
                  <Input value={kala4ModalData.kontraksi} onChange={(e) => setKala4ModalData({ ...kala4ModalData, kontraksi: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Kandung Kemih</Label>
                  <Input value={kala4ModalData.kandung_kemih} onChange={(e) => setKala4ModalData({ ...kala4ModalData, kandung_kemih: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Pendarahan</Label>
                  <Input value={kala4ModalData.pendarahan} onChange={(e) => setKala4ModalData({ ...kala4ModalData, pendarahan: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsKala4ModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveKala4Data}>Simpan Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
