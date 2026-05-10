const fs = require('fs');
const p = 'e:/Golang/Go-SIMRS/frontend/src/pages/ppk/index.tsx';
let c = fs.readFileSync(p, 'utf-8');

// I need to replace the broken DataTable syntax.
// The broken part starts with <DataTable and ends with } /> or similar before </PageContent>.
// Let's just find the closing tag.
const start = c.indexOf('<DataTable');
const end = c.indexOf('</PageContent>', start);

if (start !== -1 && end !== -1) {
    const replacement = `<DataTable
              tableId="master-ppk"
              columns={columns}
              data={rows}
              searchPlaceholder="Cari kode/nama PPK..."
              searchSlot={
                <div className="flex items-center gap-2 pl-2">
                  <Label className="text-xs text-muted-foreground">Tampilkan nonaktif</Label>
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                </div>
              }
            />
          </div>
        </div>
      `;
    c = c.substring(0, start) + replacement + c.substring(end);
    fs.writeFileSync(p, c);
}
