import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { BersalinRecord } from "@/lib/api";
import React from "react";

interface AsesmenAwalProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

const AsesmenDasar = React.memo(({ formData, onChange, isReadOnly }: any) => {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Asesmen Kebidanan
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 sm:p-6">
        <div className="space-y-2">
          <Label>Jam Datang</Label>
          <TimeInput
            value={formData.jam_datang || ""}
            onChange={(e) => onChange("jam_datang", e.target.value)}
            disabled={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label>Jam Pengkajian</Label>
          <TimeInput
            value={formData.jam_pengkajian || ""}
            onChange={(e) => onChange("jam_pengkajian", e.target.value)}
            disabled={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label>Anamnese</Label>
          <Select value={formData.anamnesis_type || "Autoanamnesis"} onValueChange={(v) => onChange("anamnesis_type", v)} disabled={isReadOnly}>
            <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Autoanamnesis">Autoanamnesis</SelectItem>
              <SelectItem value="Alloanamnesis">Alloanamnesis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label>Keluhan Utama</Label>
          <Textarea
            value={formData.keluhan_utama || ""}
            onChange={(e) => onChange("keluhan_utama", e.target.value)}
            disabled={isReadOnly}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.formData.jam_datang === next.formData.jam_datang &&
  prev.formData.jam_pengkajian === next.formData.jam_pengkajian &&
  prev.formData.anamnesis_type === next.formData.anamnesis_type &&
  prev.formData.keluhan_utama === next.formData.keluhan_utama &&
  prev.isReadOnly === next.isReadOnly
);

const TTVUmum = React.memo(({ fisik, updateFisik, isReadOnly }: any) => {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Pemeriksaan Fisik - TTV & Umum
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">Suhu</Label>
            <div className="relative">
              <Input type="number" step="0.1" value={fisik.suhu || ""} onChange={(e) => updateFisik("suhu", e.target.value)} disabled={isReadOnly} className="pr-8 bg-background" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">°C</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">Nadi</Label>
            <div className="relative">
              <Input type="number" value={fisik.nadi || ""} onChange={(e) => updateFisik("nadi", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x/mnt</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">TD</Label>
            <div className="relative">
              <Input placeholder="120/80" value={fisik.td || ""} onChange={(e) => updateFisik("td", e.target.value)} disabled={isReadOnly} className="pr-14 bg-background" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">mmHg</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">Nafas</Label>
            <div className="relative">
              <Input type="number" value={fisik.nafas || ""} onChange={(e) => updateFisik("nafas", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x/mnt</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Kesadaran</Label>
              <Select value={fisik.kesadaran || ""} onValueChange={(v) => updateFisik("kesadaran", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baik">Baik</SelectItem>
                  <SelectItem value="Menurun">Menurun</SelectItem>
                  <SelectItem value="Tidak sadar">Tidak sadar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kepala</Label>
              <Select value={fisik.kepala || ""} onValueChange={(v) => updateFisik("kepala", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Kelainan">Kelainan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mata (Konjungtiva)</Label>
              <Select value={fisik.konjungtiva || ""} onValueChange={(v) => updateFisik("konjungtiva", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Anemis">Anemis</SelectItem>
                  <SelectItem value="Tidak anemis">Tidak anemis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mata (Sklera)</Label>
              <Select value={fisik.sklera || ""} onValueChange={(v) => updateFisik("sklera", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Icterus">Icterus</SelectItem>
                  <SelectItem value="Tidak icterus">Tidak icterus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leher</Label>
              <Select value={fisik.leher || ""} onValueChange={(v) => updateFisik("leher", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Kelainan">Kelainan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jantung</Label>
              <Select value={fisik.jantung || ""} onValueChange={(v) => updateFisik("jantung", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Kelainan">Kelainan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paru-paru</Label>
              <Select value={fisik.paru || ""} onValueChange={(v) => updateFisik("paru", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Kelainan">Kelainan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payudara (Puting)</Label>
              <Select value={fisik.puting || ""} onValueChange={(v) => updateFisik("puting", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Menonjol">Menonjol</SelectItem>
                  <SelectItem value="Datar">Datar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payudara (Colostrum)</Label>
              <Select value={fisik.colostrum || ""} onValueChange={(v) => updateFisik("colostrum", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ada">Ada</SelectItem>
                  <SelectItem value="Tidak ada">Tidak ada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.fisik.suhu === next.fisik.suhu &&
  prev.fisik.nadi === next.fisik.nadi &&
  prev.fisik.td === next.fisik.td &&
  prev.fisik.nafas === next.fisik.nafas &&
  prev.fisik.kesadaran === next.fisik.kesadaran &&
  prev.fisik.kepala === next.fisik.kepala &&
  prev.fisik.konjungtiva === next.fisik.konjungtiva &&
  prev.fisik.sklera === next.fisik.sklera &&
  prev.fisik.leher === next.fisik.leher &&
  prev.fisik.jantung === next.fisik.jantung &&
  prev.fisik.paru === next.fisik.paru &&
  prev.fisik.puting === next.fisik.puting &&
  prev.fisik.colostrum === next.fisik.colostrum &&
  prev.isReadOnly === next.isReadOnly
);

const PerutKandungan = React.memo(({ fisik, updateFisik, isReadOnly }: any) => {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Pemeriksaan Perut & Kandungan
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <Label>Luka bekas operasi</Label>
            <Select value={fisik.luka_operasi || ""} onValueChange={(v) => updateFisik("luka_operasi", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ada">Ada</SelectItem>
                <SelectItem value="Tidak ada">Tidak ada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Massa</Label>
            <Select value={fisik.massa || ""} onValueChange={(v) => updateFisik("massa", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ada">Ada</SelectItem>
                <SelectItem value="Tidak ada">Tidak ada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tinggi fundus uteri</Label>
            <div className="relative">
              <Input type="number" value={fisik.tfu || ""} onChange={(e) => updateFisik("tfu", e.target.value)} disabled={isReadOnly} className="pr-10 bg-background" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">cm</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Posisi janin</Label>
            <Select value={fisik.posisi_janin || ""} onValueChange={(v) => updateFisik("posisi_janin", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Purki">Purki (Punggung Kiri)</SelectItem>
                <SelectItem value="Puka">Puka (Punggung Kanan)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Presentasi janin</Label>
            <Select value={fisik.presentasi_janin || ""} onValueChange={(v) => updateFisik("presentasi_janin", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Kepala">Kepala</SelectItem>
                <SelectItem value="Bokong">Bokong</SelectItem>
                <SelectItem value="Bahu">Bahu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">His & DJJ</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-2 lg:col-span-1">
              <Label>His (Frekuensi)</Label>
              <div className="relative">
                <Input value={fisik.his_frekuensi || ""} onChange={(e) => updateFisik("his_frekuensi", e.target.value)} disabled={isReadOnly} className="pr-16 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x/10mnt</span>
              </div>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>His (Kekuatan)</Label>
              <Select value={fisik.his_kekuatan || ""} onValueChange={(v) => updateFisik("his_kekuatan", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baik">Baik</SelectItem>
                  <SelectItem value="Sedang">Sedang</SelectItem>
                  <SelectItem value="Lemah">Lemah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>His (Irama)</Label>
              <Select value={fisik.his_irama || ""} onValueChange={(v) => updateFisik("his_irama", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teratur">Teratur</SelectItem>
                  <SelectItem value="Tidak teratur">Tidak teratur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>DJJ (Frekuensi)</Label>
              <div className="relative">
                <Input value={fisik.djj_frekuensi || ""} onChange={(e) => updateFisik("djj_frekuensi", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">x/mnt</span>
              </div>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>DJJ (Irama)</Label>
              <Select value={fisik.djj_irama || ""} onValueChange={(v) => updateFisik("djj_irama", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teratur">Teratur</SelectItem>
                  <SelectItem value="Tidak teratur">Tidak teratur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.fisik.luka_operasi === next.fisik.luka_operasi &&
  prev.fisik.massa === next.fisik.massa &&
  prev.fisik.tfu === next.fisik.tfu &&
  prev.fisik.posisi_janin === next.fisik.posisi_janin &&
  prev.fisik.presentasi_janin === next.fisik.presentasi_janin &&
  prev.fisik.his_frekuensi === next.fisik.his_frekuensi &&
  prev.fisik.his_kekuatan === next.fisik.his_kekuatan &&
  prev.fisik.his_irama === next.fisik.his_irama &&
  prev.fisik.djj_frekuensi === next.fisik.djj_frekuensi &&
  prev.fisik.djj_irama === next.fisik.djj_irama &&
  prev.isReadOnly === next.isReadOnly
);

const Genetalia = React.memo(({ genetalia, updateGenetalia, isReadOnly }: any) => {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Genetalia & Pemeriksaan Dalam (VT)
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-8">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vulva Vagina</Label>
          <div className="flex flex-wrap gap-6 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox checked={!!genetalia.vulva_varises} onCheckedChange={(c) => updateGenetalia("vulva_varises", !!c)} disabled={isReadOnly} />
              <span className="font-normal cursor-pointer select-none" onClick={() => !isReadOnly && updateGenetalia("vulva_varises", !genetalia.vulva_varises)}>Varises</span>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={!!genetalia.vulva_odema} onCheckedChange={(c) => updateGenetalia("vulva_odema", !!c)} disabled={isReadOnly} />
              <span className="font-normal cursor-pointer select-none" onClick={() => !isReadOnly && updateGenetalia("vulva_odema", !genetalia.vulva_odema)}>Odema</span>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={!!genetalia.vulva_massa} onCheckedChange={(c) => updateGenetalia("vulva_massa", !!c)} disabled={isReadOnly} />
              <span className="font-normal cursor-pointer select-none" onClick={() => !isReadOnly && updateGenetalia("vulva_massa", !genetalia.vulva_massa)}>Massa</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pemeriksaan Dalam</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Serviks (Konsistensi)</Label>
              <Select value={genetalia.serviks_konsistensi || ""} onValueChange={(v) => updateGenetalia("serviks_konsistensi", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lunak">Lunak</SelectItem>
                  <SelectItem value="Kaku">Kaku</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serviks (Pendataran)</Label>
              <Select value={genetalia.serviks_pendataran || ""} onValueChange={(v) => updateGenetalia("serviks_pendataran", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 50%">{"< 50%"}</SelectItem>
                  <SelectItem value="> 50%">{"> 50%"}</SelectItem>
                  <SelectItem value="100%">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serviks (Posisi)</Label>
              <Select value={genetalia.serviks_posisi || ""} onValueChange={(v) => updateGenetalia("serviks_posisi", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belakang">Belakang</SelectItem>
                  <SelectItem value="Tengah">Tengah</SelectItem>
                  <SelectItem value="Depan">Depan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pembukaan</Label>
              <div className="relative">
                <Input type="number" value={genetalia.pembukaan || ""} onChange={(e) => updateGenetalia("pembukaan", e.target.value)} disabled={isReadOnly} className="pr-10 bg-background" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">cm</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Selaput Ketuban</Label>
              <Select value={genetalia.selaput_ketuban || ""} onValueChange={(v) => updateGenetalia("selaput_ketuban", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Utuh">Utuh</SelectItem>
                  <SelectItem value="Pecah">Pecah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {genetalia.selaput_ketuban === "Pecah" && (
              <div className="space-y-2">
                <Label>Jam Ketuban Pecah</Label>
                <TimeInput value={genetalia.ketuban_pecah_jam || ""} onChange={(e) => updateGenetalia("ketuban_pecah_jam", e.target.value)} disabled={isReadOnly} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Air Ketuban</Label>
              <Select value={genetalia.air_ketuban || ""} onValueChange={(v) => updateGenetalia("air_ketuban", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jernih">Jernih</SelectItem>
                  <SelectItem value="Mekonium">Mekonium</SelectItem>
                  <SelectItem value="Berbau">Berbau</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Presentasi Bawah</Label>
              <Select value={genetalia.presentasi_bawah || ""} onValueChange={(v) => updateGenetalia("presentasi_bawah", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Muka">Muka</SelectItem>
                  <SelectItem value="Dahi">Dahi</SelectItem>
                  <SelectItem value="Bahu">Bahu</SelectItem>
                  <SelectItem value="Majemuk">Majemuk</SelectItem>
                  <SelectItem value="Bokong">Bokong</SelectItem>
                  <SelectItem value="Puncak kepala">Puncak kepala</SelectItem>
                  <SelectItem value="Belakang kepala">Belakang kepala</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kesan Panggul</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Promontorium</Label>
              <Select value={genetalia.panggul_promontorium || ""} onValueChange={(v) => updateGenetalia("panggul_promontorium", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teraba">Teraba</SelectItem>
                  <SelectItem value="Tidak teraba">Tidak teraba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linea Terminalis</Label>
              <Select value={genetalia.panggul_linea || ""} onValueChange={(v) => updateGenetalia("panggul_linea", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teraba > 2/3 bag">Teraba &gt; 2/3 bag</SelectItem>
                  <SelectItem value="Tidak teraba">Tidak teraba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arkus Pubis</Label>
              <Select value={genetalia.panggul_arkus || ""} onValueChange={(v) => updateGenetalia("panggul_arkus", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lancip">Lancip</SelectItem>
                  <SelectItem value="Tumpul">Tumpul</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.genetalia === next.genetalia &&
  prev.isReadOnly === next.isReadOnly
);

const Ekstremitas = React.memo(({ fisik, updateFisik, isReadOnly }: any) => {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ekstremitas, Integumen & Neurologi
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Anggota Gerak Atas</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Edema</Label>
                <Select value={fisik.gerak_atas_edema || ""} onValueChange={(v) => updateFisik("gerak_atas_edema", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Varises</Label>
                <Select value={fisik.gerak_atas_varises || ""} onValueChange={(v) => updateFisik("gerak_atas_varises", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Reflek</Label>
                <Select value={fisik.gerak_atas_reflek || ""} onValueChange={(v) => updateFisik("gerak_atas_reflek", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Positif">Positif</SelectItem><SelectItem value="Negatif">Negatif</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Anggota Gerak Bawah</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Edema</Label>
                <Select value={fisik.gerak_bawah_edema || ""} onValueChange={(v) => updateFisik("gerak_bawah_edema", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Varises</Label>
                <Select value={fisik.gerak_bawah_varises || ""} onValueChange={(v) => updateFisik("gerak_bawah_varises", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ya">Ya</SelectItem><SelectItem value="Tidak">Tidak</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Reflek</Label>
                <Select value={fisik.gerak_bawah_reflek || ""} onValueChange={(v) => updateFisik("gerak_bawah_reflek", v)} disabled={isReadOnly}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="Positif">Positif</SelectItem><SelectItem value="Negatif">Negatif</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Integumen</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Turgor Kulit</Label>
              <Select value={fisik.turgor || ""} onValueChange={(v) => updateFisik("turgor", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent><SelectItem value="Baik">Baik</SelectItem><SelectItem value="Jelek">Jelek</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Warna Kulit</Label>
              <Select value={fisik.warna_kulit || ""} onValueChange={(v) => updateFisik("warna_kulit", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kemerahan">Kemerahan</SelectItem>
                  <SelectItem value="Sianosis">Sianosis</SelectItem>
                  <SelectItem value="Hiperpigmentasi">Hiperpigmentasi</SelectItem>
                  <SelectItem value="Ikterik">Ikterik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Akral</Label>
              <Select value={fisik.akral || ""} onValueChange={(v) => updateFisik("akral", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hangat">Hangat</SelectItem>
                  <SelectItem value="Panas">Panas</SelectItem>
                  <SelectItem value="Dingin">Dingin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kondisi Luka</Label>
              <Input placeholder="Tidak ada..." value={fisik.kondisi_luka || ""} onChange={(e) => updateFisik("kondisi_luka", e.target.value)} disabled={isReadOnly} />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Neurologi</Label>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Gejala Neurologi</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {['Normal', 'Vertigo', 'Sakit kepala', 'Kejang', 'Gelisah', 'Pusing', 'Pupil anisokor', 'Tremor', 'Lain-lain'].map(item => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      checked={(fisik.neurologi_gejala || []).includes(item)}
                      onCheckedChange={(c) => {
                        const current = fisik.neurologi_gejala || [];
                        updateFisik("neurologi_gejala", c ? [...current, item] : current.filter((x: string) => x !== item));
                      }}
                      disabled={isReadOnly}
                    />
                    <span className="font-normal cursor-pointer select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = fisik.neurologi_gejala || [];
                      const isChecked = current.includes(item);
                      updateFisik("neurologi_gejala", !isChecked ? [...current, item] : current.filter((x: string) => x !== item));
                    }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>GCS (Glasgow Coma Scale)</Label>
                <Input placeholder="E... V... M..." value={fisik.gcs || ""} onChange={(e) => updateFisik("gcs", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-2">
                <Label>Kesadaran Mental</Label>
                <Select value={fisik.kesadaran_mental || ""} onValueChange={(v) => updateFisik("kesadaran_mental", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Komposmentis">Komposmentis</SelectItem>
                    <SelectItem value="Apatis">Apatis</SelectItem>
                    <SelectItem value="Somnolent">Somnolent</SelectItem>
                    <SelectItem value="Sopor">Sopor</SelectItem>
                    <SelectItem value="Koma">Koma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.fisik.gerak_atas_edema === next.fisik.gerak_atas_edema &&
  prev.fisik.gerak_atas_varises === next.fisik.gerak_atas_varises &&
  prev.fisik.gerak_atas_reflek === next.fisik.gerak_atas_reflek &&
  prev.fisik.gerak_bawah_edema === next.fisik.gerak_bawah_edema &&
  prev.fisik.gerak_bawah_varises === next.fisik.gerak_bawah_varises &&
  prev.fisik.gerak_bawah_reflek === next.fisik.gerak_bawah_reflek &&
  prev.fisik.turgor === next.fisik.turgor &&
  prev.fisik.warna_kulit === next.fisik.warna_kulit &&
  prev.fisik.akral === next.fisik.akral &&
  prev.fisik.kondisi_luka === next.fisik.kondisi_luka &&
  prev.fisik.neurologi_gejala === next.fisik.neurologi_gejala &&
  prev.fisik.gcs === next.fisik.gcs &&
  prev.fisik.kesadaran_mental === next.fisik.kesadaran_mental &&
  prev.isReadOnly === next.isReadOnly
);

export function AsesmenAwalBersalin({ formData, onChange, isReadOnly }: AsesmenAwalProps) {
  const updateFisik = React.useCallback((key: string, value: any) => {
    onChange("pemeriksaan_fisik", {
      ...(formData.pemeriksaan_fisik || {}),
      [key]: value
    });
  }, [formData.pemeriksaan_fisik, onChange]);

  const updateGenetalia = React.useCallback((key: string, value: any) => {
    onChange("genetalia", {
      ...(formData.genetalia || {}),
      [key]: value
    });
  }, [formData.genetalia, onChange]);

  const fisik = formData.pemeriksaan_fisik || {};
  const genetalia = formData.genetalia || {};

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9)]:h-10 [&_[role=combobox]:not(.h-9)]:h-10">
      <AsesmenDasar formData={formData} onChange={onChange} isReadOnly={isReadOnly} />
      <TTVUmum fisik={fisik} updateFisik={updateFisik} isReadOnly={isReadOnly} />
      <PerutKandungan fisik={fisik} updateFisik={updateFisik} isReadOnly={isReadOnly} />
      <Genetalia genetalia={genetalia} updateGenetalia={updateGenetalia} isReadOnly={isReadOnly} />
      <Ekstremitas fisik={fisik} updateFisik={updateFisik} isReadOnly={isReadOnly} />
    </div>
  );
}
