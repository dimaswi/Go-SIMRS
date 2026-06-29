import re
import sys

def modify_skrining():
    file_path = r'c:\Users\User\Documents\Klinik Kedungadem\Go-SIMRS\frontend\src\components\medical-record\bersalin\skrining-risiko-form.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove import
    content = content.replace('import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";\n', '')

    # Replace 1: penganiayaan
    content = re.sub(r'<div className="flex items-center gap-4">\s*<RadioGroup\s*value=\{riwayat\.penganiayaan \|\| "Tidak"\}\s*onValueChange=\{\(v\) => updateRiwayat\("penganiayaan", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Tidak" id="peng-1" />\s*<Label htmlFor="peng-1">Tidak</Label>\s*</div>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Ya" id="peng-2" />\s*<Label htmlFor="peng-2">Ya, sebutkan</Label>\s*</div>\s*</RadioGroup>',
    '''<div className="flex items-center gap-4">
                <Select value={riwayat.penganiayaan || "Tidak"} onValueChange={(v) => updateRiwayat("penganiayaan", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                    <SelectItem value="Ya">Ya</SelectItem>
                  </SelectContent>
                </Select>''', content)

    # Replace 2: privasi
    content = re.sub(r'<div className="flex items-center gap-4">\s*<RadioGroup\s*value=\{riwayat\.privasi \|\| "Tidak ada"\}\s*onValueChange=\{\(v\) => updateRiwayat\("privasi", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Tidak ada" id="priv-1" />\s*<Label htmlFor="priv-1">Tidak ada</Label>\s*</div>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Ada" id="priv-2" />\s*<Label htmlFor="priv-2">Ada, sebutkan</Label>\s*</div>\s*</RadioGroup>',
    '''<div className="flex items-center gap-4">
                <Select value={riwayat.privasi || "Tidak ada"} onValueChange={(v) => updateRiwayat("privasi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak ada">Tidak ada</SelectItem>
                    <SelectItem value="Ada">Ada</SelectItem>
                  </SelectContent>
                </Select>''', content)

    # Replace 3: budaya
    content = re.sub(r'<div className="flex items-center gap-4">\s*<RadioGroup\s*value=\{riwayat\.budaya \|\| "Tidak ada"\}\s*onValueChange=\{\(v\) => updateRiwayat\("budaya", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Tidak ada" id="bud-1" />\s*<Label htmlFor="bud-1">Tidak ada</Label>\s*</div>\s*<div className="flex items-center space-x-2">\s*<RadioGroupItem value="Ada" id="bud-2" />\s*<Label htmlFor="bud-2">Ada</Label>\s*</div>\s*</RadioGroup>',
    '''<div className="flex items-center gap-4">
                <Select value={riwayat.budaya || "Tidak ada"} onValueChange={(v) => updateRiwayat("budaya", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tidak ada">Tidak ada</SelectItem>
                    <SelectItem value="Ada">Ada</SelectItem>
                  </SelectContent>
                </Select>''', content)

    # Replace 4: nyeri
    content = re.sub(r'<RadioGroup\s*value=\{nyeri\.ada_nyeri \|\| "Tidak"\}\s*onValueChange=\{\(v\) => updateNyeri\("ada_nyeri", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="ny-1" /><Label htmlFor="ny-1" className="text-xs">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="ny-2" /><Label htmlFor="ny-2" className="text-xs">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={nyeri.ada_nyeri || "Tidak"} onValueChange={(v) => updateNyeri("ada_nyeri", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>''', content)

    # Replace 5: terminal
    content = re.sub(r'<RadioGroup\s*value=\{nyeri\.terminal \|\| "Tidak"\}\s*onValueChange=\{\(v\) => updateNyeri\("terminal", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="t-1" /><Label htmlFor="t-1" className="text-xs">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="t-2" /><Label htmlFor="t-2" className="text-xs">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={nyeri.terminal || "Tidak"} onValueChange={(v) => updateNyeri("terminal", v)} disabled={isReadOnly}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ya">Ya</SelectItem>
                          <SelectItem value="Tidak">Tidak</SelectItem>
                        </SelectContent>
                      </Select>''', content)

    # Replace 6: kronik
    content = re.sub(r'<RadioGroup\s*value=\{nyeri\.kronik \|\| "Tidak"\}\s*onValueChange=\{\(v\) => updateNyeri\("kronik", v\)\}\s*disabled=\{isReadOnly\}\s*className="flex gap-4"\s*>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="k-1" /><Label htmlFor="k-1" className="text-xs">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="k-2" /><Label htmlFor="k-2" className="text-xs">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={nyeri.kronik || "Tidak"} onValueChange={(v) => updateNyeri("kronik", v)} disabled={isReadOnly}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ya">Ya</SelectItem>
                          <SelectItem value="Tidak">Tidak</SelectItem>
                        </SelectContent>
                      </Select>''', content)

    # Remove md:grid-cols-2 from the main grid containers
    content = content.replace('grid grid-cols-1 md:grid-cols-2 gap-6 p-3 sm:p-4', 'grid grid-cols-1 gap-6 p-3 sm:p-4')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("skrining-risiko-form.tsx updated successfully")

def modify_catatan():
    file_path = r'c:\Users\User\Documents\Klinik Kedungadem\Go-SIMRS\frontend\src\components\medical-record\bersalin\catatan-persalinan-form.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove import
    content = content.replace('import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";\n', '')

    # 1. Tempat persalinan
    content = re.sub(r'<RadioGroup value=\{kala1\.tempat \|\| "Klinik swasta"\} onValueChange=\{v => updateKala1\("tempat", v\)\} disabled=\{isReadOnly\} className="grid grid-cols-2 gap-2 mt-1">\s*\{.*?\.map\(item => \(\s*<div key=\{item\} className="flex items-center space-x-1"><RadioGroupItem value=\{item\} id=\{\`tpt-\$\{item\}\`\} /><Label htmlFor=\{\`tpt-\$\{item\}\`\} className="text-xs">\{item\}</Label></div>\s*\)\)\}\s*</RadioGroup>',
    '''<Select value={kala1.tempat || "Klinik swasta"} onValueChange={v => updateKala1("tempat", v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  {['Rumah Ibu', 'Puskesmas', 'Polindes', 'Rumah Sakit', 'Klinik swasta', 'Lainnya'].map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>''', content, flags=re.DOTALL)

    # 2. Waspada
    content = re.sub(r'<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-64">Partograf melewati garis waspada</Label>\s*<RadioGroup value=\{kala1\.waspada \|\| "T"\} onValueChange=\{v => updateKala1\("waspada", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Y" id="k1-w-y" /><Label htmlFor="k1-w-y">Y</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="T" id="k1-w-t" /><Label htmlFor="k1-w-t">T</Label></div>\s*</RadioGroup>\s*</div>',
    '''<div className="space-y-2 border-b pb-3">
              <Label>Partograf melewati garis waspada</Label>
              <Select value={kala1.waspada || "T"} onValueChange={v => updateKala1("waspada", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Y">Y</SelectItem>
                  <SelectItem value="T">T</SelectItem>
                </SelectContent>
              </Select>
            </div>''', content)

    # 3. Episiotomi
    content = re.sub(r'<RadioGroup value=\{kala2\.episiotomi \|\| "Tidak"\} onValueChange=\{v => updateKala2\("episiotomi", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="epi-y" /><Label htmlFor="epi-y">Ya, Indikasi:</Label></div>\s*\{kala2\.episiotomi === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.episiotomi_indikasi \|\| ""\} onChange=\{e => updateKala2\("episiotomi_indikasi", e\.target\.value\)\} disabled=\{isReadOnly\} />\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="epi-t" /><Label htmlFor="epi-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala2.episiotomi || "Tidak"} onValueChange={v => updateKala2("episiotomi", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.episiotomi === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Indikasi:</Label><Input className="h-9 w-full" value={kala2.episiotomi_indikasi || ""} onChange={e => updateKala2("episiotomi_indikasi", e.target.value)} disabled={isReadOnly} /></div>}''', content)

    # 4. Gawat Janin
    content = re.sub(r'<RadioGroup value=\{kala2\.gawat_janin \|\| "Tidak"\} onValueChange=\{v => updateKala2\("gawat_janin", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="gj-y" /><Label htmlFor="gj-y">Ya, tindakan:</Label></div>\s*\{kala2\.gawat_janin === "Ya" && <Textarea className="ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.gawat_janin_tindakan \|\| ""\} onChange=\{e => updateKala2\("gawat_janin_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} rows=\{2\} />\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="gj-t" /><Label htmlFor="gj-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala2.gawat_janin || "Tidak"} onValueChange={v => updateKala2("gawat_janin", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.gawat_janin === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Textarea className="w-full" value={kala2.gawat_janin_tindakan || ""} onChange={e => updateKala2("gawat_janin_tindakan", e.target.value)} disabled={isReadOnly} rows={2} /></div>}''', content)

    # 5. Distosia
    content = re.sub(r'<RadioGroup value=\{kala2\.distosia \|\| "Tidak"\} onValueChange=\{v => updateKala2\("distosia", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="db-y" /><Label htmlFor="db-y">Ya, tindakan:</Label></div>\s*\{kala2\.distosia === "Ya" && <Textarea className="ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.distosia_tindakan \|\| ""\} onChange=\{e => updateKala2\("distosia_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} rows=\{2\} />\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="db-t" /><Label htmlFor="db-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala2.distosia || "Tidak"} onValueChange={v => updateKala2("distosia", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.distosia === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Textarea className="w-full" value={kala2.distosia_tindakan || ""} onChange={e => updateKala2("distosia_tindakan", e.target.value)} disabled={isReadOnly} rows={2} /></div>}''', content)

    # 6. Tali Pusat
    content = re.sub(r'<RadioGroup value=\{kala3\.tali_pusat \|\| "Tidak"\} onValueChange=\{v => updateKala3\("tali_pusat", v\)\} disabled=\{isReadOnly\} className="flex gap-4 mt-1">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="tp-y" /><Label htmlFor="tp-y">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="tp-t" /><Label htmlFor="tp-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala3.tali_pusat || "Tidak"} onValueChange={v => updateKala3("tali_pusat", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>''', content)

    # 7. Mengedan
    content = re.sub(r'<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Pemberian Oksitosin > 15 Menit</Label>\s*<RadioGroup value=\{kala3\.oksitosin \|\| "Tidak"\} onValueChange=\{v => updateKala3\("oksitosin", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="ok-y" /><Label htmlFor="ok-y">Ya, alasan:</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="ok-t" /><Label htmlFor="ok-t">Tidak</Label></div>\s*</RadioGroup>\s*</div>',
    '''<div className="space-y-2 border-b pb-3">
              <Label>Pemberian Oksitosin &gt; 15 Menit</Label>
              <Select value={kala3.oksitosin || "Tidak"} onValueChange={v => updateKala3("oksitosin", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>''', content)

    # 8. Penegangan
    content = re.sub(r'<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Penegangan Tali Pusat Terkendali</Label>\s*<RadioGroup value=\{kala3\.penegangan \|\| "Tidak"\} onValueChange=\{v => updateKala3\("penegangan", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="pt-y" /><Label htmlFor="pt-y">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="pt-t" /><Label htmlFor="pt-t">Tidak, alasan:</Label></div>\s*</RadioGroup>\s*</div>',
    '''<div className="space-y-2 border-b pb-3">
              <Label>Penegangan Tali Pusat Terkendali</Label>
              <Select value={kala3.penegangan || "Tidak"} onValueChange={v => updateKala3("penegangan", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>''', content)

    # 9. Masase
    content = re.sub(r'<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Masase Fundus Uteri</Label>\s*<RadioGroup value=\{kala3\.masase \|\| "Tidak"\} onValueChange=\{v => updateKala3\("masase", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="mf-y" /><Label htmlFor="mf-y">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="mf-t" /><Label htmlFor="mf-t">Tidak, alasan:</Label></div>\s*</RadioGroup>\s*</div>',
    '''<div className="space-y-2 border-b pb-3">
              <Label>Masase Fundus Uteri</Label>
              <Select value={kala3.masase || "Tidak"} onValueChange={v => updateKala3("masase", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>''', content)

    # 10. Plasenta lahir lengkap
    content = re.sub(r'<RadioGroup value=\{kala3\.plasenta_lengkap \|\| "Ya"\} onValueChange=\{v => updateKala3\("plasenta_lengkap", v\)\} disabled=\{isReadOnly\} className="flex gap-4 mt-1">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="pl-y" /><Label htmlFor="pl-y">Ya</Label></div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="pl-t" /><Label htmlFor="pl-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala3.plasenta_lengkap || "Ya"} onValueChange={v => updateKala3("plasenta_lengkap", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>''', content)

    # 11. Plasenta tidak lahir > 30 menit
    content = re.sub(r'<RadioGroup value=\{kala3\.plasenta_lambat \|\| "Tidak"\} onValueChange=\{v => updateKala3\("plasenta_lambat", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="plm-y" /><Label htmlFor="plm-y">Ya, tindakan:</Label></div>\s*\{kala3\.plasenta_lambat === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala3\.plasenta_tindakan \|\| ""\} onChange=\{e => updateKala3\("plasenta_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} />\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="plm-t" /><Label htmlFor="plm-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala3.plasenta_lambat || "Tidak"} onValueChange={v => updateKala3("plasenta_lambat", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.plasenta_lambat === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Input className="h-9 w-full" value={kala3.plasenta_tindakan || ""} onChange={e => updateKala3("plasenta_tindakan", e.target.value)} disabled={isReadOnly} /></div>}''', content)

    # 12. Laserasi
    content = re.sub(r'<RadioGroup value=\{kala3\.laserasi \|\| "Tidak"\} onValueChange=\{v => updateKala3\("laserasi", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="las-y" /><Label htmlFor="las-y">Ya, dimana:</Label></div>\s*\{kala3\.laserasi === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala3\.laserasi_lokasi \|\| ""\} onChange=\{e => updateKala3\("laserasi_lokasi", e\.target\.value\)\} disabled=\{isReadOnly\} />\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="las-t" /><Label htmlFor="las-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala3.laserasi || "Tidak"} onValueChange={v => updateKala3("laserasi", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.laserasi === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Lokasi:</Label><Input className="h-9 w-full" value={kala3.laserasi_lokasi || ""} onChange={e => updateKala3("laserasi_lokasi", e.target.value)} disabled={isReadOnly} /></div>}''', content)

    # 13. Atoni Uteri
    content = re.sub(r'<RadioGroup value=\{kala3\.atoni_uteri \|\| "Tidak"\} onValueChange=\{v => updateKala3\("atoni_uteri", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center gap-2 mb-1 flex-wrap">\s*<RadioGroupItem value="Ya" id="au-y" /><Label htmlFor="au-y">Ya, tindakan:</Label>\s*\{kala3\.atoni_uteri === "Ya" && <Input className="h-8 w-full mt-1" value=\{kala3\.atoni_tindakan \|\| ""\} onChange=\{e => updateKala3\("atoni_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} />\}\s*</div>\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="au-t" /><Label htmlFor="au-t">Tidak</Label></div>\s*</RadioGroup>',
    '''<Select value={kala3.atoni_uteri || "Tidak"} onValueChange={v => updateKala3("atoni_uteri", v)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.atoni_uteri === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Input className="h-9 w-full" value={kala3.atoni_tindakan || ""} onChange={e => updateKala3("atoni_tindakan", e.target.value)} disabled={isReadOnly} /></div>}''', content)

    # Remove md:grid-cols-2 from grid classes where applicable
    content = content.replace('grid grid-cols-1 md:grid-cols-2 gap-4', 'grid grid-cols-1 gap-6')
    content = content.replace('grid grid-cols-1 md:grid-cols-2 gap-6', 'grid grid-cols-1 gap-6')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("catatan-persalinan-form.tsx updated successfully")

modify_skrining()
modify_catatan()
