const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (let file of list) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, files);
    } else {
      files.push(filePath);
    }
  }
  return files;
}

const allFiles = getFiles('e:/Golang/Go-SIMRS/frontend/src/pages');
const targets = allFiles.filter(f => f.endsWith('create.tsx') || f.endsWith('edit.tsx') || f.endsWith('show.tsx'));

let count = 0;

for (const file of targets) {
  if (file.includes('medicines')) continue; 
  
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  // 1. Replace employees create/edit style:
  // <div className="border border-border/70 bg-background">
  //   <div className="flex items-center gap-2 px-6 py-4">
  //     <Icon className="..." />
  //     <h3 className="text-sm font-medium">Title</h3>
  //   </div>
  //   <div className="px-6 pb-6">
  content = content.replace(/<div className="border border-border\/70 bg-background">\s*<div className="flex items-center gap-2 px-6 py-4">\s*<([A-Z][a-zA-Z0-9]+)[^>]*>\s*<h3 className="text-sm font-medium">([^<]+)<\/h3>\s*<\/div>\s*<div className="px-6 pb-6">/g, 
  (match, icon, title) => {
    return `<div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <${icon} className="h-3 w-3" />
            ${title}
          </div>
          <div className="p-3 sm:p-4">`;
  });

  // 2. Replace patients create/edit style:
  // <section className="pb-6">
  //   <div className="flex items-center gap-2 mb-4 pb-2 border-b">
  //     <Icon className="..." />
  //     <h3 className="text-sm font-semibold text-primary">
  //       DATA IDENTITAS
  //     </h3>
  //   </div>
  //   ...content...
  // </section>
  // This is multiline, regex might be tricky but we can try replacing the start and end of section.
  
  // First, replace the section start and heading:
  content = content.replace(/<section className="pb-6">\s*<div className="flex items-center gap-2 mb-4 pb-2 border-b">\s*<([A-Z][a-zA-Z0-9]+)[^>]*>\s*<h3 className="text-sm font-semibold text-primary">\s*([^<]+)\s*<\/h3>\s*<\/div>/g, 
  (match, icon, title) => {
    return `<div className="border border-border/70 bg-background mb-6">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
                <${icon} className="h-3 w-3" />
                ${title.trim()}
              </div>
              <div className="p-3 sm:p-4">`;
  });

  // Then replace the closing </section> with </div></div> 
  // ONLY if it previously matched a section. Wait, just replacing </section> globally is safe if we replaced all <section> tags.
  // Let's check if there are other <section> tags.
  content = content.replace(/<\/section>/g, '</div>\n            </div>');

  // 3. Replace patients show style:
  // <div className="mb-6">
  //   <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
  //     <User className="h-4 w-4" />
  //     IDENTITAS PASIEN
  //   </h3>
  content = content.replace(/<div className="mb-6">\s*<h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">\s*<([A-Z][a-zA-Z0-9]+)[^>]*>\s*([^<]+)\s*<\/h3>/g,
  (match, icon, title) => {
    return `<div className="border border-border/70 bg-background mb-6">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <${icon} className="h-3 w-3" />
              ${title.trim()}
            </div>
            <div className="p-3 sm:p-4">`;
  });
  
  // also replace <hr className="border-border/50 my-6" /> with nothing, since we use cards now.
  content = content.replace(/<hr className="border-border\/50 my-6" \/>/g, '');

  if (content !== original) {
    fs.writeFileSync(file, content);
    count++;
    console.log('Updated', file);
  }
}
console.log('Updated files:', count);
