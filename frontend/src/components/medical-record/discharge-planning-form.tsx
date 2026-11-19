import { Fragment, useEffect, useMemo, useState } from "react";
import { CheckSquare, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { employeesApi } from "@/lib/api";
import { type DischargePlanning, type DischargePlanningItem, medicalRecordsApi } from "@/lib/api/medical-records";
import { useAuthStore } from "@/lib/store";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "./tab-indicator";

interface DischargePlanningFormProps {
  visitId: number;
  readOnly?: boolean;
  footerSaveOnly?: boolean;
  externalData?: DischargePlanning | DischargePlanningItem[];
  useExternalData?: boolean;
}

interface DischargePlanningItemTemplate {
  no: string;
  criteria: string;
  defaultChecked: boolean;
  defaultOfficerName: string;
}

interface DischargePlanningSectionTemplate {
  code: string;
  title: string;
  items: DischargePlanningItemTemplate[];
}

interface DischargePlanningRow {
  id: string;
  sectionCode: string;
  sectionTitle: string;
  no: string;
  criteria: string;
  checked: boolean;
  officerName: string;
}

const DISCHARGE_PLANNING_TEMPLATE: DischargePlanningSectionTemplate[] = [
  {
    code: "A",
    title: "Informasi Kesehatan",
    items: [
      {
        no: "1",
        criteria: "Informasi tentang hasil asessmen pasien, diagnosis, tata laksana prognosis",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "2",
        criteria:
          "Rencana pemulangan pasien didiskusikan dengan keluarga atau penanggung jawab perawatan pasien di rumah",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "3",
        criteria: "Pemberitahuan rencana pemulangan pasien",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "4",
        criteria: "Tanda dan gejala dari penyakit yang diderita pasien yang perlu diwaspadai / dilaporkan",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "5",
        criteria: "Tindakan / pengobatan yang dapat dilakukan sebelum ke rumah sakit",
        defaultChecked: false,
        defaultOfficerName: "",
      },
    ],
  },
  {
    code: "B",
    title: "Edukasi Kesehatan untuk Pasien di rumah",
    items: [
      {
        no: "1",
        criteria: "Jenis aktivitas yang boleh dilakukan dan tidak boleh dilakukan",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "2",
        criteria: "Pelatihan untuk aktivitas dan penggunaan alat bantu",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "3",
        criteria: "Edukasi tentang nutrisi",
        defaultChecked: false,
        defaultOfficerName: "",
      },
    ],
  },
  {
    code: "C",
    title: "Persiapan Pemulangan",
    items: [
      {
        no: "1",
        criteria: "Tempat perawatan selanjutnya setelah pulang",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "2",
        criteria: "Obat untuk di rumah",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "3",
        criteria: "Alat bantu / peralatan kesehatan untuk di rumah",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "4",
        criteria: "Rencana kontrol (sertakan surat kontrol)",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "5",
        criteria: "Resume medis yang sudah terisi",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "6",
        criteria: "Alat transportasi yang digunakan untuk pulang (Ambulans kendaraan umum / mobil pribadi)",
        defaultChecked: false,
        defaultOfficerName: "",
      },
      {
        no: "7",
        criteria: "Kelengkapan administrasi",
        defaultChecked: false,
        defaultOfficerName: "",
      },
    ],
  },
];

const createDefaultRows = (): DischargePlanningRow[] => {
  return DISCHARGE_PLANNING_TEMPLATE.flatMap((section) =>
    section.items.map((item) => ({
      id: `${section.code}-${item.no}`,
      sectionCode: section.code,
      sectionTitle: section.title,
      no: item.no,
      criteria: item.criteria,
      checked: item.defaultChecked,
      officerName: item.defaultOfficerName,
    })),
  );
};

const getExternalPlanningItems = (externalData?: DischargePlanning | DischargePlanningItem[]) => {
  if (Array.isArray(externalData)) return externalData;
  return externalData?.items;
};

export function DischargePlanningForm({
  visitId,
  readOnly = false,
  footerSaveOnly = false,
  externalData,
  useExternalData = false,
}: DischargePlanningFormProps) {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const [rows, setRows] = useState<DischargePlanningRow[]>(() => createDefaultRows());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeName, setEmployeeName] = useState("");

  const userEmployeeName =
    ((user as unknown as { employee?: { nama_lengkap?: string } })?.employee?.nama_lengkap || "").trim();

  useEffect(() => {
    let active = true;

    if (userEmployeeName) {
      setEmployeeName(userEmployeeName);
      return () => {
        active = false;
      };
    }

    const employeeId = Number(user?.employee_id || 0);
    if (!employeeId) {
      setEmployeeName("");
      return () => {
        active = false;
      };
    }

    const loadEmployeeName = async () => {
      try {
        const response = await employeesApi.getById(employeeId);
        if (!active) return;
        setEmployeeName((response.data?.data?.nama_lengkap || "").trim());
      } catch {
        if (!active) return;
        setEmployeeName("");
      }
    };

    loadEmployeeName();

    return () => {
      active = false;
    };
  }, [user?.employee_id, userEmployeeName]);

  const mergeRowsFromApi = (items: DischargePlanningItem[] | undefined): DischargePlanningRow[] => {
    const defaults = createDefaultRows();
    if (!items || items.length === 0) return defaults;

    const mappedById = new Map(
      items.map((item) => [
        `${item.section_code}-${item.no}`,
        {
          checked: Boolean(item.checked),
          officerName: item.officer_name ?? "",
        },
      ]),
    );

    return defaults.map((row) => {
      const mapped = mappedById.get(row.id);
      if (!mapped) return row;
      return {
        ...row,
        checked: mapped.checked,
        officerName: mapped.officerName,
      };
    });
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = useExternalData ? null : await medicalRecordsApi.getDischargePlanning(visitId);
        if (!active) return;
        setRows(mergeRowsFromApi(useExternalData ? getExternalPlanningItems(externalData) : response?.data?.items));
        emitMedicalRecordTabSaved("discharge-planning", !useExternalData);
      } catch {
        if (!active) return;
        setRows(createDefaultRows());
        toast({
          title: "Gagal",
          description: "Data discharge planning tidak dapat dimuat dari server.",
          variant: "destructive",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [externalData, useExternalData, visitId, toast]);

  useEffect(() => {
    if (!employeeName || useExternalData) return;
    setRows((prev) =>
      prev.map((row) =>
        row.checked && !row.officerName.trim()
          ? {
              ...row,
              officerName: employeeName,
            }
          : row,
      ),
    );
  }, [employeeName, useExternalData]);

  const totalItems = rows.length;
  const checkedItems = rows.filter((row) => row.checked).length;

  const groupedRows = useMemo(() => {
    return DISCHARGE_PLANNING_TEMPLATE.map((section) => ({
      section,
      rows: rows.filter((row) => row.sectionCode === section.code),
    }));
  }, [rows]);

  const updateRow = (id: string, patch: Partial<Pick<DischargePlanningRow, "checked" | "officerName">>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    emitMedicalRecordTabSaved("discharge-planning", false);
  };

  const handleCheckChange = (id: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          checked,
          officerName: checked ? employeeName || row.officerName || "" : "",
        };
      }),
    );
    emitMedicalRecordTabSaved("discharge-planning", false);
  };

  useEffect(() => {
    emitMedicalRecordTabIndicator("discharge-planning", `${checkedItems}/${totalItems}`);
    if (useExternalData) emitMedicalRecordTabSaved("discharge-planning", false);
  }, [checkedItems, totalItems, useExternalData]);

  const handleReset = () => {
    setRows(createDefaultRows());
    emitMedicalRecordTabSaved("discharge-planning", false);
    toast({
      title: "Berhasil",
      description: "Checklist discharge planning dikembalikan ke template awal.",
    });
  };

  const handleCheckAll = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        checked: true,
        officerName: employeeName || row.officerName || "",
      })),
    );
    emitMedicalRecordTabSaved("discharge-planning", false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await medicalRecordsApi.saveDischargePlanning(visitId, {
        items: rows.map((row) => ({
          section_code: row.sectionCode,
          section_title: row.sectionTitle,
          no: row.no,
          criteria: row.criteria,
          checked: row.checked,
          officer_name: row.officerName,
        })),
      });

      emitMedicalRecordTabSaved("discharge-planning", true);
      toast({
        title: "Berhasil",
        description: "Discharge planning berhasil disimpan.",
      });
    } catch {
      toast({
        title: "Gagal",
        description: "Discharge planning gagal disimpan.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form
      className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      {/* Header Section */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Discharge Planning Rawat Inap
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Checklist pemulangan pasien. Nama petugas terisi otomatis dari data pegawai saat item dicentang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {checkedItems}/{totalItems} selesai
          </span>
          {!readOnly && !useExternalData && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 rounded-none text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCheckAll}
                className="h-8 rounded-none text-xs gap-1.5"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Tandai Semua
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
                  footerSaveOnly && "hidden",
                )}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Simpan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Checklist Table Section */}
      <div className="p-4 sm:p-5">
        <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                <th className="w-14 px-3 py-2 text-left">No</th>
                <th className="px-3 py-2 text-left">Kriteria Pemulangan</th>
                <th className="w-36 px-3 py-2 text-left">Checklist</th>
                <th className="w-72 px-3 py-2 text-left">Nama Petugas / TTD</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ section, rows: sectionRows }) => (
                <Fragment key={`section-${section.code}`}>
                  <tr className="bg-neutral-50/80 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                      {section.code}
                    </td>
                    <td
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100"
                      colSpan={3}
                    >
                      {section.title}
                    </td>
                  </tr>
                  {sectionRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50/40 dark:hover:bg-neutral-900/20 align-middle transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground leading-relaxed">{row.criteria}</td>
                      <td className="px-3 py-2.5">
                        <label
                          className={cn(
                            "inline-flex w-full items-center gap-2 border px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                            row.checked
                              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium"
                              : "border-neutral-200 dark:border-neutral-800 bg-background text-muted-foreground",
                            (readOnly || useExternalData) && "cursor-default opacity-75",
                          )}
                        >
                          <Checkbox
                            checked={row.checked}
                            disabled={readOnly || useExternalData}
                            onCheckedChange={(value) => handleCheckChange(row.id, Boolean(value))}
                            className="rounded-none"
                          />
                          <span>{row.checked ? "Sudah" : "Belum"}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={row.officerName}
                          disabled={readOnly || useExternalData || !row.checked}
                          onChange={(event) => updateRow(row.id, { officerName: event.target.value })}
                          placeholder={row.checked ? "Nama petugas / TTD" : "Centang checklist untuk isi otomatis"}
                          className="h-8 rounded-none text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
}
