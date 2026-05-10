const fs = require('fs');
const path = require('path');

const basePath = 'e:/Golang/Go-SIMRS/frontend/src/pages';
const pages = ['patients', 'employees', 'rooms', 'buildings', 'counters', 'ppk', 'procedures', 'clinical-packages', 'icd', 'regions', 'master-data'];

for (const p of pages) {
  const dir = path.join(basePath, p);
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir);
  
  files.forEach(f => {
    if (!f.match(/^(index|create|edit|show)\.tsx$/)) return;
    
    let content = fs.readFileSync(path.join(dir, f), 'utf-8');
    let changed = false;
    
    // index.tsx - Wrap DataTable in card
    if (f === 'index.tsx' && content.includes('<DataTable') && !content.includes('border border-border/70 bg-background')) {
        const titleRegex = /title="([^"]+)"/;
        const match = content.match(titleRegex);
        const title = match ? match[1].replace('Master ', '') : 'Data';
        
        content = content.replace(/<DataTable([\s\S]*?)\/>/, 
`<div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar ${title}
          </div>
          <div className="p-3 sm:p-4">
            <DataTable$1/>
          </div>
        </div>`);
        changed = true;
    }
    
    // create.tsx / edit.tsx - Replace sticky footer
    if ((f === 'create.tsx' || f === 'edit.tsx') && content.includes('sticky bottom-0')) {
        // Find the div containing "sticky bottom-0"
        const regex = /<div className="[^"]*sticky bottom-0[^"]*">([\s\S]*?)<\/div>\s*<\/form>/;
        const match = content.match(regex);
        
        if (match) {
            // we want to extract the cancel and submit actions. This is complex via regex.
            // A simpler approach is to just replace the div's className.
            content = content.replace(/(<div className=")[^"]*(sticky bottom-0)[^"]*(")/g, '$1sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur$3');
            
            // remove things like justify-between if we replaced the classes entirely.
            // Wait, the regex replace above replaces the ENTIRE className string.
            // Let's refine:
            content = content.replace(/className="[^"]*sticky bottom-0[^"]*"/g, 'className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur"');
            
            // Some buttons need rounded-none
            // Let's not break too much. Let's just fix the wrapper class.
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(path.join(dir, f), content);
    }
  });
}
