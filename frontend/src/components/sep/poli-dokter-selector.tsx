import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Building2,
  Stethoscope,
  Database,
} from "lucide-react";
import { bpjsApi, type BPJSPoliMapping, type BPJSDoctorMapping } from "@/lib/api/bpjs";
import { SearchModal } from "./search-modal";
import {
  BPJS_COMPACT_FIELD_CLASS,
  BPJS_FIELD_CLASS,
  BPJS_ICON_BUTTON_CLASS,
  BPJS_MUTED_PANEL_CLASS,
  BPJS_SHEET_MONO_FAMILY,
} from "./bpjs-sheet-chrome";

export type DataSourceTab = "bpjs" | "mapping";

interface PoliDokterSelectorProps {
  // Current values
  kodePoli: string;
  namaPoli: string;
  kodeDokter: string;
  namaDokter: string;
  tglRencanaKontrol: string;
  // Callbacks
  onPoliChange: (kode: string, nama: string) => void;
  onDokterChange: (kode: string, nama: string) => void;
  // BPJS API search handlers (passed from parent)
  searchPoliBPJS: (keyword: string) => Promise<any[]>;
  searchDokterBPJS: (keyword: string) => Promise<any[]>;
  // Customization
  disabled?: boolean;
  poliBPJSMinSearch?: number;
  dokterBPJSMinSearch?: number;
  poliModalTitle?: string;
  dokterModalTitle?: string;
  /** Compact mode for inline sections (bpjs-control-section) */
  compact?: boolean;
}

export function PoliDokterSelector({
  kodePoli,
  namaPoli,
  kodeDokter,
  namaDokter,
  tglRencanaKontrol,
  onPoliChange,
  onDokterChange,
  searchPoliBPJS,
  searchDokterBPJS,
  disabled = false,
  poliBPJSMinSearch = 2,
  dokterBPJSMinSearch = 1,
  poliModalTitle = "Cari Poli Kontrol BPJS",
  dokterModalTitle = "Cari Dokter Kontrol BPJS",
  compact = false,
}: PoliDokterSelectorProps) {
  const { toast } = useToast();

  // Switch state: false = BPJS API, true = Mapping Lokal
  const [useMapping, setUseMapping] = useState(false);
  const dataSource: DataSourceTab = useMapping ? "mapping" : "bpjs";

  // BPJS API modal states
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [dokterModalOpen, setDokterModalOpen] = useState(false);

  // Local mapping state
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [poliMappings, setPoliMappings] = useState<BPJSPoliMapping[]>([]);
  const [selectedPoliMappingId, setSelectedPoliMappingId] = useState<string>("");
  const [filteredDoctors, setFilteredDoctors] = useState<BPJSDoctorMapping[]>([]);

  // Fetch local mappings when switching to mapping
  const fetchMappings = useCallback(async () => {
    setLoadingMappings(true);
    try {
      const res = await bpjsApi.getPoliMappings({ is_active: true });
      setPoliMappings(res.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mengambil data mapping poli",
      });
    } finally {
      setLoadingMappings(false);
    }
  }, [toast]);

  useEffect(() => {
    if (useMapping && poliMappings.length === 0) {
      fetchMappings();
    }
  }, [useMapping, fetchMappings, poliMappings.length]);

  // Update filtered doctors when poli mapping changes
  useEffect(() => {
    if (selectedPoliMappingId && poliMappings.length > 0) {
      const pm = poliMappings.find((p) => p.id.toString() === selectedPoliMappingId);
      if (pm?.doctor_mappings) {
        setFilteredDoctors(pm.doctor_mappings.filter((d) => d.is_active));
      } else {
        setFilteredDoctors([]);
      }
    } else {
      setFilteredDoctors([]);
    }
  }, [selectedPoliMappingId, poliMappings]);

  // Handle switch toggle: reset selections
  const handleSwitchChange = (checked: boolean) => {
    setUseMapping(checked);
    onPoliChange("", "");
    onDokterChange("", "");
    setSelectedPoliMappingId("");
    setFilteredDoctors([]);
  };

  // Handle local poli selection (from combobox)
  const handleLocalPoliSelect = (poliMappingId: string) => {
    setSelectedPoliMappingId(poliMappingId);
    const pm = poliMappings.find((p) => p.id.toString() === poliMappingId);
    if (pm) {
      onPoliChange(pm.kode_poli_bpjs, pm.nama_poli_bpjs);
      onDokterChange("", "");
    } else {
      onPoliChange("", "");
      onDokterChange("", "");
    }
  };

  // Handle local dokter selection (from combobox)
  const handleLocalDokterSelect = (doctorMappingId: string) => {
    const dm = filteredDoctors.find((d) => d.id.toString() === doctorMappingId);
    if (dm) {
      onDokterChange(dm.kode_dokter_bpjs, dm.nama_dokter_bpjs);
    } else {
      onDokterChange("", "");
    }
  };

  // Combobox options for poli mappings
  const poliOptions: ComboboxOption[] = useMemo(
    () =>
      poliMappings.map((pm) => ({
        value: pm.id.toString(),
        label: `${pm.kode_poli_bpjs} - ${pm.nama_poli_bpjs} (${pm.room_name})`,
      })),
    [poliMappings]
  );

  // Combobox options for doctor mappings
  const dokterOptions: ComboboxOption[] = useMemo(
    () =>
      filteredDoctors.map((dm) => ({
        value: dm.id.toString(),
        label: `${dm.kode_dokter_bpjs} - ${dm.nama_dokter_bpjs}${dm.employee_name ? ` (${dm.employee_name})` : ""}`,
      })),
    [filteredDoctors]
  );

  // Switch row component
  const SwitchRow = ({ size = "default" }: { size?: "compact" | "default" }) => (
    <div className={`flex items-center justify-between ${size === "compact" ? "mb-3" : "mb-4"}`}>
      <div className="flex items-center gap-2">
        <Database className={size === "compact" ? "h-3.5 w-3.5 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
        <Label
          htmlFor="use-mapping-switch"
          className={`cursor-pointer select-none uppercase tracking-[0.18em] ${size === "compact" ? "text-[10px]" : "text-xs"} ${useMapping ? "text-foreground font-medium" : "text-muted-foreground"}`}
          style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}
        >
          Gunakan Mapping Lokal
        </Label>
      </div>
      <Switch
        id="use-mapping-switch"
        checked={useMapping}
        onCheckedChange={handleSwitchChange}
        disabled={disabled}
      />
    </div>
  );

  // BPJS API fields (compact)
  const BpjsFieldsCompact = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-1" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
          <Building2 className="h-3.5 w-3.5" />
          Poli Tujuan
        </Label>
        <div className="flex gap-2">
          <Input
            value={namaPoli || kodePoli}
            placeholder="Pilih poli..."
            readOnly
            className={`${BPJS_COMPACT_FIELD_CLASS} flex-1`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPoliModalOpen(true)}
            disabled={disabled}
            className={BPJS_ICON_BUTTON_CLASS}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-1" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
          <Stethoscope className="h-3.5 w-3.5" />
          Dokter
        </Label>
        <div className="flex gap-2">
          <Input
            value={namaDokter || kodeDokter}
            placeholder="Pilih dokter..."
            readOnly
            className={`${BPJS_COMPACT_FIELD_CLASS} flex-1`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setDokterModalOpen(true)}
            disabled={disabled || !kodePoli}
            className={BPJS_ICON_BUTTON_CLASS}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {!kodePoli && (
          <p className="text-xs text-muted-foreground">Pilih poli terlebih dahulu</p>
        )}
      </div>
    </div>
  );

  // Mapping fields (compact) — uses Combobox
  const MappingFieldsCompact = () => {
    if (loadingMappings) {
      return (
        <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data mapping...
        </div>
      );
    }
    if (poliMappings.length === 0) {
      return (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Belum ada mapping poli. Silakan atur di menu BPJS &gt; Mapping.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            Poli Tujuan
          </Label>
          <Combobox
            options={poliOptions}
            value={selectedPoliMappingId}
            onValueChange={handleLocalPoliSelect}
            placeholder="Cari poli mapping..."
            searchPlaceholder="Ketik nama poli..."
            emptyText="Poli tidak ditemukan"
            disabled={disabled}
            loading={loadingMappings}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm flex items-center gap-1">
            <Stethoscope className="h-3.5 w-3.5" />
            Dokter
          </Label>
          <Combobox
            options={dokterOptions}
            value={filteredDoctors.find((d) => d.kode_dokter_bpjs === kodeDokter)?.id.toString() || ""}
            onValueChange={handleLocalDokterSelect}
            placeholder={selectedPoliMappingId ? "Cari dokter..." : "Pilih poli terlebih dahulu"}
            searchPlaceholder="Ketik nama dokter..."
            emptyText="Dokter tidak ditemukan"
            disabled={disabled || !selectedPoliMappingId}
          />
          {!selectedPoliMappingId && (
            <p className="text-xs text-muted-foreground">Pilih poli terlebih dahulu</p>
          )}
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <>
        <div className="w-full">
          <SwitchRow size="compact" />
          {dataSource === "bpjs" ? <BpjsFieldsCompact /> : <MappingFieldsCompact />}
        </div>

        <SearchModal
          open={poliModalOpen}
          onOpenChange={setPoliModalOpen}
          title={poliModalTitle}
          placeholder="Ketik nama poli..."
          columns={[
            { key: "kode", label: "Kode", width: "100px" },
            { key: "nama", label: "Nama Poli" },
          ]}
          onSearch={searchPoliBPJS}
          onSelect={(item) => {
            onPoliChange(item.kode, item.nama);
            onDokterChange("", "");
          }}
          minSearchLength={poliBPJSMinSearch}
        />
        <SearchModal
          open={dokterModalOpen}
          onOpenChange={setDokterModalOpen}
          title={dokterModalTitle}
          placeholder="Ketik nama dokter..."
          columns={[
            { key: "kode", label: "Kode", width: "100px" },
            { key: "nama", label: "Nama Dokter" },
          ]}
          onSearch={searchDokterBPJS}
          onSelect={(item) => {
            onDokterChange(item.kode, item.nama);
          }}
          minSearchLength={dokterBPJSMinSearch}
        />
      </>
    );
  }

  // Full layout for Sheet forms (surat-kontrol, spri)
  return (
    <>
      <div className="w-full space-y-4">
        <SwitchRow />

        {dataSource === "bpjs" ? (
          <>
            {/* Poli Kontrol — BPJS API */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Poli Kontrol <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={namaPoli ? `${kodePoli} - ${namaPoli}` : ""}
                  placeholder="Pilih poli kontrol"
                  readOnly
                  className={`${BPJS_FIELD_CLASS} bg-muted/20 cursor-pointer`}
                  onClick={() => !disabled && setPoliModalOpen(true)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPoliModalOpen(true)}
                  disabled={disabled}
                  className={BPJS_ICON_BUTTON_CLASS}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Dokter Kontrol — BPJS API */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                Dokter Kontrol <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={namaDokter ? `${kodeDokter} - ${namaDokter}` : ""}
                  placeholder={kodePoli && tglRencanaKontrol ? "Pilih dokter kontrol" : "Pilih poli & tanggal dulu"}
                  readOnly
                  className={`${BPJS_FIELD_CLASS} bg-muted/20 cursor-pointer`}
                  onClick={() => !disabled && kodePoli && tglRencanaKontrol && setDokterModalOpen(true)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDokterModalOpen(true)}
                  disabled={disabled || !kodePoli || !tglRencanaKontrol}
                  className={BPJS_ICON_BUTTON_CLASS}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {(!kodePoli || !tglRencanaKontrol) && (
                <p className="text-xs text-amber-600">
                  Pilih poli dan tanggal kontrol terlebih dahulu untuk mencari dokter
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {loadingMappings ? (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Memuat data mapping...
              </div>
            ) : poliMappings.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <Database className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Belum ada mapping poli. Silakan atur di menu <strong>BPJS &gt; Mapping</strong>.
                </p>
                <Button variant="outline" size="sm" onClick={fetchMappings}>
                  <Loader2 className="h-3.5 w-3.5 mr-1" />
                  Muat Ulang
                </Button>
              </div>
            ) : (
              <>
                {/* Poli dari Mapping — Searchable Combobox */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Poli Kontrol <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    options={poliOptions}
                    value={selectedPoliMappingId}
                    onValueChange={handleLocalPoliSelect}
                    placeholder="Cari poli mapping..."
                    searchPlaceholder="Ketik nama poli..."
                    emptyText="Poli tidak ditemukan"
                    disabled={disabled}
                    loading={loadingMappings}
                    className={BPJS_FIELD_CLASS}
                  />
                  {kodePoli && (
                    <p className="text-xs text-muted-foreground">
                      Kode BPJS: <strong>{kodePoli}</strong> — {namaPoli}
                    </p>
                  )}
                </div>

                {/* Dokter dari Mapping — Searchable Combobox */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.18em] flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Dokter Kontrol <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    options={dokterOptions}
                    value={filteredDoctors.find((d) => d.kode_dokter_bpjs === kodeDokter)?.id.toString() || ""}
                    onValueChange={handleLocalDokterSelect}
                    placeholder={selectedPoliMappingId ? "Cari dokter mapping..." : "Pilih poli terlebih dahulu"}
                    searchPlaceholder="Ketik nama dokter..."
                    emptyText="Dokter tidak ditemukan"
                    disabled={disabled || !selectedPoliMappingId}
                    className={BPJS_FIELD_CLASS}
                  />
                  {!selectedPoliMappingId && (
                    <p className="text-xs text-amber-600">
                      Pilih poli terlebih dahulu untuk melihat daftar dokter
                    </p>
                  )}
                  {kodeDokter && (
                    <p className="text-xs text-muted-foreground">
                      Kode BPJS: <strong>{kodeDokter}</strong> — {namaDokter}
                    </p>
                  )}
                </div>

                <p className={`${BPJS_MUTED_PANEL_CLASS} p-3 text-xs text-muted-foreground`}>
                  Data diambil dari mapping lokal yang sudah dikonfigurasi di menu BPJS &gt; Mapping.
                  Pastikan mapping sudah ter-update.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* Search Modals for BPJS API mode */}
      <SearchModal
        open={poliModalOpen}
        onOpenChange={setPoliModalOpen}
        title={poliModalTitle}
        placeholder="Ketik nama poli..."
        columns={[
          { key: "kode", label: "Kode", width: "120px" },
          { key: "nama", label: "Nama Poli" },
        ]}
        onSearch={searchPoliBPJS}
        onSelect={(item) => {
          onPoliChange(item.kode, item.nama);
          onDokterChange("", "");
        }}
        minSearchLength={poliBPJSMinSearch}
      />
      <SearchModal
        open={dokterModalOpen}
        onOpenChange={setDokterModalOpen}
        title={dokterModalTitle}
        placeholder="Ketik nama dokter..."
        columns={[
          { key: "kode", label: "Kode", width: "120px" },
          { key: "nama", label: "Nama Dokter" },
        ]}
        onSearch={searchDokterBPJS}
        onSelect={(item) => {
          onDokterChange(item.kode, item.nama);
        }}
        minSearchLength={dokterBPJSMinSearch}
      />
    </>
  );
}
