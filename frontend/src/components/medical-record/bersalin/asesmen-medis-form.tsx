import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { BersalinRecord } from "@/lib/api";

interface AsesmenMedisProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function AsesmenMedisBersalin({ formData, onChange, isReadOnly }: AsesmenMedisProps) {
  const riwayat = formData.riwayat_medis || {};
  const rencana = formData.rencana_asuhan || {};
  const obstetrik = riwayat.riwayat_obstetrik || [];

  const updateRiwayat = (key: string, value: any) => {
    onChange("riwayat_medis", { ...riwayat, [key]: value });
  };

  const updateRencana = (key: string, value: any) => {
    onChange("rencana_asuhan", { ...rencana, [key]: value });
  };

  const addObstetrik = () => {
    const newObstetrik = [...obstetrik, {
      kehamilan: "", cara_persalinan: "", bb_lahir: "", umur_bayi: "",
      jenis_kelamin: "", keadaan_anak: "", tempat_penolong: ""
    }];
    updateRiwayat("riwayat_obstetrik", newObstetrik);
  };

  const removeObstetrik = (index: number) => {
    const newObstetrik = [...obstetrik];
    newObstetrik.splice(index, 1);
    updateRiwayat("riwayat_obstetrik", newObstetrik);
  };

  const updateObstetrikItem = (index: number, field: string, value: any) => {
    const newObstetrik = [...obstetrik];
    newObstetrik[index] = { ...newObstetrik[index], [field]: value };
    updateRiwayat("riwayat_obstetrik", newObstetrik);
  };

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9):not(.h-8)]:h-10 [&_[role=combobox]:not(.h-9):not(.h-8)]:h-10">

      {/* 1. Riwayat Kesehatan Pasien */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Riwayat Kesehatan Pasien (Asesmen Medis)
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Pemeriksaan Antenatal di Klinik Muhammadiyah</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.antenatal_klinik || "Tidak"} onValueChange={(v) => updateRiwayat("antenatal_klinik", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                    <SelectItem value="Ya">Ya</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.antenatal_klinik === "Ya" && (
                  <div className="relative w-32">
                    <Input type="number" value={riwayat.antenatal_klinik_kali || ""} onChange={(e) => updateRiwayat("antenatal_klinik_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pemeriksaan Antenatal di tempat lain</Label>
              <div className="relative w-full md:w-full">
                <Input type="number" value={riwayat.antenatal_lain_kali || ""} onChange={(e) => updateRiwayat("antenatal_lain_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
            <div className="space-y-2">
              <Label>Riwayat Alergi</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.alergi || "Tidak"} onValueChange={(v) => updateRiwayat("alergi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
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

            <div className="space-y-2">
              <Label>Status Obstetri (G P A)</Label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">G</span>
                  <Input type="number" value={riwayat.status_g || ""} onChange={(e) => updateRiwayat("status_g", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">P</span>
                  <Input type="number" value={riwayat.status_p || ""} onChange={(e) => updateRiwayat("status_p", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">A</span>
                  <Input type="number" value={riwayat.status_a || ""} onChange={(e) => updateRiwayat("status_a", e.target.value)} disabled={isReadOnly} className="pl-8 bg-background" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Riwayat Haid</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Siklus</Label>
                  <div className="relative">
                    <Input value={riwayat.haid_siklus || ""} onChange={(e) => updateRiwayat("haid_siklus", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">hari</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Lama</Label>
                  <div className="relative">
                    <Input value={riwayat.haid_lama || ""} onChange={(e) => updateRiwayat("haid_lama", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">hari</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">HPHT</Label>
                  <Input type="date" value={riwayat.haid_hpht || ""} onChange={(e) => updateRiwayat("haid_hpht", e.target.value)} disabled={isReadOnly} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">HPL</Label>
                  <Input type="date" value={riwayat.haid_hpl || ""} onChange={(e) => updateRiwayat("haid_hpl", e.target.value)} disabled={isReadOnly} className="bg-background" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Perkawinan</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Pernikahan ke</Label>
                  <div className="relative">
                    <Input type="number" value={riwayat.perkawinan_kali || ""} onChange={(e) => updateRiwayat("perkawinan_kali", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kali</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Dengan suami skr</Label>
                  <div className="relative">
                    <Input type="number" value={riwayat.perkawinan_tahun || ""} onChange={(e) => updateRiwayat("perkawinan_tahun", e.target.value)} disabled={isReadOnly} className="pr-14 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">tahun</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Riwayat Obstetrik (Kehamilan sebelumnya)</Label>
              {!isReadOnly && (
                <Button type="button" variant="secondary" size="sm" onClick={addObstetrik} className="h-8">
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
                      <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                      <td className="p-2"><Input className="h-9" value={item.kehamilan} onChange={e => updateObstetrikItem(i, "kehamilan", e.target.value)} disabled={isReadOnly} placeholder="Mabuk..." /></td>
                      <td className="p-2"><Input className="h-9" value={item.cara_persalinan} onChange={e => updateObstetrikItem(i, "cara_persalinan", e.target.value)} disabled={isReadOnly} placeholder="Normal..." /></td>
                      <td className="p-2">
                        <div className="relative">
                          <Input className="h-9 pr-8" value={item.bb_lahir} onChange={e => updateObstetrikItem(i, "bb_lahir", e.target.value)} disabled={isReadOnly} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">gr</span>
                        </div>
                      </td>
                      <td className="p-2"><Input className="h-9" value={item.umur_bayi} onChange={e => updateObstetrikItem(i, "umur_bayi", e.target.value)} disabled={isReadOnly} /></td>
                      <td className="p-2">
                        <Select value={item.jenis_kelamin || ""} onValueChange={v => updateObstetrikItem(i, "jenis_kelamin", v)} disabled={isReadOnly}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                          <SelectContent><SelectItem value="L">L</SelectItem><SelectItem value="P">P</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input className="h-9" value={item.keadaan_anak} onChange={e => updateObstetrikItem(i, "keadaan_anak", e.target.value)} disabled={isReadOnly} placeholder="Sehat..." /></td>
                      <td className="p-2"><Input className="h-9" value={item.tempat_penolong} onChange={e => updateObstetrikItem(i, "tempat_penolong", e.target.value)} disabled={isReadOnly} placeholder="Bidan..." /></td>
                      {!isReadOnly && (
                        <td className="p-2 text-center">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeObstetrik(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Penyakit dahulu / Operasi / KB</Label>
              <Textarea value={riwayat.penyakit_dahulu || ""} onChange={(e) => updateRiwayat("penyakit_dahulu", e.target.value)} disabled={isReadOnly} rows={2} />
            </div>

            <div className="space-y-4">
              <Label>Riwayat Kehamilan Sekarang (Penyulit/Penyakit)</Label>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
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
                <Label>Kebiasaan Ibu Sewaktu Hamil</Label>
                <div className="grid grid-cols-2 gap-3 pt-1">
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
              <div className="space-y-2">
                <Label>Penambahan BB selama hamil</Label>
                <div className="relative w-full sm:w-full">
                  <Input type="number" value={riwayat.penambahan_bb || ""} onChange={(e) => updateRiwayat("penambahan_bb", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Analisa & Rencana Asuhan */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Analisa dan Rencana Asuhan
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

          {/* KOLOM KEBIDANAN */}
          <div className="p-4 sm:p-6 space-y-6">
            <div className="font-semibold text-primary uppercase tracking-wider text-sm border-b pb-2 mb-4">ASUHAN KEBIDANAN</div>

            <div className="space-y-2">
              <Label>Masalah Kebidanan</Label>
              <Textarea value={rencana.masalah_kebidanan || ""} onChange={(e) => updateRencana("masalah_kebidanan", e.target.value)} disabled={isReadOnly} rows={3} placeholder="1.&#10;2.&#10;3." className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label>Diagnosa Kebidanan</Label>
              <Textarea value={rencana.diagnosa_kebidanan || ""} onChange={(e) => updateRencana("diagnosa_kebidanan", e.target.value)} disabled={isReadOnly} rows={3} placeholder="1.&#10;2.&#10;3." className="resize-none" />
            </div>

            <div className="space-y-3 pt-4">
              <Label>Rencana Asuhan Kebidanan</Label>
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
              <Label>Hasil yang diharapkan / Outcome (Prognosa)</Label>
              <Textarea value={rencana.prognosa_kebidanan || ""} onChange={(e) => updateRencana("prognosa_kebidanan", e.target.value)} disabled={isReadOnly} rows={3} className="resize-none" />
            </div>
          </div>

          {/* KOLOM MEDIS */}
          <div className="p-4 sm:p-6 space-y-6">
            <div className="font-semibold text-primary uppercase tracking-wider text-sm border-b pb-2 mb-4">ASUHAN MEDIS</div>

            <div className="space-y-4">
              <Label>Hasil Pemeriksaan Penunjang</Label>
              <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 items-center">
                <span className="text-sm font-medium text-muted-foreground">Laboratorium</span>
                <Input value={rencana.lab || ""} onChange={e => updateRencana("lab", e.target.value)} disabled={isReadOnly} className="bg-background" />
                <span className="text-sm font-medium text-muted-foreground">Rontgen</span>
                <Input value={rencana.rontgen || ""} onChange={e => updateRencana("rontgen", e.target.value)} disabled={isReadOnly} className="bg-background" />
                <span className="text-sm font-medium text-muted-foreground">ECG</span>
                <Input value={rencana.ecg || ""} onChange={e => updateRencana("ecg", e.target.value)} disabled={isReadOnly} className="bg-background" />
                <span className="text-sm font-medium text-muted-foreground">Lainnya</span>
                <Input value={rencana.penunjang_lain || ""} onChange={e => updateRencana("penunjang_lain", e.target.value)} disabled={isReadOnly} className="bg-background" />
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Label>Diagnosa Kerja</Label>
              <Textarea value={rencana.diagnosa_kerja || ""} onChange={(e) => updateRencana("diagnosa_kerja", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label>Diagnosa Banding</Label>
              <Textarea value={rencana.diagnosa_banding || ""} onChange={(e) => updateRencana("diagnosa_banding", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label>Terapi</Label>
              <Textarea value={rencana.terapi || ""} onChange={(e) => updateRencana("terapi", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label>Tindakan</Label>
              <Textarea value={rencana.tindakan || ""} onChange={(e) => updateRencana("tindakan", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label>Rencana Monitoring / Follow Up</Label>
              <Textarea value={rencana.monitoring || ""} onChange={(e) => updateRencana("monitoring", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label>Efek Samping / Komplikasi yang Mungkin Terjadi</Label>
              <Textarea value={rencana.komplikasi || ""} onChange={(e) => updateRencana("komplikasi", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2 pt-4">
              <Label>Hasil yang diharapkan / Outcome (Prognosa)</Label>
              <Textarea value={rencana.prognosa_medis || ""} onChange={(e) => updateRencana("prognosa_medis", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label>Kriteria Pulang</Label>
              <Textarea value={rencana.kriteria_pulang || ""} onChange={(e) => updateRencana("kriteria_pulang", e.target.value)} disabled={isReadOnly} rows={2} className="resize-none" />
            </div>
          </div>
        </div>

        {/* Discharge Planning */}
        <div className="border-t border-border/50 bg-primary/5 p-4 sm:p-6 rounded-b-lg">
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
    </div>
  );
}
