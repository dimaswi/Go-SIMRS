import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BersalinRecord } from "@/lib/api";
import { cn } from "@/lib/utils"; interface SkriningRisikoProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function SkriningRisikoBersalin({ formData, onChange, isReadOnly }: SkriningRisikoProps) {
  const riwayat = formData.riwayat_medis || {};
  const nyeri = formData.nyeri || {};

  const updateRiwayat = (key: string, value: any) => {
    onChange("riwayat_medis", { ...riwayat, [key]: value });
  };

  const updateNyeri = (key: string, value: any) => {
    onChange("nyeri", { ...nyeri, [key]: value });
  };

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9)]:h-10 [&_[role=combobox]:not(.h-9)]:h-10">

      {/* 1. Psiko-Sosio-Kultural-Spiritual & Ekonomi */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Psiko-Sosio-Kultural-Spiritual & Ekonomi
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Persepsi terhadap sakitnya</Label>
              <Select value={riwayat.persepsi_sakit || ""} onValueChange={(v) => updateRiwayat("persepsi_sakit", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cobaan Tuhan">Cobaan Tuhan</SelectItem>
                  <SelectItem value="Hukuman">Hukuman</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Emosional</Label>
              <Select value={riwayat.status_emosional || ""} onValueChange={(v) => updateRiwayat("status_emosional", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kooperatif">Kooperatif</SelectItem>
                  <SelectItem value="Cemas">Cemas</SelectItem>
                  <SelectItem value="Depresi">Depresi</SelectItem>
                  <SelectItem value="Ingin mengakhiri hidup">Ingin mengakhiri hidup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Curiga penganiayaan</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.penganiayaan || "Tidak"} onValueChange={(v) => updateRiwayat("penganiayaan", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                    <SelectItem value="Ya">Ya</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.penganiayaan === "Ya" && (
                  <Input value={riwayat.penganiayaan_ket || ""} onChange={(e) => updateRiwayat("penganiayaan_ket", e.target.value)} disabled={isReadOnly} placeholder="Jelaskan..." className="flex-1" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kebutuhan privasi</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.privasi || "Tidak ada"} onValueChange={(v) => updateRiwayat("privasi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak ada">Tidak ada</SelectItem>
                    <SelectItem value="Ada">Ada</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.privasi === "Ada" && (
                  <Input value={riwayat.privasi_ket || ""} onChange={(e) => updateRiwayat("privasi_ket", e.target.value)} disabled={isReadOnly} placeholder="Jelaskan..." className="flex-1" />
                )}
              </div>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Kepercayaan khusus / sosial budaya</Label>
              <div className="flex items-center gap-4">
                <Select value={riwayat.budaya || "Tidak ada"} onValueChange={(v) => updateRiwayat("budaya", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak ada">Tidak ada</SelectItem>
                    <SelectItem value="Ada">Ada</SelectItem>
                  </SelectContent>
                </Select>
                {riwayat.budaya === "Ada" && (
                  <Input value={riwayat.budaya_ket || ""} onChange={(e) => updateRiwayat("budaya_ket", e.target.value)} disabled={isReadOnly} placeholder="Jelaskan..." className="flex-1 max-w-sm" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t pt-6">
            <div className="space-y-2">
              <Label>Status Pernikahan</Label>
              <Select value={riwayat.pernikahan || ""} onValueChange={(v) => updateRiwayat("pernikahan", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belum menikah">Belum menikah</SelectItem>
                  <SelectItem value="Menikah">Menikah</SelectItem>
                  <SelectItem value="Duda/Janda">Duda/Janda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pendidikan</Label>
              <Select value={riwayat.pendidikan || ""} onValueChange={(v) => updateRiwayat("pendidikan", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SD">SD</SelectItem>
                  <SelectItem value="SLTP">SLTP</SelectItem>
                  <SelectItem value="SLTA">SLTA</SelectItem>
                  <SelectItem value="Diploma">Diploma</SelectItem>
                  <SelectItem value="S1">S1</SelectItem>
                  <SelectItem value="S2">S2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agama</Label>
              <Select value={riwayat.agama || ""} onValueChange={(v) => updateRiwayat("agama", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Islam">Islam</SelectItem>
                  <SelectItem value="Kristen">Kristen</SelectItem>
                  <SelectItem value="Katolik">Katolik</SelectItem>
                  <SelectItem value="Hindu">Hindu</SelectItem>
                  <SelectItem value="Buddha">Buddha</SelectItem>
                  <SelectItem value="Konghucu">Konghucu</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kebiasaan beribadah</Label>
              <Select value={riwayat.ibadah || ""} onValueChange={(v) => updateRiwayat("ibadah", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Selalu">Selalu</SelectItem>
                  <SelectItem value="Kadang-kadang">Kadang-kadang</SelectItem>
                  <SelectItem value="Tidak pernah">Tidak pernah</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ekonomi</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Tempat tinggal</Label>
                <Select value={riwayat.tempat_tinggal || ""} onValueChange={(v) => updateRiwayat("tempat_tinggal", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rumah">Rumah</SelectItem>
                    <SelectItem value="Panti asuhan">Panti asuhan</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keluarga</Label>
                <Select value={riwayat.keluarga || ""} onValueChange={(v) => updateRiwayat("keluarga", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tinggal serumah">Tinggal serumah</SelectItem>
                    <SelectItem value="Tinggal sendiri">Tinggal sendiri</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Biaya perawatan</Label>
                <Select value={riwayat.biaya_perawatan || ""} onValueChange={(v) => updateRiwayat("biaya_perawatan", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sendiri">Sendiri</SelectItem>
                    <SelectItem value="Asuransi">Asuransi</SelectItem>
                    <SelectItem value="BPJS">BPJS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Asesmen Nutrisional, Fungsional & Jatuh */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Nutrisional */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Asesmen Nutrisi (MUST)
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-2">
              <Label>LLA (Lingkar Lengan Atas)</Label>
              <div className="relative">
                <Input type="number" value={riwayat.lla || ""} onChange={(e) => updateRiwayat("lla", e.target.value)} disabled={isReadOnly} className="pr-10 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">cm</span>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-border/50">
              <Label className="text-primary font-bold">Total Skor MUST</Label>
              <div className="flex items-center gap-3">
                <Input type="number" value={formData.skor_must || ""} onChange={(e) => onChange("skor_must", parseInt(e.target.value) || 0)} disabled={isReadOnly} className="w-24 text-lg font-bold text-center bg-primary/5 border-primary/20" />
                <span className="text-xs text-muted-foreground">(≥ 2 rujuk ahli gizi)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fungsional */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Asesmen Fungsional (Barthel)
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-2">
              <Label>Kategori Ketergantungan</Label>
              <Select value={riwayat.kategori_barthel || ""} onValueChange={(v) => updateRiwayat("kategori_barthel", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mandiri">Mandiri (20)</SelectItem>
                  <SelectItem value="Ringan">Ringan (12-19)</SelectItem>
                  <SelectItem value="Sedang">Sedang (9-11)</SelectItem>
                  <SelectItem value="Berat">Berat (5-8)</SelectItem>
                  <SelectItem value="Total">Total (0-4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 pt-4 border-t border-border/50">
              <Label className="text-primary font-bold">Total Skor Barthel Indeks</Label>
              <Input type="number" value={formData.skor_barthel || ""} onChange={(e) => onChange("skor_barthel", parseInt(e.target.value) || 0)} disabled={isReadOnly} className="w-24 text-lg font-bold text-center bg-primary/5 border-primary/20" />
            </div>
          </div>
        </div>

        {/* Jatuh */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Risiko Jatuh (Morse)
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-2">
              <Label>Kategori Risiko</Label>
              <Select value={riwayat.kategori_morse || ""} onValueChange={(v) => updateRiwayat("kategori_morse", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rendah">Rendah (0-24)</SelectItem>
                  <SelectItem value="Sedang">Sedang (25-44)</SelectItem>
                  <SelectItem value="Tinggi">Tinggi (≥ 45)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 pt-4 border-t border-border/50">
              <Label className="text-primary font-bold">Total Skor Morse</Label>
              <Input type="number" value={formData.skor_morse || ""} onChange={(e) => onChange("skor_morse", parseInt(e.target.value) || 0)} disabled={isReadOnly} className="w-24 text-lg font-bold text-center bg-primary/5 border-primary/20" />
            </div>
          </div>
        </div>

      </div>

      {/* 3. Asesmen Nyeri */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Asesmen Nyeri
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-2 max-w-xs">
            <Label>Apakah ada nyeri?</Label>
            <Select value={nyeri.ada_nyeri || "Tidak"} onValueChange={(v) => updateNyeri("ada_nyeri", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ya">Ya</SelectItem>
                <SelectItem value="Tidak">Tidak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {nyeri.ada_nyeri === "Ya" && (
            <div className="space-y-8 border-t pt-6">

              {/* Parameter Nyeri */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Serangan</Label>
                  <Select value={nyeri.serangan || ""} onValueChange={(v) => updateNyeri("serangan", v)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Akut">Akut</SelectItem>
                      <SelectItem value="Kronis">Kronis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Waktu Nyeri (Time)</Label>
                  <Select value={nyeri.waktu || ""} onValueChange={(v) => updateNyeri("waktu", v)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Konstan">Konstan</SelectItem>
                      <SelectItem value="Intermiten">Intermiten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Provocating (Penyebab)</Label>
                  <Select value={nyeri.provocating || ""} onValueChange={(v) => updateNyeri("provocating", v)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Biologis">Biologis</SelectItem>
                      <SelectItem value="Impartus">Impartus</SelectItem>
                      <SelectItem value="Kimia">Kimia</SelectItem>
                      <SelectItem value="Fisik">Fisik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality (Karakteristik)</Label>
                  <Select value={nyeri.quality || ""} onValueChange={(v) => updateNyeri("quality", v)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diremas">Diremas</SelectItem>
                      <SelectItem value="Tajam">Tajam</SelectItem>
                      <SelectItem value="Terbakar">Terbakar</SelectItem>
                      <SelectItem value="Lemah">Lemah</SelectItem>
                      <SelectItem value="Berat">Berat</SelectItem>
                      <SelectItem value="Tertekan">Tertekan</SelectItem>
                      <SelectItem value="Teriris">Teriris</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Region (Lokasi penyebaran)</Label>
                  <Input value={nyeri.region || ""} onChange={(e) => updateNyeri("region", e.target.value)} disabled={isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Severate (Tingkat Nyeri)</Label>
                  <Select value={nyeri.severate || ""} onValueChange={(v) => updateNyeri("severate", v)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tidak nyeri (0)">Tidak nyeri (0)</SelectItem>
                      <SelectItem value="Nyeri ringan (1-3)">Nyeri ringan (1-3)</SelectItem>
                      <SelectItem value="Nyeri sedang (4-6)">Nyeri sedang (4-6)</SelectItem>
                      <SelectItem value="Nyeri berat (7-10)">Nyeri berat (7-10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Skala Nyeri */}
              <div className="space-y-4 rounded-lg bg-muted/20 p-5 border border-border/50 max-w-full">
                <div className="flex justify-between items-center mb-2">
                  <Label>Skala Nyeri (0-10)</Label>
                  <span className="font-bold text-xl text-primary">{nyeri.skala || 0}</span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 pb-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => updateNyeri("skala", v)}
                      className={cn(
                        "h-10 w-full text-sm font-medium rounded transition-all",
                        nyeri.skala === v
                          ? "ring-2 ring-primary text-primary-foreground " +
                          (v <= 3
                            ? "bg-green-500"
                            : v <= 6
                              ? "bg-yellow-500"
                              : "bg-red-500")
                          : v <= 3
                            ? "bg-green-100 hover:bg-green-200 text-green-800"
                            : v <= 6
                              ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                              : "bg-red-100 hover:bg-red-200 text-red-800",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  0 = Tidak nyeri, 1-3 = Ringan, 4-6 = Sedang, 7-10 = Berat
                </p>
              </div>

              {/* Asesmen Tambahan */}
              <div className="space-y-4 border-t pt-6">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Asesmen Tambahan</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="font-normal text-sm">Pasien tahap terminal?</Label>
                    <Select value={nyeri.terminal || "Tidak"} onValueChange={(v) => updateNyeri("terminal", v)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                      <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-normal text-sm">Nyeri kronik?</Label>
                    <Select value={nyeri.kronik || "Tidak"} onValueChange={(v) => updateNyeri("kronik", v)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                      <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 4. Kebutuhan Edukasi */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Kebutuhan Edukasi
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Bahasa</Label>
                  <Select value={formData.edukasi?.bahasa || ""} onValueChange={(v) => onChange("edukasi", { ...formData.edukasi, bahasa: v })} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Indonesia">Indonesia</SelectItem>
                      <SelectItem value="Inggris">Inggris</SelectItem>
                      <SelectItem value="Daerah">Daerah</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kebutuhan penerjemah</Label>
                  <Select value={formData.edukasi?.penerjemah || ""} onValueChange={(v) => onChange("edukasi", { ...formData.edukasi, penerjemah: v })} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Baca dan tulis</Label>
                  <Select value={formData.edukasi?.baca_tulis || ""} onValueChange={(v) => onChange("edukasi", { ...formData.edukasi, baca_tulis: v })} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent><SelectItem value="Baik">Baik</SelectItem><SelectItem value="Kurang">Kurang</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tipe Pembelajaran</Label>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  {['Wawancara', 'Ceramah', 'Demontrasi', 'Diskusi', 'Brosur'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        checked={(formData.edukasi?.pembelajaran || []).includes(item)}
                        onCheckedChange={(c) => {
                          const current = formData.edukasi?.pembelajaran || [];
                          onChange("edukasi", { ...formData.edukasi, pembelajaran: c ? [...current, item] : current.filter((x: string) => x !== item) });
                        }} disabled={isReadOnly}
                      />
                      <span className="font-normal cursor-pointer select-none flex-1" onClick={() => {
                        if (isReadOnly) return;
                        const current = formData.edukasi?.pembelajaran || [];
                        const isChecked = current.includes(item);
                        onChange("edukasi", { ...formData.edukasi, pembelajaran: !isChecked ? [...current, item] : current.filter((x: string) => x !== item) });
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hambatan Edukasi</Label>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  {['Gangguan bicara', 'Gangguan penglihatan', 'Motivasi kurang', 'Gangguan emosi', 'Gangguan pendengaran', 'Fisik lemah', 'Gangguan kognitif', 'Budaya dan Agama', 'Lainnya'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        checked={(formData.edukasi?.hambatan || []).includes(item)}
                        onCheckedChange={(c) => {
                          const current = formData.edukasi?.hambatan || [];
                          onChange("edukasi", { ...formData.edukasi, hambatan: c ? [...current, item] : current.filter((x: string) => x !== item) });
                        }} disabled={isReadOnly}
                      />
                      <span className="font-normal cursor-pointer select-none flex-1" onClick={() => {
                        if (isReadOnly) return;
                        const current = formData.edukasi?.hambatan || [];
                        const isChecked = current.includes(item);
                        onChange("edukasi", { ...formData.edukasi, hambatan: !isChecked ? [...current, item] : current.filter((x: string) => x !== item) });
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4 border-t pt-6">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kebutuhan Pembelajaran</Label>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  {['Pengertian penyakit', 'Risiko jatuh', 'Hak pasien & keluarga', 'Diet', 'PPI', 'Gelang identifikasi', 'Cuci tangan', 'Obat-obatan', 'Informed consent', 'Rehabilitasi medik', 'Bimroh', 'Bimbingan psikologi', 'Pengelolaan nyeri', 'Lainnya'].map(item => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        checked={(formData.edukasi?.kebutuhan_pembelajaran || []).includes(item)}
                        onCheckedChange={(c) => {
                          const current = formData.edukasi?.kebutuhan_pembelajaran || [];
                          onChange("edukasi", { ...formData.edukasi, kebutuhan_pembelajaran: c ? [...current, item] : current.filter((x: string) => x !== item) });
                        }} disabled={isReadOnly}
                      />
                      <span className="font-normal text-sm cursor-pointer truncate max-w-[150px] sm:max-w-none select-none flex-1" title={item} onClick={() => {
                        if (isReadOnly) return;
                        const current = formData.edukasi?.kebutuhan_pembelajaran || [];
                        const isChecked = current.includes(item);
                        onChange("edukasi", { ...formData.edukasi, kebutuhan_pembelajaran: !isChecked ? [...current, item] : current.filter((x: string) => x !== item) });
                      }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
