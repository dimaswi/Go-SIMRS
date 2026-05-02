const fs = require('fs');
let content = fs.readFileSync('src/pages/eklaim-local/rm-duplicate-tab.tsx', 'utf8');
const startIndex = content.indexOf('  const handleSaveRMDuplicate = async () => {');
if (startIndex !== -1) {
  const replacement = `  const INLINE_PRIMARY_ACTION_REGEX = /^(simpan|final|kirim|tambah|tambahkan|selesai|simpan (triage|anamnesis|pemeriksaan|diagnosa|assessment|disposisi|order|cppt|balance|asuhan))/i;

  const handleSyncFromOriginal = async () => {
    if (!activeVisitId) {
      toast({ title: "Gagal", description: "Visit ID tidak ditemukan", variant: "destructive" });
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin menarik data dari RM Asli? Data casemix saat ini akan diganti seluruhnya.")) {
      return;
    }
    try {
      setSyncing(true);
      await eklaimLocalApi.syncClaimDataFromEKlaim(activeVisitId);
      toast({ title: "Berhasil", description: "Data berhasil ditarik dari RM Asli." });
      onSaved(); // trigger reload
    } catch (error) {
      toast({ title: "Gagal", description: "Gagal menarik data dari RM Asli", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const triggerActiveTabSave = (): boolean => {
    if (!activeSection) return false;

    const activePane = document.querySelector<HTMLElement>(\`[data-mr-tab-pane="\${activeSection}"]\`);
    if (!activePane) return false;

    // Check for form submit
    const activeForm = activePane.querySelector<HTMLFormElement>("form");
    if (activeForm) {
      activeForm.requestSubmit();
      return true;
    }

    // Check for inline save button
    const buttons = Array.from(activePane.querySelectorAll<HTMLButtonElement>("button"));
    const candidate = buttons.find((button) => {
      if (button.disabled) return false;
      const label = (button.textContent || "").trim().toLowerCase();
      return INLINE_PRIMARY_ACTION_REGEX.test(label);
    });

    if (candidate) {
      candidate.click();
      return true;
    }

    return false;
  };

  const handleSaveActiveTabFromFooter = () => {
    const saved = triggerActiveTabSave();
    if (!saved) {
      toast({
        title: "Simpan tidak tersedia",
        description: "Tab aktif tidak memiliki aksi simpan.",
        variant: "destructive",
      });
    }
  };

  return (
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
}
`;
  content = content.substring(0, startIndex) + replacement;
  fs.writeFileSync('src/pages/eklaim-local/rm-duplicate-tab.tsx', content);
  console.log('Successfully replaced layout!');
} else {
  console.log('Failed to find handleSaveRMDuplicate');
}
