// replace-table-panel.js
// Otomatisasi penggantian blok panel tabel master data dengan komponen TablePanel
// Jalankan dengan: node replace-table-panel.js
// Pastikan sudah membuat komponen TablePanel sebelum menjalankan script ini

const fs = require('fs');
const path = require('path');

// Pola: DataTable langsung di PageContent tanpa panel judul
const pageContentDataTableRegex = /(<PageContent>\s*)(<DataTable([\s\S]*?)\/>)(\s*<\/PageContent>)/g;

// Template pengganti, gunakan TablePanel

// Template div judul panel
function getPanelWithTitle(title, dataTableBlock) {
  return `<div className="border border-border/70 bg-background">
  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    ${title}
  </div>
  <div className="p-3 sm:p-4">
    ${dataTableBlock.trim()}
  </div>
</div>`;
}

// Fungsi utama
function replaceInFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let replaced = false;
  // Hanya tambahkan panel judul jika DataTable langsung di PageContent
  const newCode = code.replace(pageContentDataTableRegex, (match, openTag, dataTableBlock, props, closeTag) => {
    replaced = true;
    // Judul default, bisa diubah sesuai kebutuhan
    const title = "Data Tabel";
    return `${openTag}${getPanelWithTitle(title, dataTableBlock)}${closeTag}`;
  });
  if (replaced) {
    fs.writeFileSync(filePath, newCode, 'utf8');
    console.log(`Updated: ${filePath}`);
  } else {
    console.log(`No match: ${filePath}`);
  }
}

// Cari semua file index.tsx di pages
function findIndexFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(findIndexFiles(fullPath));
    } else if (file === 'index.tsx') {
      results.push(fullPath);
    }
  });
  return results;
}

// Jalankan
const pagesDir = path.join(__dirname, 'src', 'pages');
const files = findIndexFiles(pagesDir);
files.forEach(replaceInFile);

console.log('Selesai. Pastikan TablePanel sudah diimport di file yang diubah.');
