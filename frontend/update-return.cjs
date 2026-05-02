const fs = require('fs');
let content = fs.readFileSync('src/pages/eklaim-local/rm-duplicate-tab.tsx', 'utf8');
const lines = content.split('\n');
const returnIdx = lines.findIndex((l, i) => l.includes('return (') && lines[i+1] && lines[i+1].includes('className="space-y-0"'));

if (returnIdx !== -1) {
  const replacement = `  return (
    <div className="medical-record-workspace flex h-full min-h-0 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4">
      <div className="mr-shell grid min-h-0 flex-1 gap-0 border xl:grid-cols-[minmax(240px,15%)_minmax(0,85%)] 2xl:grid-cols-[minmax(260px,15%)_minmax(0,85%)]">
        <aside className="mr-sidebar min-h-0 min-w-0 border-r">
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="min-h-[190px] shrink-0 basis-[30%] border-b">
              {visit ? <PatientInfo visit={visit} variant="compact" /> : <div className="p-4 text-xs text-muted-foreground">Data pasien tidak tersedia</div>}
            </div>
            <div className="min-h-0 flex-1 basis-[70%] overflow-y-auto p-2 space-y-0.5">
              {visibleSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const status = sectionStatus(section.id);
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] rounded-md transition-colors",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate flex-1 leading-tight">{section.label}</span>
                    {status.count != null && status.count > 0 && (
                      <Badge variant="secondary" className="h-4 text-[10px] px-1 shrink-0">
                        {status.count}
                      </Badge>
                    )}
                    {status.count == null && status.filled && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="mr-main flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
          <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              RM Casemix
              {dirty && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">Unsaved Changes</Badge>}
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                onClick={handleSyncFromOriginal}
                disabled={syncing || submitting}
              >
                {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />}
                Ambil Data dari RM Asli
              </Button>
            </div>
          </div>

          <div ref={tabsScrollRef} className="mr-content min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {visibleSections.map(section => (
              <div
                key={section.id}
                data-mr-tab-pane={section.id}
                className={section.id === activeSection ? "mr-pane" : "hidden"}
              >
                {section.id === activeSection && renderSectionContent()}
              </div>
            ))}
          </div>

          <div className="mr-footer sticky bottom-0 z-20 shrink-0 border-t bg-background px-3 py-2 sm:px-4">
            <div className="flex items-center justify-between">
               <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {!rmDuplicate && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  {rmDuplicate ? "Data Casemix aktif" : "Belum ada data casemix"}
               </div>
               <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => window.location.reload()}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Batal
                </Button>
                <Button size="sm" className="h-8 rounded-none" onClick={handleSaveActiveTabFromFooter} disabled={syncing || submitting}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Simpan Casemix
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      <Dialog
        open={
          quickAddOrderType === "laboratory" ||
          quickAddOrderType === "radiology" ||
          quickAddOrderType === "consultation" ||
          quickAddOrderType === "surgery"
        }
        onOpenChange={(open) => {
          if (!open) closeQuickAddDialog();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {quickAddOrderType === "laboratory"
                ? "Tambah Order + Tindakan Laboratorium"
                : quickAddOrderType === "radiology"
                  ? "Tambah Order + Tindakan Radiologi"
                  : quickAddOrderType === "surgery"
                    ? "Tambah Order + Tindakan Operasi"
                    : "Tambah Order + Tindakan Konsultasi"}
            </DialogTitle>
            <DialogDescription>
              Pilih satu atau lebih tindakan. Setiap tindakan yang dipilih akan masuk ke order yang sama. Klik <strong>Order Baru</strong> untuk mulai order berbeda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(() => {
              const existingFakeOrders = quickAddOrderType
                ? orders.filter((o) => o.order_type === quickAddOrderType && o.is_fake)
                : [];
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Tambah ke:</span>
                  {existingFakeOrders.map((o, idx) => {
                    const label = o.order_number ? o.order_number : \`Order Baru \${idx + 1}\`;
                    const isActive = quickAddFakeDate !== null && o.fake_date === quickAddFakeDate;
                    return (
                      <button
                        key={o.fake_date || idx}
                        type="button"
                        onClick={() => {
                          setQuickAddFakeDate(o.fake_date || null);
                          setQuickAddAddedNames([]);
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-muted/80 border-border",
                        )}
                      >
                        {label} ({(o.items || []).length} tindakan)
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddFakeDate(null);
                      setQuickAddAddedNames([]);
                    }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      quickAddFakeDate === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted hover:bg-muted/80 border-border",
                    )}
                  >
                    + Order Baru
                  </button>
                </div>
              );
            })()}

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 text-sm"
                placeholder={
                  quickAddOrderType === "laboratory"
                    ? "Cari tindakan laboratorium..."
                    : quickAddOrderType === "radiology"
                      ? "Cari tindakan radiologi..."
                      : quickAddOrderType === "surgery"
                        ? "Cari tindakan operasi..."
                        : "Cari tindakan konsultasi..."
                }
                value={procSearchTerm}
                onChange={(e) =>
                  quickAddOrderType && handleProcSearch(e.target.value, quickAddOrderType)
                }
              />
            </div>

            {searchingProcs && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Mencari tindakan...
              </div>
            )}

            {!searchingProcs && procSearchTerm.length >= 2 && procSearchResults.length === 0 && (
              <p className="text-xs text-muted-foreground">Tindakan tidak ditemukan.</p>
            )}

            {!searchingProcs && procSearchResults.length > 0 && (
              <div className="max-h-52 overflow-y-auto border rounded divide-y bg-white">
                {procSearchResults.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    disabled={loadingParams}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50"
                    onClick={() =>
                      quickAddOrderType &&
                      handleQuickAddProcedureToType(quickAddOrderType, proc)
                    }
                  >
                    {loadingParams ? (
                      <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                    ) : null}
                    <p className="text-sm font-medium inline">{proc.name}</p>
                    <p className="text-xs text-muted-foreground">{proc.code || "-"}</p>
                  </button>
                ))}
              </div>
            )}

            {quickAddAddedNames.length > 0 && (
              <div className="border rounded p-2 bg-green-50 space-y-1">
                <p className="text-xs font-medium text-green-700">
                  Tindakan ditambahkan ({quickAddAddedNames.length}):
                </p>
                {quickAddAddedNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-green-800">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={closeQuickAddDialog}>
                Selesai
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kembalikan dari RM Asli?</DialogTitle>
            <DialogDescription>
              Perubahan edit pada RM Duplikat akan ditimpa oleh data RM Asli dari kunjungan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={syncing || submitting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRestoreFromOriginal}
              disabled={syncing || submitting}
            >
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Preview Modal */}
      <Dialog open={showMappingModal} onOpenChange={setShowMappingModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Mapping Billing ke Tarif E-Klaim</DialogTitle>
            <DialogDescription>
              Berikut adalah breakdown bagaimana billing duplikat akan di-mapping ke komponen tarif E-Klaim
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const mappingData = calculateTarifMapping();
            if (!mappingData) {
              return (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Belum ada data billing untuk dipetakan
                </p>
              );
            }

            const { mapping, details, total } = mappingData;

            return (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Detail Mapping Per Item</h3>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="px-3">Item Billing</TableHead>
                          <TableHead className="px-3 w-32">Tipe</TableHead>
                          <TableHead className="px-3 text-right w-32">Jumlah</TableHead>
                          <TableHead className="px-3 w-40">Dipetakan ke</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.map((detail, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="px-3">{detail.item}</TableCell>
                            <TableCell className="px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {detail.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 text-right font-mono">
                              {detail.amount}
                            </TableCell>
                            <TableCell className="px-3">
                              <Badge variant="secondary" className="text-[10px]">
                                {detail.mappedTo}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Ringkasan Tarif E-Klaim</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Prosedur Non Bedah', mapping.prosedurNonBedah],
                      ['Prosedur Bedah', mapping.prosedurBedah],
                      ['Konsultasi', mapping.konsultasi],
                      ['Tenaga Ahli', mapping.tenagaAhli],
                      ['Keperawatan', mapping.keperawatan],
                      ['Penunjang', mapping.penunjang],
                      ['Radiologi', mapping.radiologi],
                      ['Laboratorium', mapping.laboratorium],
                      ['Pelayanan Darah', mapping.pelayananDarah],
                      ['Rehabilitasi', mapping.rehabilitasi],
                      ['Kamar / Akomodasi', mapping.kamar],
                      ['Rawat Intensif', mapping.rawatIntensif],
                      ['Obat', mapping.obat],
                      ['Obat Kronis', mapping.obatKronis],
                      ['Obat Kemoterapi', mapping.obatKemoterapi],
                      ['Alkes', mapping.alkes],
                      ['BMHP', mapping.bmhp],
                      ['Sewa Alat', mapping.sewaAlat],
                    ].filter(([_, val]) => val > 0).map(([label, val]) => (
                      <div key={label} className="flex justify-between items-center py-2 px-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-mono font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-base font-semibold text-emerald-900">Total Tarif RS</span>
                  <span className="text-xl font-mono font-bold text-emerald-900">
                    {total}
                  </span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}`;
  const newContent = lines.slice(0, returnIdx).join('\n') + '\n' + replacement + '\n}\n';
  fs.writeFileSync('src/pages/eklaim-local/rm-duplicate-tab.tsx', newContent);
  console.log('Successfully replaced return statement!');
} else {
  console.log('Return statement not found!');
}
