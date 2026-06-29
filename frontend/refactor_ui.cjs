const fs = require('fs');
const path = require('path');

function modifyCatatan() {
  const filePath = 'C:\\Users\\User\\Documents\\Klinik Kedungadem\\Go-SIMRS\\frontend\\src\\components\\medical-record\\bersalin\\catatan-persalinan-form.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove import
  content = content.replace(/import \{ RadioGroup, RadioGroupItem \} from "@\/components\/ui\/radio-group";\n/, '');

  // 1. Tempat
  content = content.replace(
    /<RadioGroup value=\{kala1\.tempat \|\| "Klinik swasta"\} onValueChange=\{v => updateKala1\("tempat", v\)\} disabled=\{isReadOnly\} className="grid grid-cols-2 gap-2 mt-1">\s*\{.*?\.map\(item => \(\s*<div key=\{item\} className="flex items-center space-x-1"><RadioGroupItem value=\{item\} id=\{`tpt-\$\{item\}`\} \/><Label htmlFor=\{`tpt-\$\{item\}`\} className="text-xs">\{item\}<\/Label><\/div>\s*\)\)\}\s*<\/RadioGroup>/gs,
    `<Select value={kala1.tempat || "Klinik swasta"} onValueChange={v => updateKala1("tempat", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  {['Rumah Ibu', 'Puskesmas', 'Polindes', 'Rumah Sakit', 'Klinik swasta', 'Lainnya'].map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>`
  );

  // 2. Waspada
  content = content.replace(
    /<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-64">Partograf melewati garis waspada<\/Label>\s*<RadioGroup value=\{kala1\.waspada \|\| "T"\} onValueChange=\{v => updateKala1\("waspada", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Y" id="k1-w-y" \/><Label htmlFor="k1-w-y">Y<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="T" id="k1-w-t" \/><Label htmlFor="k1-w-t">T<\/Label><\/div>\s*<\/RadioGroup>\s*<\/div>/g,
    `<div className="space-y-2 border-b pb-3">
              <Label>Partograf melewati garis waspada</Label>
              <Select value={kala1.waspada || "T"} onValueChange={v => updateKala1("waspada", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Y">Y</SelectItem>
                  <SelectItem value="T">T</SelectItem>
                </SelectContent>
              </Select>
            </div>`
  );

  // 3. Episiotomi
  content = content.replace(
    /<RadioGroup value=\{kala2\.episiotomi \|\| "Tidak"\} onValueChange=\{v => updateKala2\("episiotomi", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="epi-y" \/><Label htmlFor="epi-y">Ya, Indikasi:<\/Label><\/div>\s*\{kala2\.episiotomi === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.episiotomi_indikasi \|\| ""\} onChange=\{e => updateKala2\("episiotomi_indikasi", e\.target\.value\)\} disabled=\{isReadOnly\} \/>\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="epi-t" \/><Label htmlFor="epi-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala2.episiotomi || "Tidak"} onValueChange={v => updateKala2("episiotomi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.episiotomi === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Indikasi:</Label><Input className="h-9 w-full" value={kala2.episiotomi_indikasi || ""} onChange={e => updateKala2("episiotomi_indikasi", e.target.value)} disabled={isReadOnly} /></div>}`
  );

  // 4. Gawat Janin
  content = content.replace(
    /<RadioGroup value=\{kala2\.gawat_janin \|\| "Tidak"\} onValueChange=\{v => updateKala2\("gawat_janin", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="gj-y" \/><Label htmlFor="gj-y">Ya, tindakan:<\/Label><\/div>\s*\{kala2\.gawat_janin === "Ya" && <Textarea className="ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.gawat_janin_tindakan \|\| ""\} onChange=\{e => updateKala2\("gawat_janin_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} rows=\{2\} \/>\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="gj-t" \/><Label htmlFor="gj-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala2.gawat_janin || "Tidak"} onValueChange={v => updateKala2("gawat_janin", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.gawat_janin === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Textarea className="w-full" value={kala2.gawat_janin_tindakan || ""} onChange={e => updateKala2("gawat_janin_tindakan", e.target.value)} disabled={isReadOnly} rows={2} /></div>}`
  );

  // 5. Distosia
  content = content.replace(
    /<RadioGroup value=\{kala2\.distosia \|\| "Tidak"\} onValueChange=\{v => updateKala2\("distosia", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="db-y" \/><Label htmlFor="db-y">Ya, tindakan:<\/Label><\/div>\s*\{kala2\.distosia === "Ya" && <Textarea className="ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala2\.distosia_tindakan \|\| ""\} onChange=\{e => updateKala2\("distosia_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} rows=\{2\} \/>\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="db-t" \/><Label htmlFor="db-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala2.distosia || "Tidak"} onValueChange={v => updateKala2("distosia", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala2.distosia === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Textarea className="w-full" value={kala2.distosia_tindakan || ""} onChange={e => updateKala2("distosia_tindakan", e.target.value)} disabled={isReadOnly} rows={2} /></div>}`
  );

  // 6. Tali Pusat
  content = content.replace(
    /<RadioGroup value=\{kala3\.tali_pusat \|\| "Tidak"\} onValueChange=\{v => updateKala3\("tali_pusat", v\)\} disabled=\{isReadOnly\} className="flex gap-4 mt-1">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="tp-y" \/><Label htmlFor="tp-y">Ya<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="tp-t" \/><Label htmlFor="tp-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala3.tali_pusat || "Tidak"} onValueChange={v => updateKala3("tali_pusat", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>`
  );

  // 7. Mengedan -> oksitosin
  content = content.replace(
    /<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Pemberian Oksitosin > 15 Menit<\/Label>\s*<RadioGroup value=\{kala3\.oksitosin \|\| "Tidak"\} onValueChange=\{v => updateKala3\("oksitosin", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="ok-y" \/><Label htmlFor="ok-y">Ya, alasan:<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="ok-t" \/><Label htmlFor="ok-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>\s*<\/div>/g,
    `<div className="space-y-2 border-b pb-3">
              <Label>Pemberian Oksitosin &gt; 15 Menit</Label>
              <Select value={kala3.oksitosin || "Tidak"} onValueChange={v => updateKala3("oksitosin", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>`
  );

  // 8. Penegangan
  content = content.replace(
    /<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Penegangan Tali Pusat Terkendali<\/Label>\s*<RadioGroup value=\{kala3\.penegangan \|\| "Tidak"\} onValueChange=\{v => updateKala3\("penegangan", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="pt-y" \/><Label htmlFor="pt-y">Ya<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="pt-t" \/><Label htmlFor="pt-t">Tidak, alasan:<\/Label><\/div>\s*<\/RadioGroup>\s*<\/div>/g,
    `<div className="space-y-2 border-b pb-3">
              <Label>Penegangan Tali Pusat Terkendali</Label>
              <Select value={kala3.penegangan || "Tidak"} onValueChange={v => updateKala3("penegangan", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>`
  );

  // 9. Masase
  content = content.replace(
    /<div className="flex items-center gap-4 border-b pb-2">\s*<Label className="w-48">Masase Fundus Uteri<\/Label>\s*<RadioGroup value=\{kala3\.masase \|\| "Tidak"\} onValueChange=\{v => updateKala3\("masase", v\)\} disabled=\{isReadOnly\} className="flex gap-4">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="mf-y" \/><Label htmlFor="mf-y">Ya<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="mf-t" \/><Label htmlFor="mf-t">Tidak, alasan:<\/Label><\/div>\s*<\/RadioGroup>\s*<\/div>/g,
    `<div className="space-y-2 border-b pb-3">
              <Label>Masase Fundus Uteri</Label>
              <Select value={kala3.masase || "Tidak"} onValueChange={v => updateKala3("masase", v)} disabled={isReadOnly}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>`
  );

  // 10. Plasenta lengkap
  content = content.replace(
    /<RadioGroup value=\{kala3\.plasenta_lengkap \|\| "Ya"\} onValueChange=\{v => updateKala3\("plasenta_lengkap", v\)\} disabled=\{isReadOnly\} className="flex gap-4 mt-1">\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Ya" id="pl-y" \/><Label htmlFor="pl-y">Ya<\/Label><\/div>\s*<div className="flex items-center space-x-1"><RadioGroupItem value="Tidak" id="pl-t" \/><Label htmlFor="pl-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala3.plasenta_lengkap || "Ya"} onValueChange={v => updateKala3("plasenta_lengkap", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>`
  );

  // 11. Plasenta lambat
  content = content.replace(
    /<RadioGroup value=\{kala3\.plasenta_lambat \|\| "Tidak"\} onValueChange=\{v => updateKala3\("plasenta_lambat", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="plm-y" \/><Label htmlFor="plm-y">Ya, tindakan:<\/Label><\/div>\s*\{kala3\.plasenta_lambat === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala3\.plasenta_tindakan \|\| ""\} onChange=\{e => updateKala3\("plasenta_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} \/>\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="plm-t" \/><Label htmlFor="plm-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala3.plasenta_lambat || "Tidak"} onValueChange={v => updateKala3("plasenta_lambat", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.plasenta_lambat === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Input className="h-9 w-full" value={kala3.plasenta_tindakan || ""} onChange={e => updateKala3("plasenta_tindakan", e.target.value)} disabled={isReadOnly} /></div>}`
  );

  // 12. Laserasi
  content = content.replace(
    /<RadioGroup value=\{kala3\.laserasi \|\| "Tidak"\} onValueChange=\{v => updateKala3\("laserasi", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center space-x-1 mb-1"><RadioGroupItem value="Ya" id="las-y" \/><Label htmlFor="las-y">Ya, dimana:<\/Label><\/div>\s*\{kala3\.laserasi === "Ya" && <Input className="h-8 ml-6 w-\[calc\(100%-1\.5rem\)\]" value=\{kala3\.laserasi_lokasi \|\| ""\} onChange=\{e => updateKala3\("laserasi_lokasi", e\.target\.value\)\} disabled=\{isReadOnly\} \/>\}\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="las-t" \/><Label htmlFor="las-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala3.laserasi || "Tidak"} onValueChange={v => updateKala3("laserasi", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.laserasi === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Lokasi:</Label><Input className="h-9 w-full" value={kala3.laserasi_lokasi || ""} onChange={e => updateKala3("laserasi_lokasi", e.target.value)} disabled={isReadOnly} /></div>}`
  );

  // 13. Atoni Uteri
  content = content.replace(
    /<RadioGroup value=\{kala3\.atoni_uteri \|\| "Tidak"\} onValueChange=\{v => updateKala3\("atoni_uteri", v\)\} disabled=\{isReadOnly\}>\s*<div className="flex items-center gap-2 mb-1 flex-wrap">\s*<RadioGroupItem value="Ya" id="au-y" \/><Label htmlFor="au-y">Ya, tindakan:<\/Label>\s*\{kala3\.atoni_uteri === "Ya" && <Input className="h-8 w-full mt-1" value=\{kala3\.atoni_tindakan \|\| ""\} onChange=\{e => updateKala3\("atoni_tindakan", e\.target\.value\)\} disabled=\{isReadOnly\} \/>\}\s*<\/div>\s*<div className="flex items-center space-x-1 mt-1"><RadioGroupItem value="Tidak" id="au-t" \/><Label htmlFor="au-t">Tidak<\/Label><\/div>\s*<\/RadioGroup>/g,
    `<Select value={kala3.atoni_uteri || "Tidak"} onValueChange={v => updateKala3("atoni_uteri", v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ya">Ya</SelectItem>
                    <SelectItem value="Tidak">Tidak</SelectItem>
                  </SelectContent>
                </Select>
                {kala3.atoni_uteri === "Ya" && <div className="mt-2"><Label className="text-xs text-muted-foreground mb-1 block">Tindakan:</Label><Input className="h-9 w-full" value={kala3.atoni_tindakan || ""} onChange={e => updateKala3("atoni_tindakan", e.target.value)} disabled={isReadOnly} /></div>}`
  );

  // Grid cols modifications
  content = content.replace(/grid grid-cols-1 md:grid-cols-2 gap-4/g, 'grid grid-cols-1 gap-6');
  content = content.replace(/grid grid-cols-1 md:grid-cols-2 gap-6/g, 'grid grid-cols-1 gap-6');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log("catatan-persalinan-form.tsx updated successfully");
}

modifyCatatan();
