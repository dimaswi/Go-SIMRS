const fs = require('fs');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf-8');
  if (!content.includes('SelectTrigger')) {
    content = content.replace(
      /import \{ RadioGroup, RadioGroupItem \} from "\@\/components\/ui\/radio-group";/,
      `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";`
    );
  } else {
    content = content.replace(
      /import \{ RadioGroup, RadioGroupItem \} from "\@\/components\/ui\/radio-group";/,
      ''
    );
  }

  content = content.replace(/<RadioGroup[\s\S]*?<\/RadioGroup>/g, (match) => {
    // Extract value, onValueChange, disabled
    const valueMatch = match.match(/value=\{(.*?)\}/) || match.match(/value="(.*?)"/);
    const onValueChangeMatch = match.match(/onValueChange=\{(.*?)\}/);
    const disabledMatch = match.match(/disabled=\{([^}]*)\}/);

    // Extract items
    const itemMatches = [...match.matchAll(/<RadioGroupItem value="(.*?)"[\s\S]*?<Label[^>]*>(.*?)<\/Label>/g)];

    if (!valueMatch || !onValueChangeMatch) return match; // skip if complex

    const value = valueMatch[0];
    const onChange = onValueChangeMatch[0];
    const disabled = disabledMatch ? disabledMatch[0] : '';

    let selectItems = itemMatches.map(m => `                  <SelectItem value="${m[1]}">${m[2]}</SelectItem>`).join('\n');

    return `<Select ${value} ${onChange} ${disabled}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Silahkan Pilih" /></SelectTrigger>
                <SelectContent>
${selectItems}
                </SelectContent>
              </Select>`;
  });

  fs.writeFileSync(file, content);
  console.log('Processed', file);
}

processFile('c:/Users/User/Documents/Klinik Kedungadem/Go-SIMRS/frontend/src/components/medical-record/bersalin/skrining-risiko-form.tsx');
processFile('c:/Users/User/Documents/Klinik Kedungadem/Go-SIMRS/frontend/src/components/medical-record/bersalin/catatan-persalinan-form.tsx');
