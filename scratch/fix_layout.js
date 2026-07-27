const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/components/medical-record/informed-consent-form.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { printApi } from "@/lib/api/print";',
  'import { printApi } from "@/lib/api/print";\nimport { visitsApi, type Visit } from "@/lib/api/visits";'
);

// 2. Add Visit state
content = content.replace(
  'const [signDialogOpen, setSignDialogOpen] = useState(false);',
  'const [signDialogOpen, setSignDialogOpen] = useState(false);\n  const [visit, setVisit] = useState<Visit | null>(null);'
);

// 3. Update fetch Consent
content = content.replace(
  'const res = await medicalRecordsApi.getInformedConsent(visitId);',
  `const [res, visitRes] = await Promise.all([
          medicalRecordsApi.getInformedConsent(visitId),
          visitsApi.getById(visitId)
        ]);
        if (visitRes.data) {
          setVisit(visitRes.data);
        }`
);

// 4. Extract and rewrite TabsContent
const startStr = '<TabsContent value="pemberian-informasi" className="pt-4 space-y-6">';
const endStr = '<TabsContent value="ringkasan-cetak" className="pt-4 space-y-6">';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = `
          <TabsContent value="pemberian-informasi" className="pt-4 space-y-6">
            
            {/* A. DATA PASIEN (Otomatis) */}
            <div className="border rounded-md p-4 space-y-4 bg-white">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">A. DATA PASIEN (Otomatis)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">No. RM</Label>
                  <Input value={visit?.registration?.patient?.mrn || visit?.registration?.patient?.no_rm || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Nama Pasien</Label>
                  <Input value={visit?.registration?.patient?.nama_lengkap || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Tanggal Lahir</Label>
                  <Input value={visit?.registration?.patient?.tanggal_lahir ? new Date(visit.registration.patient.tanggal_lahir).toLocaleDateString('id-ID') : "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Umur</Label>
                  <Input value={
                    visit?.registration?.patient?.tanggal_lahir ? 
                    (() => {
                      const today = new Date();
                      const birth = new Date(visit.registration.patient.tanggal_lahir);
                      let age = today.getFullYear() - birth.getFullYear();
                      const m = today.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                      return \`\${age} Tahun\`;
                    })() : "-"
                  } readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Jenis Kelamin</Label>
                  <Input value={visit?.registration?.patient?.jenis_kelamin === 'L' ? 'Laki-laki' : visit?.registration?.patient?.jenis_kelamin === 'P' ? 'Perempuan' : '-'} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">No. HP</Label>
                  <Input value={visit?.registration?.patient?.no_hp || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1 md:col-span-4">
                  <Label className="text-muted-foreground text-xs">Alamat</Label>
                  <Input value={visit?.registration?.patient?.alamat_domisili || visit?.registration?.patient?.alamat_ktp || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Unit Pelayanan</Label>
                  <Input value={visit?.room?.name || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Dokter DPJP</Label>
                  <Input value={visit?.doctor?.nama_lengkap || visit?.doctor?.name || "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Tanggal</Label>
                  <Input value={visit?.start_time ? new Date(visit.start_time).toLocaleDateString('id-ID') : "-"} readOnly className="bg-gray-50 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Jam</Label>
                  <Input value={visit?.start_time ? new Date(visit.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : "-"} readOnly className="bg-gray-50 h-8" />
                </div>
              </div>
            </div>

            {/* B. JENIS TINDAKAN */}
            <div className="border rounded-md p-4 space-y-4 bg-white">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">B. JENIS TINDAKAN</h3>
              <div className="space-y-2">
                <Label>Jenis Tindakan <span className="text-red-500">*</span></Label>
                <Input
                  {...form.register("jenis_tindakan")}
                  disabled={readOnly}
                  placeholder="Contoh: Pemasangan Selang Kencing"
                />
              </div>
            </div>

            {/* C. DOKTER PEMBERI INFORMASI */}
            <div className="border rounded-md p-4 space-y-4 bg-white">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">C. DOKTER PEMBERI INFORMASI</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Dokter Pemberi Informasi</Label>
                  <EmployeeSelect
                    value={form.watch("dokter_pemberi_informasi_id")}
                    onChange={(val: string | number) => form.setValue("dokter_pemberi_informasi_id", Number(val))}
                    disabled={readOnly}
                    role="dokter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SIP</Label>
                  <Input value={visit?.doctor?.sip || "-"} readOnly className="bg-gray-50" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input value={new Date().toLocaleDateString('id-ID')} readOnly className="bg-gray-50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Jam</Label>
                    <Input value={new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} readOnly className="bg-gray-50" />
                  </div>
                </div>
              </div>
            </div>

            {/* D. PENERIMA INFORMASI / PENANGGUNG JAWAB PASIEN (WALI) */}
            <div className="border rounded-md p-4 space-y-4 bg-white">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">D. PENERIMA INFORMASI / PENANGGUNG JAWAB PASIEN (WALI)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
                  <Input {...form.register("penerima_informasi_nama")} disabled={readOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Umur <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" {...form.register("penerima_informasi_umur", { valueAsNumber: true })} disabled={readOnly} />
                    <span className="text-sm text-muted-foreground">Tahun</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin <span className="text-red-500">*</span></Label>
                  <RadioGroup
                    value={form.watch("penerima_informasi_jk")}
                    onValueChange={(v) => form.setValue("penerima_informasi_jk", v)}
                    disabled={readOnly}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Laki-laki" id="jk-l" />
                      <Label htmlFor="jk-l">Laki-laki</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Perempuan" id="jk-p" />
                      <Label htmlFor="jk-p">Perempuan</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Alamat <span className="text-red-500">*</span></Label>
                  <Textarea {...form.register("penerima_informasi_alamat")} disabled={readOnly} rows={1} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Hubungan dengan Pasien <span className="text-red-500">*</span></Label>
                  <Input {...form.register("penerima_informasi_hubungan")} disabled={readOnly} placeholder="Contoh: Istri/Anak" />
                </div>
              </div>
            </div>

            {/* E. INFORMASI YANG DIJELASKAN OLEH DOKTER */}
            <div className="border rounded-md p-4 space-y-4 bg-white">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">E. INFORMASI YANG DIJELASKAN OLEH DOKTER</h3>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-center w-12">No.</th>
                      <th className="px-4 py-2 font-semibold w-48">Jenis Informasi</th>
                      <th className="px-4 py-2 font-semibold text-center w-24">Dijelaskan</th>
                      <th className="px-4 py-2 font-semibold">Isi Informasi (Static/Opsional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { field: "info_diagnosis_kerja", label: "Diagnosis Kerja", content: "Penjelasan mengenai diagnosis pasien saat ini." },
                      { field: "info_indikasi_tindakan", label: "Indikasi Tindakan", content: "Alasan mengapa tindakan medis ini perlu dilakukan." },
                      { field: "info_tata_cara", label: "Tata Cara", content: "Prosedur atau langkah-langkah tindakan yang akan dilakukan." },
                      { field: "info_tujuan", label: "Tujuan", content: "Hasil yang diharapkan dari tindakan medis ini." },
                      { field: "info_risiko", label: "Risiko", content: "Kemungkinan risiko yang dapat terjadi selama atau setelah tindakan." },
                      { field: "info_komplikasi", label: "Komplikasi", content: "Masalah kesehatan tambahan yang dapat muncul sebagai akibat dari tindakan." },
                      { field: "info_prognosis", label: "Prognosis", content: "Perkiraan mengenai jalannya penyakit dan peluang kesembuhan." },
                      { field: "info_alternatif", label: "Alternatif & Risiko", content: "Pilihan tindakan lain dan risiko jika tidak dilakukan tindakan." },
                    ].map((item, index) => (
                      <tr key={item.field} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-center">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{item.label}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Checkbox
                              id={item.field}
                              checked={form.watch(item.field as any) as boolean}
                              onCheckedChange={(c) => form.setValue(item.field as any, !!c)}
                              disabled={readOnly}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Hal-hal lain yang perlu dijelaskan</Label>
                <Textarea {...form.register("info_lain_lain")} disabled={readOnly} className="bg-gray-50" placeholder="Pasien dapat memerlukan tindakan tambahan sesuai kondisi saat tindakan dilakukan..." />
              </div>
            </div>

            {/* F. PERNYATAAN DOKTER & G. PERNYATAAN PASIEN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-4 space-y-4 bg-white">
                <h3 className="font-semibold text-lg text-primary border-b pb-2">F. PERNYATAAN DOKTER</h3>
                <p className="text-sm text-justify">
                  Saya menyatakan bahwa saya telah memberikan penjelasan kepada pasien atau penanggung jawab pasien mengenai semua informasi seperti di atas secara benar, jelas, dan mudah dipahami serta telah memberikan kesempatan bertanya dan memahami jawabannya.
                </p>
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="pernyataan_dokter"
                    checked={form.watch("pernyataan_dokter")}
                    onCheckedChange={(c) => form.setValue("pernyataan_dokter", !!c)}
                    disabled={readOnly}
                  />
                  <Label htmlFor="pernyataan_dokter" className="font-normal cursor-pointer text-sm">Saya mengkonfirmasi pernyataan ini.</Label>
                </div>
              </div>
              <div className="border rounded-md p-4 space-y-4 bg-white">
                <h3 className="font-semibold text-lg text-primary border-b pb-2">G. PERNYATAAN PASIEN / PENANGGUNG JAWAB</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="stmt_menerima_penjelasan"
                      checked={form.watch("stmt_menerima_penjelasan")}
                      onCheckedChange={(c) => form.setValue("stmt_menerima_penjelasan", !!c)}
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <Label htmlFor="stmt_menerima_penjelasan" className="font-normal cursor-pointer text-sm leading-snug">
                      Saya menyatakan bahwa telah menerima penjelasan dari dokter sebagaimana tersebut di atas.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="stmt_memahami_penjelasan"
                      checked={form.watch("stmt_memahami_penjelasan")}
                      onCheckedChange={(c) => form.setValue("stmt_memahami_penjelasan", !!c)}
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <Label htmlFor="stmt_memahami_penjelasan" className="font-normal cursor-pointer text-sm leading-snug">
                      Saya telah memahami informasi yang diberikan.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="stmt_kesempatan_bertanya"
                      checked={form.watch("stmt_kesempatan_bertanya")}
                      onCheckedChange={(c) => form.setValue("stmt_kesempatan_bertanya", !!c)}
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <Label htmlFor="stmt_kesempatan_bertanya" className="font-normal cursor-pointer text-sm leading-snug">
                      Saya telah memperoleh kesempatan untuk bertanya.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="stmt_jawaban_baik"
                      checked={form.watch("stmt_jawaban_baik")}
                      onCheckedChange={(c) => form.setValue("stmt_jawaban_baik", !!c)}
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <Label htmlFor="stmt_jawaban_baik" className="font-normal cursor-pointer text-sm leading-snug">
                      Semua pertanyaan saya telah dijawab dengan baik.
                    </Label>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Label>Status Kompetensi Pasien</Label>
                  <RadioGroup
                    value={form.watch("status_kompetensi_pasien")}
                    onValueChange={(v) => form.setValue("status_kompetensi_pasien", v)}
                    disabled={readOnly}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="kompeten" id="kompeten" />
                      <Label htmlFor="kompeten" className="text-sm">Pasien kompeten menerima informasi</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="tidak_kompeten" id="tidak_kompeten" />
                      <Label htmlFor="tidak_kompeten" className="text-sm">Pasien tidak kompeten menerima informasi</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            {/* H. PERNYATAAN PERSETUJUAN / PENOLAKAN */}
            <div className="border rounded-md p-4 space-y-4 bg-white shadow-sm">
              <h3 className="font-semibold text-lg text-primary border-b pb-2">H. PERNYATAAN PERSETUJUAN / PENOLAKAN</h3>
              <p className="text-sm text-justify">
                Dengan ini saya menyatakan bahwa saya telah menerima dan memahami penjelasan informasi mengenai kondisi, rencana tindakan medis, risiko, komplikasi, alternatif dan biaya yang diperlukan sebagaimana tercantum di atas. <br/>
                Berdasarkan informasi tersebut, dengan penuh kesadaran dan tanpa paksaan dari pihak manapun, saya:
              </p>
              <RadioGroup
                value={form.watch("persetujuan_tindakan")}
                onValueChange={(v) => form.setValue("persetujuan_tindakan", v)}
                disabled={readOnly}
                className="flex flex-col md:flex-row gap-6 mb-4"
              >
                <div
                  className={\`flex items-start gap-3 p-4 rounded-md border w-full cursor-pointer transition-colors \${form.watch("persetujuan_tindakan") === "menyetujui" ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-gray-50 border-gray-200'}\`}
                  onClick={() => !readOnly && form.setValue("persetujuan_tindakan", "menyetujui")}
                >
                  <RadioGroupItem value="menyetujui" id="menyetujui" className="mt-1" />
                  <div>
                    <Label htmlFor="menyetujui" className="font-bold text-green-700 cursor-pointer text-base block">MENYETUJUI TINDAKAN KEDOKTERAN</Label>
                    <span className="text-xs text-muted-foreground mt-1 block">Saya menyetujui tindakan kedokteran yang akan dilakukan sebagaimana dijelaskan oleh dokter.</span>
                  </div>
                </div>
                <div
                  className={\`flex items-start gap-3 p-4 rounded-md border w-full cursor-pointer transition-colors \${form.watch("persetujuan_tindakan") === "menolak" ? 'bg-red-50 border-red-500 shadow-sm' : 'bg-gray-50 border-gray-200'}\`}
                  onClick={() => !readOnly && form.setValue("persetujuan_tindakan", "menolak")}
                >
                  <RadioGroupItem value="menolak" id="menolak" className="mt-1" />
                  <div className="w-full">
                    <Label htmlFor="menolak" className="font-bold text-red-700 cursor-pointer text-base block mb-2">MENOLAK TINDAKAN KEDOKTERAN</Label>
                    {form.watch("persetujuan_tindakan") === "menolak" ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">Alasan Penolakan</Label>
                        <Input
                          {...form.register("alasan_penolakan")}
                          disabled={readOnly}
                          placeholder="Tuliskan alasan penolakan..."
                          className="border-red-300 h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                       <span className="text-xs text-muted-foreground mt-1 block">Saya menolak tindakan kedokteran yang akan dilakukan.</span>
                    )}
                  </div>
                </div>
              </RadioGroup>

              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="stmt_membaca_memahami_isi"
                    checked={form.watch("stmt_membaca_memahami_isi")}
                    onCheckedChange={(c) => form.setValue("stmt_membaca_memahami_isi", !!c)}
                    disabled={readOnly}
                    className="mt-1"
                  />
                  <Label htmlFor="stmt_membaca_memahami_isi" className="font-normal cursor-pointer text-sm">
                    Saya telah membaca dan memahami seluruh isi informed consent ini.
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="stmt_data_benar"
                    checked={form.watch("stmt_data_benar")}
                    onCheckedChange={(c) => form.setValue("stmt_data_benar", !!c)}
                    disabled={readOnly}
                    className="mt-1"
                  />
                  <Label htmlFor="stmt_data_benar" className="font-normal cursor-pointer text-sm">
                    Saya menyatakan data yang saya isi adalah benar.
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="stmt_setuju_sadar"
                    checked={form.watch("stmt_setuju_sadar")}
                    onCheckedChange={(c) => form.setValue("stmt_setuju_sadar", !!c)}
                    disabled={readOnly}
                    className="mt-1"
                  />
                  <Label htmlFor="stmt_setuju_sadar" className="font-normal cursor-pointer text-sm">
                    Saya memberikan persetujuan secara sadar tanpa pakanan dari pihak manapun.
                  </Label>
                </div>
              </div>
            </div>

            {/* I. TANDA TANGAN */}
            <div className="border rounded-md p-6 space-y-4 bg-white">
               <h3 className="font-semibold text-lg text-primary border-b pb-2">I. TANDA TANGAN</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                 <div className="space-y-16">
                   <div className="text-sm font-medium">Penanggung Jawab / Pasien<br/><span className="text-xs text-muted-foreground">(Penerima Informasi)</span></div>
                   <div className="border-b border-dashed border-gray-400 mx-8"></div>
                   <div className="text-sm font-semibold">{form.watch("penerima_informasi_nama") || "__________________"}</div>
                 </div>
                 <div className="space-y-16">
                   <div className="text-sm font-medium">Dokter Pemberi Informasi</div>
                   <div className="border-b border-dashed border-gray-400 mx-8"></div>
                   <div className="text-sm font-semibold">{visit?.doctor?.nama_lengkap || "__________________"}</div>
                 </div>
                 <div className="space-y-16">
                   <div className="text-sm font-medium">Perawat</div>
                   <div className="border-b border-dashed border-gray-400 mx-8"></div>
                   <div className="text-sm font-semibold">__________________</div>
                 </div>
                 <div className="space-y-16">
                   <div className="text-sm font-medium">Saksi</div>
                   <div className="border-b border-dashed border-gray-400 mx-8"></div>
                   <div className="text-sm font-semibold">__________________</div>
                 </div>
               </div>
               
               <div className="mt-8 bg-green-50 p-4 rounded-md border border-green-200 flex items-start gap-4">
                 <div className="bg-green-100 p-2 rounded-full text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
                 </div>
                 <div>
                   <h4 className="font-semibold text-green-900">Pernyataan Elektronik</h4>
                   <p className="text-sm text-green-800 mt-1 leading-relaxed">
                     Dokumen Informed Consent ini dibuat dan ditandatangani secara elektronik sebagai bagian dari Rekam Medis Elektronik. Tanda tangan elektronik yang dibubuhkan oleh dokter, pasien/penanggung jawab, perawat, dan saksi merupakan persetujuan yang sah sesuai ketentuan peraturan perundang-undangan yang berlaku. Dokumen ini akan tersimpan sebagai bagian dari rekam medis pasien dan setiap perubahan setelah penandatanganan akan tercatat dalam sistem (audit trail).
                   </p>
                 </div>
               </div>
            </div>

          </TabsContent>
  `;
  content = content.substring(0, startIndex) + newContent + '\n\n          ' + content.substring(endIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done rewriting layout.');
