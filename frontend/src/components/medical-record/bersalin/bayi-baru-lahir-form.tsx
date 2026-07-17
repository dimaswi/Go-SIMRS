import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { BersalinRecord } from "@/lib/api";

interface BayiBaruLahirProps {
  formData: Partial<BersalinRecord>;
  onChange: (field: keyof BersalinRecord, value: any) => void;
  isReadOnly: boolean;
}

export function BayiBaruLahirBersalin({ formData, onChange, isReadOnly }: BayiBaruLahirProps) {
  const bayi = formData.bayi_baru_lahir || {};

  const updateBayi = (key: string, value: any) => {
    onChange("bayi_baru_lahir", { ...bayi, [key]: value });
  };

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input:not(.h-9):not(.h-8):not(.h-7)]:h-10 [&_[role=combobox]:not(.h-9):not(.h-8):not(.h-7)]:h-10">
      <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="border-b border-border/50 bg-muted/40 px-4 py-3 flex items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Bayi Baru Lahir (Catatan Persalinan)
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-8 bg-slate-50/40 dark:bg-transparent">
          <div className="grid grid-cols-1 gap-6 divide-y divide-border">

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Berat Badan</Label>
                  <div className="relative">
                    <Input type="number" value={bayi.berat ?? ""} onChange={e => updateBayi("berat", e.target.value)} disabled={isReadOnly} className="pr-10 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">gr</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Panjang</Label>
                  <div className="relative">
                    <Input type="number" value={bayi.panjang ?? ""} onChange={e => updateBayi("panjang", e.target.value)} disabled={isReadOnly} className="pr-12 bg-background" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">cm</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Jenis Kelamin</Label>
                <Select value={bayi.jenis_kelamin || "L"} onValueChange={v => updateBayi("jenis_kelamin", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs">Penilaian Bayi Baru Lahir</Label>
                  <Select value={bayi.penilaian || "Baik"} onValueChange={v => updateBayi("penilaian", v)} disabled={isReadOnly}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baik">Baik</SelectItem>
                      <SelectItem value="Ada Penyulit">Ada Penyulit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {bayi.penilaian === "Ada Penyulit" && (
                  <div className="space-y-2 animate-in fade-in">
                    <Label className="text-xs text-muted-foreground">Sebutkan Penyulit:</Label>
                    <Input value={bayi.penyulit_ket || ""} onChange={e => updateBayi("penyulit_ket", e.target.value)} disabled={isReadOnly} className="bg-background" />
                  </div>
                )}

                <div className="bg-muted/20 p-4 rounded-lg border border-border/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={!!bayi.pemberian_asi} onCheckedChange={(c) => updateBayi("pemberian_asi", !!c)} disabled={isReadOnly} />
                    <span className="text-sm font-medium leading-none cursor-pointer flex-1" onClick={() => !isReadOnly && updateBayi("pemberian_asi", !bayi.pemberian_asi)}>Pemberian ASI</span>
                  </div>
                  {bayi.pemberian_asi && (
                    <div className="flex items-center gap-3 pl-7 animate-in fade-in">
                      <Label className="text-sm font-normal">Waktu:</Label>
                      <div className="relative w-full">
                        <Input type="number" className="h-9 pr-16 bg-background" value={bayi.waktu_asi ?? ""} onChange={e => updateBayi("waktu_asi", e.target.value)} disabled={isReadOnly} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">jam stlh lahir</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox checked={!!bayi.tidak_asi} onCheckedChange={(c) => updateBayi("tidak_asi", !!c)} disabled={isReadOnly} />
                    <span className="text-sm font-medium leading-none cursor-pointer flex-1" onClick={() => !isReadOnly && updateBayi("tidak_asi", !bayi.tidak_asi)}>Tidak diberikan ASI</span>
                  </div>
                  {bayi.tidak_asi && (
                    <div className="flex items-center gap-3 pl-7 animate-in fade-in">
                      <Label className="text-sm font-normal whitespace-nowrap">Alasan:</Label>
                      <Input className="h-9 flex-1 bg-background" value={bayi.tidak_asi_alasan || ""} onChange={e => updateBayi("tidak_asi_alasan", e.target.value)} disabled={isReadOnly} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-6">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-4">Kondisi Lahir & Tindakan</Label>

              <div className="space-y-6">

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={(bayi.kondisi_lahir || []).includes("Normal")} onCheckedChange={(c) => {
                      const current = bayi.kondisi_lahir || [];
                      updateBayi("kondisi_lahir", c ? [...current, "Normal"] : current.filter((x: string) => x !== "Normal"));
                    }} disabled={isReadOnly} />
                    <span className="font-medium cursor-pointer text-base flex-1 select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = bayi.kondisi_lahir || [];
                      const isChecked = current.includes("Normal");
                      updateBayi("kondisi_lahir", !isChecked ? [...current, "Normal"] : current.filter((x: string) => x !== "Normal"));
                    }}>Normal</span>
                  </div>
                  {((bayi.kondisi_lahir || []).includes("Normal")) && (
                    <div className="pl-7 space-y-2 animate-in fade-in">
                      <Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {['Mengeringkan', 'Menghangatkan', 'Rangsang taktil', 'Bungkus bayi dan tempatkan di sisi Ibu'].map(item => (
                          <div key={item} className="flex items-start space-x-2">
                            <Checkbox className="mt-0.5" checked={(bayi.tindakan_normal || []).includes(item)} onCheckedChange={(c) => {
                              const curr = bayi.tindakan_normal || [];
                              updateBayi("tindakan_normal", c ? [...curr, item] : curr.filter((x: string) => x !== item));
                            }} disabled={isReadOnly} />
                            <span className="text-sm font-normal cursor-pointer leading-tight flex-1 select-none" onClick={() => {
                              if (isReadOnly) return;
                              const curr = bayi.tindakan_normal || [];
                              const isChecked = curr.includes(item);
                              updateBayi("tindakan_normal", !isChecked ? [...curr, item] : curr.filter((x: string) => x !== item));
                            }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={(bayi.kondisi_lahir || []).includes("Asfiksia")} onCheckedChange={(c) => {
                      const current = bayi.kondisi_lahir || [];
                      updateBayi("kondisi_lahir", c ? [...current, "Asfiksia"] : current.filter((x: string) => x !== "Asfiksia"));
                    }} disabled={isReadOnly} className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive" />
                    <span className="font-medium cursor-pointer text-base text-destructive flex-1 select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = bayi.kondisi_lahir || [];
                      const isChecked = current.includes("Asfiksia");
                      updateBayi("kondisi_lahir", !isChecked ? [...current, "Asfiksia"] : current.filter((x: string) => x !== "Asfiksia"));
                    }}>Asfiksia / Pucat / Biru / Lemas</span>
                  </div>
                  {((bayi.kondisi_lahir || []).includes("Asfiksia")) && (
                    <div className="pl-7 space-y-2 animate-in fade-in">
                      <Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {['Mengeringkan', 'Rangsang taktil', 'Bebaskan jalan nafas', 'Bungkus bayi dan tempatkan di sisi Ibu', 'Menghangatkan', 'Lain-lain'].map(item => (
                          <div key={item} className="flex items-start space-x-2">
                            <Checkbox className="mt-0.5" checked={(bayi.tindakan_asfiksia || []).includes(item)} onCheckedChange={(c) => {
                              const curr = bayi.tindakan_asfiksia || [];
                              updateBayi("tindakan_asfiksia", c ? [...curr, item] : curr.filter((x: string) => x !== item));
                            }} disabled={isReadOnly} />
                            <span className="text-sm font-normal cursor-pointer leading-tight flex-1 select-none" onClick={() => {
                              if (isReadOnly) return;
                              const curr = bayi.tindakan_asfiksia || [];
                              const isChecked = curr.includes(item);
                              updateBayi("tindakan_asfiksia", !isChecked ? [...curr, item] : curr.filter((x: string) => x !== item));
                            }}>{item}</span>
                          </div>
                        ))}
                      </div>
                      {((bayi.tindakan_asfiksia || []).includes('Lain-lain')) && (
                        <Input className="h-8 text-sm mt-2 bg-background" value={bayi.asfiksia_lain || ""} onChange={e => updateBayi("asfiksia_lain", e.target.value)} disabled={isReadOnly} placeholder="Jelaskan tindakan lain..." />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={(bayi.kondisi_lahir || []).includes("Cacat")} onCheckedChange={(c) => {
                      const current = bayi.kondisi_lahir || [];
                      updateBayi("kondisi_lahir", c ? [...current, "Cacat"] : current.filter((x: string) => x !== "Cacat"));
                    }} disabled={isReadOnly} className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" />
                    <span className="font-medium cursor-pointer text-base text-orange-500 flex-1 select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = bayi.kondisi_lahir || [];
                      const isChecked = current.includes("Cacat");
                      updateBayi("kondisi_lahir", !isChecked ? [...current, "Cacat"] : current.filter((x: string) => x !== "Cacat"));
                    }}>Cacat Bawaan</span>
                  </div>
                  {((bayi.kondisi_lahir || []).includes("Cacat")) && (
                    <div className="pl-7 animate-in fade-in">
                      <Input className="h-9 bg-background" value={bayi.cacat_ket || ""} onChange={e => updateBayi("cacat_ket", e.target.value)} disabled={isReadOnly} placeholder="Sebutkan cacat bawaan..." />
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={(bayi.kondisi_lahir || []).includes("Hipotermi")} onCheckedChange={(c) => {
                      const current = bayi.kondisi_lahir || [];
                      updateBayi("kondisi_lahir", c ? [...current, "Hipotermi"] : current.filter((x: string) => x !== "Hipotermi"));
                    }} disabled={isReadOnly} className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                    <span className="font-medium cursor-pointer text-base text-blue-500 flex-1 select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = bayi.kondisi_lahir || [];
                      const isChecked = current.includes("Hipotermi");
                      updateBayi("kondisi_lahir", !isChecked ? [...current, "Hipotermi"] : current.filter((x: string) => x !== "Hipotermi"));
                    }}>Hipotermi</span>
                  </div>
                  {((bayi.kondisi_lahir || []).includes("Hipotermi")) && (
                    <div className="pl-7 space-y-2 animate-in fade-in">
                      <Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label>
                      <div className="space-y-1">
                        {['a', 'b', 'c'].map(item => (
                          <div key={item} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-4">{item}.</span>
                            <Input className="h-8 text-sm flex-1 bg-background" value={bayi[`hipotermi_tindakan_${item}`] || ""} onChange={e => updateBayi(`hipotermi_tindakan_${item}`, e.target.value)} disabled={isReadOnly} placeholder="..." />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={(bayi.kondisi_lahir || []).includes("Lain-lain")} onCheckedChange={(c) => {
                      const current = bayi.kondisi_lahir || [];
                      updateBayi("kondisi_lahir", c ? [...current, "Lain-lain"] : current.filter((x: string) => x !== "Lain-lain"));
                    }} disabled={isReadOnly} />
                    <span className="font-medium cursor-pointer text-base flex-1 select-none" onClick={() => {
                      if (isReadOnly) return;
                      const current = bayi.kondisi_lahir || [];
                      const isChecked = current.includes("Lain-lain");
                      updateBayi("kondisi_lahir", !isChecked ? [...current, "Lain-lain"] : current.filter((x: string) => x !== "Lain-lain"));
                    }}>Lain-lain</span>
                  </div>
                  {((bayi.kondisi_lahir || []).includes("Lain-lain")) && (
                    <div className="pl-7 space-y-3 animate-in fade-in">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Sebutkan:</Label>
                        <Input className="h-9 w-full bg-background" value={bayi.lain_ket || ""} onChange={e => updateBayi("lain_ket", e.target.value)} disabled={isReadOnly} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Hasilnya:</Label>
                        <Input className="h-9 w-full bg-background" value={bayi.lain_hasil || ""} onChange={e => updateBayi("lain_hasil", e.target.value)} disabled={isReadOnly} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
