import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import type { BersalinRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AsesmenMedisProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function AsesmenMedisBersalin({ formData, onChange, isReadOnly }: AsesmenMedisProps) {
  const riwayat = formData.riwayat_medis || {};
  const rencana = formData.rencana_asuhan || {};
  const obstetrik = riwayat.riwayat_obstetrik || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [tempObstetrik, setTempObstetrik] = useState({
    kehamilan: "", cara_persalinan: "", bb_lahir: "", umur_bayi: "",
    jenis_kelamin: "", keadaan_anak: "", tempat_penolong: ""
  });
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const updateRiwayat = (key: string, value: any) => {
    onChange("riwayat_medis", { ...riwayat, [key]: value });
  };

  const updateRencana = (key: string, value: any) => {
    onChange("rencana_asuhan", { ...rencana, [key]: value });
  };

  const openAddModal = () => {
    setModalMode("add");
    setTempObstetrik({
      kehamilan: "", cara_persalinan: "", bb_lahir: "", umur_bayi: "",
      jenis_kelamin: "", keadaan_anak: "", tempat_penolong: ""
    });
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const openEditModal = (index: number) => {
    setModalMode("edit");
    setTempObstetrik({ ...obstetrik[index] });
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const saveObstetrik = () => {
    let newObstetrik = [...obstetrik];
    if (modalMode === "add") {
      newObstetrik.push(tempObstetrik);
    } else if (modalMode === "edit" && editingIndex !== null) {
      newObstetrik[editingIndex] = tempObstetrik;
    }
    updateRiwayat("riwayat_obstetrik", newObstetrik);
    setIsModalOpen(false);
  };

  const confirmDelete = (index: number) => {
    setDeleteIndex(index);
  };

  const executeDelete = () => {
    if (deleteIndex !== null) {
      const newObstetrik = [...obstetrik];
      newObstetrik.splice(deleteIndex, 1);
      updateRiwayat("riwayat_obstetrik", newObstetrik);
      setDeleteIndex(null);
    }
  };

  const updateTemp = (field: string, value: string) => {
    setTempObstetrik(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9):not(.h-8)]:h-10 [&_[role=combobox]:not(.h-9):not(.h-8)]:h-10">

      {/* 1. Riwayat Kesehatan Pasien */}
      <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b border-border/50 bg-muted/40 px-4 py-3 flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Riwayat Kesehatan Pasien (Asesmen Medis)
          </div>
        </div>
        <div className="p-3 sm:p-4 space-y-8 bg-slate-50/40 dark:bg-transparent">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1">
              <Label className="text-xs">Pemeriksaan Antenatal di Klinik Muhammadiyah</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.antenatal_klinik || "Tidak"} onValueChange={(v) => updateRiwayat("antenatal_klinik", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                    <SelectItem value="Ya">Ya</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.antenatal_klinik === "Ya" && (
                  <div className="relative w-32">
                    <Input type="number" value={riwayat.antenatal_klinik_kali ?? ""} onChange={(e) => updateRiwayat("antenatal_klinik_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pemeriksaan Antenatal di tempat lain</Label>
              <div className="relative w-full md:w-64">
                <Input type="number" value={riwayat.antenatal_lain_kali ?? ""} onChange={(e) => updateRiwayat("antenatal_lain_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 border-t pt-6">
            <div className="space-y-1">
              <Label className="text-xs">Riwayat Alergi</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.alergi || "Tidak"} onValueChange={(v) => updateRiwayat("alergi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                    <SelectItem value="Ya">Ya</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.alergi === "Ya" && (
                  <Input value={riwayat.alergi_ket || ""} onChange={(e) => updateRiwayat("alergi_ket", e.target.value)} disabled={isReadOnly} placeholder="Keterangan alergi..." className="flex-1" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status Obstetri (G P A)</Label>
              <div className="flex items-center gap-4 max-w-xl">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">G</span>
                  <Input type="number" value={riwayat.status_g ?? ""} onChange={(e) => updateRiwayat("status_g", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">P</span>
                  <Input type="number" value={riwayat.status_p ?? ""} onChange={(e) => updateRiwayat("status_p", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">A</span>
                  <Input type="number" value={riwayat.status_a ?? ""} onChange={(e) => updateRiwayat("status_a", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Riwayat Haid</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Siklus</Label>
                <div className="relative">
                  <Input value={riwayat.haid_siklus || ""} onChange={(e) => updateRiwayat("haid_siklus", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">hari</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lama</Label>
                <div className="relative">
                  <Input value={riwayat.haid_lama || ""} onChange={(e) => updateRiwayat("haid_lama", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">hari</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HPHT</Label>
                <Input type="date" value={riwayat.haid_hpht || ""} onChange={(e) => updateRiwayat("haid_hpht", e.target.value)} disabled={isReadOnly} className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HPL</Label>
                <Input type="date" value={riwayat.haid_hpl || ""} onChange={(e) => updateRiwayat("haid_hpl", e.target.value)} disabled={isReadOnly} className="bg-background" />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Perkawinan</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 max-w-2xl gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Pernikahan ke</Label>
                <div className="relative">
                  <Input type="number" value={riwayat.perkawinan_kali ?? ""} onChange={(e) => updateRiwayat("perkawinan_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dengan suami skr</Label>
                <div className="relative">
                  <Input type="number" value={riwayat.perkawinan_tahun ?? ""} onChange={(e) => updateRiwayat("perkawinan_tahun", e.target.value)} disabled={isReadOnly} className="pr-14 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">tahun</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Riwayat Obstetrik (Kehamilan sebelumnya)</Label>
              {!isReadOnly && (
                <Button type="button" variant="secondary" size="sm" onClick={openAddModal} className="h-8">
                  <Plus className="h-3 w-3 mr-1" /> Tambah
                </Button>
              )}
            </div>

            <div className="rounded-md border bg-background overflow-hidden">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-center w-12 font-medium">No</th>
                    <th className="p-3 text-left font-medium">Keadaan Kehamilan</th>
                    <th className="p-3 text-left font-medium">Cara Persalinan</th>
                    <th className="p-3 text-left font-medium w-24">BB Lahir</th>
                    <th className="p-3 text-left font-medium w-24">Umur Bayi</th>
                    <th className="p-3 text-left font-medium w-28">J. Kelamin</th>
                    <th className="p-3 text-left font-medium">Keadaan Anak</th>
                    <th className="p-3 text-left font-medium">Tempat/Penolong</th>
                    {!isReadOnly && <th className="p-3 w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {obstetrik.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-muted-foreground">Belum ada data riwayat obstetrik</td>
                    </tr>
                  )}
                  {obstetrik.map((item: any, i: number) => (
                    <tr key={i} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-center text-muted-foreground">{i + 1}</td>
                      <td className="p-3">{item.kehamilan}</td>
                      <td className="p-3">{item.cara_persalinan}</td>
                      <td className="p-3">{item.bb_lahir ? `${item.bb_lahir} gr` : ''}</td>
                      <td className="p-3">{item.umur_bayi}</td>
                      <td className="p-3">{item.jenis_kelamin}</td>
                      <td className="p-3">{item.keadaan_anak}</td>
                      <td className="p-3">{item.tempat_penolong}</td>
                      {!isReadOnly && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => openEditModal(i)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => confirmDelete(i)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6 border-t pt-6">
            <div className="space-y-2">
              <Label className="text-xs">Penyakit dahulu / Operasi / KB</Label>
              <Textarea value={riwayat.penyakit_dahulu || ""} onChange={(e) => updateRiwayat("penyakit_dahulu", e.target.value)} disabled={isReadOnly} rows={2} />
            </div>

            <div className="space-y-4">
              <Label className="text-xs">Riwayat Kehamilan Sekarang (Penyulit/Penyakit)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
                {['Anemia', 'Hipertensi', 'Diabetes', 'Tuberculosis', 'Penyakit jantung', 'Asma', 'Pendarahan', 'Infeksi', 'Preeklamsia', 'HIV-AID', 'Lainnya'].map(item => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      checked={(riwayat.kehamilan_sekarang || []).includes(item)}
                      onCheckedChange={(c) => {
                        const current = riwayat.kehamilan_sekarang || [];
                        updateRiwayat("kehamilan_sekarang", c ? [...current, item] : current.filter((x: string) => x !== item));
                      }} disabled={isReadOnly}
                    />
                    <span className="font-normal text-sm cursor-pointer select-none flex-1" onClick={() => {
                      if (isReadOnly) return;
                      const current = riwayat.kehamilan_sekarang || [];
                      const isChecked = current.includes(item);
                      updateRiwayat("kehamilan_sekarang", !isChecked ? [...current, item] : current.filter((x: string) => x !== item));
                    }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-xs">Kebiasaan Ibu Sewaktu Hamil</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {['Jamu', 'Merokok', 'Obat', 'Lainnya'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        checked={(riwayat.kebiasaan_ibu || []).includes(item)}
                        onCheckedChange={(c) => {
                          const current = riwayat.kebiasaan_ibu || [];
                          updateRiwayat("kebiasaan_ibu", c ? [...current, item] : current.filter((x: string) => x !== item));
                        }} disabled={isReadOnly}
                      />
                      <span className="font-normal text-sm cursor-pointer select-none flex-1" onClick={() => {
                        if (isReadOnly) return;
                        const current = riwayat.kebiasaan_ibu || [];
                        const isChecked = current.includes(item);
                        updateRiwayat("kebiasaan_ibu", !isChecked ? [...current, item] : current.filter((x: string) => x !== item));
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Penambahan BB selama hamil</Label>
                <div className="relative max-w-xs">
                  <Input type="number" value={riwayat.penambahan_bb ?? ""} onChange={(e) => updateRiwayat("penambahan_bb", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Analisa & Rencana Asuhan */}
      <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b border-border/50 bg-muted/40 px-4 py-3 flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Analisa dan Rencana Asuhan
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border bg-slate-50/40 dark:bg-transparent">

          {/* KOLOM KEBIDANAN */}
          <div className="p-3 sm:p-4 space-y-6">
            <div className="font-semibold text-primary uppercase tracking-wider text-sm border-b pb-2 mb-4">ASUHAN KEBIDANAN</div>

            <div className="space-y-1">
              <Label className="text-xs">Masalah Kebidanan</Label>
              <div className="space-y-2">
                <Input 
                  placeholder="Ketik masalah lalu tekan Enter..." 
                  disabled={isReadOnly}
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        const current = Array.isArray(rencana.masalah_kebidanan) ? rencana.masalah_kebidanan : (typeof rencana.masalah_kebidanan === 'string' && rencana.masalah_kebidanan ? rencana.masalah_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : []);
                        updateRencana("masalah_kebidanan", [...current, val]);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                {(Array.isArray(rencana.masalah_kebidanan) ? rencana.masalah_kebidanan : (typeof rencana.masalah_kebidanan === 'string' && rencana.masalah_kebidanan ? rencana.masalah_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : [])).length > 0 && (
                  <ul className="space-y-1.5 mt-2">
                    {(Array.isArray(rencana.masalah_kebidanan) ? rencana.masalah_kebidanan : (typeof rencana.masalah_kebidanan === 'string' && rencana.masalah_kebidanan ? rencana.masalah_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : [])).map((item: string, idx: number) => (
                      <li key={idx} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-muted/50 border">
                        <span>{idx + 1}. {item}</span>
                        {!isReadOnly && (
                          <button type="button" onClick={() => {
                            const current = Array.isArray(rencana.masalah_kebidanan) ? rencana.masalah_kebidanan : (typeof rencana.masalah_kebidanan === 'string' && rencana.masalah_kebidanan ? rencana.masalah_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : []);
                            updateRencana("masalah_kebidanan", current.filter((_:any, i:number) => i !== idx));
                          }} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Diagnosa Kebidanan</Label>
              <div className="space-y-2">
                <Input 
                  placeholder="Ketik diagnosa lalu tekan Enter..." 
                  disabled={isReadOnly}
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        const current = Array.isArray(rencana.diagnosa_kebidanan) ? rencana.diagnosa_kebidanan : (typeof rencana.diagnosa_kebidanan === 'string' && rencana.diagnosa_kebidanan ? rencana.diagnosa_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : []);
                        updateRencana("diagnosa_kebidanan", [...current, val]);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                {(Array.isArray(rencana.diagnosa_kebidanan) ? rencana.diagnosa_kebidanan : (typeof rencana.diagnosa_kebidanan === 'string' && rencana.diagnosa_kebidanan ? rencana.diagnosa_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : [])).length > 0 && (
                  <ul className="space-y-1.5 mt-2">
                    {(Array.isArray(rencana.diagnosa_kebidanan) ? rencana.diagnosa_kebidanan : (typeof rencana.diagnosa_kebidanan === 'string' && rencana.diagnosa_kebidanan ? rencana.diagnosa_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : [])).map((item: string, idx: number) => (
                      <li key={idx} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-muted/50 border">
                        <span>{idx + 1}. {item}</span>
                        {!isReadOnly && (
                          <button type="button" onClick={() => {
                            const current = Array.isArray(rencana.diagnosa_kebidanan) ? rencana.diagnosa_kebidanan : (typeof rencana.diagnosa_kebidanan === 'string' && rencana.diagnosa_kebidanan ? rencana.diagnosa_kebidanan.split('\n').map((s:string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean) : []);
                            updateRencana("diagnosa_kebidanan", current.filter((_:any, i:number) => i !== idx));
                          }} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Label className="text-xs">Rencana Asuhan Kebidanan</Label>
              <div className="rounded-md border bg-background overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2 text-center w-40 font-medium">Tgl/Jam</th>
                      <th className="p-2 text-left font-medium">Rencana Kebidanan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="bg-card">
                      <td className="p-1.5 border-r border-border"><Input type="datetime-local" lang="en-GB" className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_tgl_1 || ""} onChange={e => updateRencana("asuhan_tgl_1", e.target.value)} disabled={isReadOnly} /></td>
                      <td className="p-1.5"><Input className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_rencana_1 || ""} onChange={e => updateRencana("asuhan_rencana_1", e.target.value)} disabled={isReadOnly} placeholder="..." /></td>
                    </tr>
                    <tr className="bg-card">
                      <td className="p-1.5 border-r border-border"><Input type="datetime-local" lang="en-GB" className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_tgl_2 || ""} onChange={e => updateRencana("asuhan_tgl_2", e.target.value)} disabled={isReadOnly} /></td>
                      <td className="p-1.5"><Input className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_rencana_2 || ""} onChange={e => updateRencana("asuhan_rencana_2", e.target.value)} disabled={isReadOnly} placeholder="..." /></td>
                    </tr>
                    <tr className="bg-card">
                      <td className="p-1.5 border-r border-border"><Input type="datetime-local" lang="en-GB" className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_tgl_3 || ""} onChange={e => updateRencana("asuhan_tgl_3", e.target.value)} disabled={isReadOnly} /></td>
                      <td className="p-1.5"><Input className="h-9 border-0 bg-transparent focus-visible:ring-0" value={rencana.asuhan_rencana_3 || ""} onChange={e => updateRencana("asuhan_rencana_3", e.target.value)} disabled={isReadOnly} placeholder="..." /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Hasil yang diharapkan / Outcome (Prognosa)</Label>
              <Textarea value={rencana.prognosa_kebidanan || ""} onChange={(e) => updateRencana("prognosa_kebidanan", e.target.value)} disabled={isReadOnly} rows={3} className="resize-none" />
            </div>
          </div>

          {/* KOLOM MEDIS */}
          <div className="p-3 sm:p-4 space-y-6">
            <div className="font-semibold text-primary uppercase tracking-wider text-sm border-b pb-2 mb-4">ASUHAN MEDIS</div>

            <div className="space-y-4">
              <Label className="text-xs">Hasil Pemeriksaan Penunjang</Label>
              <div className="rounded-md border bg-background overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {/* LAB ROW */}
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        rencana.lab_performed && "bg-purple-50/50 dark:bg-purple-950/10",
                        rencana.lab_performed && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20"
                      )}
                      onClick={() => rencana.lab_performed && setExpandedRows(prev => ({ ...prev, lab: !prev.lab }))}
                    >
                      <td className="p-2 align-middle text-center w-12" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={rencana.lab_performed || false}
                          onCheckedChange={(c) => {
                            if (c) {
                              updateRencana("lab_performed", true);
                              setExpandedRows(prev => ({ ...prev, lab: true }));
                            } else {
                              onChange("rencana_asuhan", { ...rencana, lab_performed: false, lab_result: "", lab_interpretation: "" });
                              setExpandedRows(prev => ({ ...prev, lab: false }));
                            }
                          }}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="p-3 align-middle w-40">
                        <span className="font-medium">Laboratorium</span>
                      </td>
                      <td className="p-3 align-middle">
                        {rencana.lab_performed ? (
                          <div className="text-sm">
                            {rencana.lab_result || rencana.lab_interpretation ? (
                              <div className="space-y-0.5">
                                {rencana.lab_result && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Hasil:</span> {rencana.lab_result}</p>
                                )}
                                {rencana.lab_interpretation && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Interpretasi:</span> {rencana.lab_interpretation}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground/50 italic">Klik untuk mengisi detail</span>}
                          </div>
                        ) : <span className="text-sm text-muted-foreground/50 italic">Belum dilakukan</span>}
                      </td>
                    </tr>
                    {expandedRows.lab && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Hasil Lab</Label>
                              <Input value={rencana.lab_result || rencana.lab || ""} onChange={e => updateRencana("lab_result", e.target.value)} disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Interpretasi</Label>
                              <Input value={rencana.lab_interpretation || ""} onChange={e => updateRencana("lab_interpretation", e.target.value)} disabled={isReadOnly} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* RONTGEN ROW */}
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        rencana.rontgen_performed && "bg-purple-50/50 dark:bg-purple-950/10",
                        rencana.rontgen_performed && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20"
                      )}
                      onClick={() => rencana.rontgen_performed && setExpandedRows(prev => ({ ...prev, rontgen: !prev.rontgen }))}
                    >
                      <td className="p-2 align-middle text-center w-12" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={rencana.rontgen_performed || false}
                          onCheckedChange={(c) => {
                            if (c) {
                              updateRencana("rontgen_performed", true);
                              setExpandedRows(prev => ({ ...prev, rontgen: true }));
                            } else {
                              onChange("rencana_asuhan", { ...rencana, rontgen_performed: false, rontgen_result: "", rontgen_interpretation: "" });
                              setExpandedRows(prev => ({ ...prev, rontgen: false }));
                            }
                          }}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="p-3 align-middle w-40">
                        <span className="font-medium">Rontgen</span>
                      </td>
                      <td className="p-3 align-middle">
                        {rencana.rontgen_performed ? (
                          <div className="text-sm">
                            {rencana.rontgen_result || rencana.rontgen_interpretation ? (
                              <div className="space-y-0.5">
                                {rencana.rontgen_result && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Hasil:</span> {rencana.rontgen_result}</p>
                                )}
                                {rencana.rontgen_interpretation && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Interpretasi:</span> {rencana.rontgen_interpretation}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground/50 italic">Klik untuk mengisi detail</span>}
                          </div>
                        ) : <span className="text-sm text-muted-foreground/50 italic">Belum dilakukan</span>}
                      </td>
                    </tr>
                    {expandedRows.rontgen && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Hasil Rontgen</Label>
                              <Input value={rencana.rontgen_result || rencana.rontgen || ""} onChange={e => updateRencana("rontgen_result", e.target.value)} disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Interpretasi</Label>
                              <Input value={rencana.rontgen_interpretation || ""} onChange={e => updateRencana("rontgen_interpretation", e.target.value)} disabled={isReadOnly} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ECG ROW */}
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        rencana.ecg_performed && "bg-purple-50/50 dark:bg-purple-950/10",
                        rencana.ecg_performed && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20"
                      )}
                      onClick={() => rencana.ecg_performed && setExpandedRows(prev => ({ ...prev, ecg: !prev.ecg }))}
                    >
                      <td className="p-2 align-middle text-center w-12" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={rencana.ecg_performed || false}
                          onCheckedChange={(c) => {
                            if (c) {
                              updateRencana("ecg_performed", true);
                              setExpandedRows(prev => ({ ...prev, ecg: true }));
                            } else {
                              onChange("rencana_asuhan", { ...rencana, ecg_performed: false, ecg_result: "", ecg_interpretation: "" });
                              setExpandedRows(prev => ({ ...prev, ecg: false }));
                            }
                          }}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="p-3 align-middle w-40">
                        <span className="font-medium">ECG</span>
                      </td>
                      <td className="p-3 align-middle">
                        {rencana.ecg_performed ? (
                          <div className="text-sm">
                            {rencana.ecg_result || rencana.ecg_interpretation ? (
                              <div className="space-y-0.5">
                                {rencana.ecg_result && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Hasil:</span> {rencana.ecg_result}</p>
                                )}
                                {rencana.ecg_interpretation && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Interpretasi:</span> {rencana.ecg_interpretation}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground/50 italic">Klik untuk mengisi detail</span>}
                          </div>
                        ) : <span className="text-sm text-muted-foreground/50 italic">Belum dilakukan</span>}
                      </td>
                    </tr>
                    {expandedRows.ecg && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Hasil ECG</Label>
                              <Input value={rencana.ecg_result || rencana.ecg || ""} onChange={e => updateRencana("ecg_result", e.target.value)} disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Interpretasi</Label>
                              <Input value={rencana.ecg_interpretation || ""} onChange={e => updateRencana("ecg_interpretation", e.target.value)} disabled={isReadOnly} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* LAINNYA ROW */}
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        rencana.lainnya_performed && "bg-purple-50/50 dark:bg-purple-950/10",
                        rencana.lainnya_performed && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20"
                      )}
                      onClick={() => rencana.lainnya_performed && setExpandedRows(prev => ({ ...prev, lainnya: !prev.lainnya }))}
                    >
                      <td className="p-2 align-middle text-center w-12" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={rencana.lainnya_performed || false}
                          onCheckedChange={(c) => {
                            if (c) {
                              updateRencana("lainnya_performed", true);
                              setExpandedRows(prev => ({ ...prev, lainnya: true }));
                            } else {
                              onChange("rencana_asuhan", { ...rencana, lainnya_performed: false, lainnya_result: "", lainnya_interpretation: "" });
                              setExpandedRows(prev => ({ ...prev, lainnya: false }));
                            }
                          }}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="p-3 align-middle w-40">
                        <span className="font-medium">Lainnya</span>
                      </td>
                      <td className="p-3 align-middle">
                        {rencana.lainnya_performed ? (
                          <div className="text-sm">
                            {rencana.lainnya_result || rencana.lainnya_interpretation ? (
                              <div className="space-y-0.5">
                                {rencana.lainnya_result && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Hasil:</span> {rencana.lainnya_result}</p>
                                )}
                                {rencana.lainnya_interpretation && (
                                  <p className="text-muted-foreground line-clamp-1"><span className="font-medium">Interpretasi:</span> {rencana.lainnya_interpretation}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground/50 italic">Klik untuk mengisi detail</span>}
                          </div>
                        ) : <span className="text-sm text-muted-foreground/50 italic">Belum dilakukan</span>}
                      </td>
                    </tr>
                    {expandedRows.lainnya && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Hasil Lainnya</Label>
                              <Input value={rencana.lainnya_result || rencana.penunjang_lain || ""} onChange={e => updateRencana("lainnya_result", e.target.value)} disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Interpretasi</Label>
                              <Input value={rencana.lainnya_interpretation || ""} onChange={e => updateRencana("lainnya_interpretation", e.target.value)} disabled={isReadOnly} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Diagnosa Kerja</Label>
              <Textarea value={rencana.diagnosa_kerja || ""} onChange={(e) => updateRencana("diagnosa_kerja", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Diagnosa Banding</Label>
              <Textarea value={rencana.diagnosa_banding || ""} onChange={(e) => updateRencana("diagnosa_banding", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Terapi</Label>
              <Textarea value={rencana.terapi || ""} onChange={(e) => updateRencana("terapi", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tindakan</Label>
              <Textarea value={rencana.tindakan || ""} onChange={(e) => updateRencana("tindakan", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Rencana Monitoring / Follow Up</Label>
              <Textarea value={rencana.monitoring || ""} onChange={(e) => updateRencana("monitoring", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Efek Samping / Komplikasi yang Mungkin Terjadi</Label>
              <Textarea value={rencana.komplikasi || ""} onChange={(e) => updateRencana("komplikasi", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-xs">Hasil yang diharapkan / Outcome (Prognosa)</Label>
              <Textarea value={rencana.prognosa_medis || ""} onChange={(e) => updateRencana("prognosa_medis", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Kriteria Pulang</Label>
              <Textarea value={rencana.kriteria_pulang || ""} onChange={(e) => updateRencana("kriteria_pulang", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>
          </div>
        </div>

        {/* Discharge Planning */}
        <div className="border-t border-border/50 bg-primary/5 p-3 sm:p-4 rounded-b-lg">
          <Label className="text-base font-semibold block mb-6 text-primary">Perencanaan Pemulangan Pasien (P3) / Discharge Planning</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <Label className="font-normal">Umur &gt; 65 tahun</Label>
              <Select value={rencana.p3_umur || "Tidak"} onValueChange={(v) => updateRencana("p3_umur", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-28 bg-background"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                  <SelectItem value="Ya">Ya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <Label className="font-normal">Keterbatasan mobilitas</Label>
              <Select value={rencana.p3_mobilitas || "Tidak"} onValueChange={(v) => updateRencana("p3_mobilitas", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-28 bg-background"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                  <SelectItem value="Ya">Ya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <Label className="font-normal">Perawatan atau pengobatan lanjutan</Label>
              <Select value={rencana.p3_perawatan || "Tidak"} onValueChange={(v) => updateRencana("p3_perawatan", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-28 bg-background"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                  <SelectItem value="Ya">Ya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <Label className="font-normal">Bantuan untuk aktifitas sehari-hari</Label>
              <Select value={rencana.p3_bantuan || "Tidak"} onValueChange={(v) => updateRencana("p3_bantuan", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-28 bg-background"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                  <SelectItem value="Ya">Ya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-6 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">i</span>
            Bila salah satu jawaban "ya" dari kriteria perencanaan pulang di atas, maka akan dilanjutkan dengan perencanaan pulang.
          </p>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{modalMode === "add" ? "Tambah Riwayat Obstetrik" : "Edit Riwayat Obstetrik"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Keadaan Kehamilan</Label>
              <Select value={tempObstetrik.kehamilan || ""} onValueChange={v => updateTemp("kehamilan", v)}>
                <SelectTrigger className="col-span-3 h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Mual/Muntah Berlebih">Mual/Muntah Berlebih</SelectItem>
                  <SelectItem value="Abortus">Abortus</SelectItem>
                  <SelectItem value="Prematur">Prematur</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Cara Persalinan</Label>
              <Select value={tempObstetrik.cara_persalinan || ""} onValueChange={v => updateTemp("cara_persalinan", v)}>
                <SelectTrigger className="col-span-3 h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Caesar (SC)">Caesar (SC)</SelectItem>
                  <SelectItem value="Vakum">Vakum</SelectItem>
                  <SelectItem value="Forceps">Forceps</SelectItem>
                  <SelectItem value="Kuret">Kuret</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">BB Lahir</Label>
              <div className="relative col-span-3">
                <Input type="number" className="h-9 pr-8 w-full" value={tempObstetrik.bb_lahir} onChange={e => updateTemp("bb_lahir", e.target.value)} placeholder="Dalam gram" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">gr</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Umur Bayi</Label>
              <Input className="col-span-3 h-9" value={tempObstetrik.umur_bayi} onChange={e => updateTemp("umur_bayi", e.target.value)} placeholder="Misal: 1 tahun" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Jenis Kelamin</Label>
              <Select value={tempObstetrik.jenis_kelamin || ""} onValueChange={v => updateTemp("jenis_kelamin", v)}>
                <SelectTrigger className="col-span-3 h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Keadaan Anak</Label>
              <Select value={tempObstetrik.keadaan_anak || ""} onValueChange={v => updateTemp("keadaan_anak", v)}>
                <SelectTrigger className="col-span-3 h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sehat">Sehat</SelectItem>
                  <SelectItem value="Sakit">Sakit</SelectItem>
                  <SelectItem value="Cacat">Cacat</SelectItem>
                  <SelectItem value="Meninggal">Meninggal</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">Tempat/Penolong</Label>
              <Select value={tempObstetrik.tempat_penolong || ""} onValueChange={v => updateTemp("tempat_penolong", v)}>
                <SelectTrigger className="col-span-3 h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rumah Sakit">Rumah Sakit</SelectItem>
                  <SelectItem value="Puskesmas">Puskesmas</SelectItem>
                  <SelectItem value="Klinik / Bidan">Klinik / Bidan</SelectItem>
                  <SelectItem value="Rumah">Rumah</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={saveObstetrik}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus Riwayat</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus data riwayat obstetrik ini? Data yang sudah dihapus tidak dapat dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteIndex(null)}>Batal</Button>
            <Button variant="destructive" onClick={executeDelete}>Hapus Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
