const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'frontend', 'src', 'components', 'medical-record', 'bersalin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(f => {
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ FastInput as Input \} from "@\/components\/ui\/fast-input";/g, 'import { Input } from "@/components/ui/input";');
  content = content.replace(/import \{ FastTextarea as Textarea \} from "@\/components\/ui\/fast-textarea";/g, 'import { Textarea } from "@/components/ui/textarea";');
  fs.writeFileSync(file, content);
  console.log('Fixed ' + f);
});
