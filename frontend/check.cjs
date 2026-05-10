const fs = require('fs');
const path = require('path');

const pages = ['patients', 'employees', 'rooms', 'buildings', 'counters', 'ppk', 'procedures', 'clinical-packages', 'icd', 'regions', 'master-data'];
const basePath = 'e:/Golang/Go-SIMRS/frontend/src/pages';

const results = [];

pages.forEach(p => {
    const dir = path.join(basePath, p);
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir).filter(f => f.match(/^(index|create|edit|show)\.tsx$/));
    files.forEach(f => {
        const fileContent = fs.readFileSync(path.join(dir, f), 'utf-8');
        const hasPageShell = fileContent.includes('PageShell');
        const hasCard = fileContent.includes('border border-border/70 bg-background');
        const hasSticky = fileContent.includes('sticky bottom-0');
        
        results.push({ page: p, file: f, hasPageShell, hasCard, hasSticky });
    });
});

console.log(JSON.stringify(results, null, 2));
