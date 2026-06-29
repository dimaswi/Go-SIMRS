const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/medical-record/disposition-form.tsx', 'utf-8');
content = content.replace('    // Validate admission_type for rawat_inap\n    if (formData.disposition_type === "rawat_inap" && !formData.admission_type) {\n      toast({\n        title: "Data tidak lengkap",\n        description: "Silakan pilih tipe rawat inap (Elektif atau Emergency).",\n        variant: "destructive",\n      });\n      return;\n    }\n', '');
content = content.replaceAll('admission_type: formData.admission_type,', 'admission_type: formData.admission_type || "elektif",');
fs.writeFileSync('frontend/src/components/medical-record/disposition-form.tsx', content);
