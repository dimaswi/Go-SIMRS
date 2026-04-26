import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { employeesApi } from "@/lib/api";
import { type DischargePlanningItem, medicalRecordsApi } from "@/lib/api/medical-records";
import { useAuthStore } from "@/lib/store";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "./tab-indicator";

interface DischargePlanningFormProps {
  visitId: number;
  readOnly?: boolean;
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

export function DischargePlanningForm({ visitId, readOnly = false }: DischargePlanningFormProps) {
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
        const response = await medicalRecordsApi.getDischargePlanning(visitId);
        if (!active) return;
        setRows(mergeRowsFromApi(response.data?.items));
        emitMedicalRecordTabSaved("discharge-planning", true);
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
  }, [visitId, toast]);

  useEffect(() => {
    if (!employeeName) return;
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
  }, [employeeName]);

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
  }, [checkedItems, totalItems]);

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
      <div className="p-4 border rounded-md">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat discharge planning...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold">Discharge Planning Rawat Inap</p>
          <p className="text-xs text-muted-foreground">
            Checklist pemulangan pasien. Nama petugas terisi otomatis dari data pegawai saat item dicentang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium">
            {checkedItems}/{totalItems} selesai
          </span>
          {!readOnly && (
            <>
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCheckAll}>
                Tandai Semua
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="sticky top-0 z-10 border-b bg-background">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-[90px]">No</th>
              <th className="px-4 py-3 text-left font-semibold">Kriteria Pemulangan</th>
              <th className="px-4 py-3 text-left font-semibold w-[180px]">Checklist</th>
              <th className="px-4 py-3 text-left font-semibold w-[320px]">Nama Petugas / TTD</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map(({ section, rows: sectionRows }) => (
              <Fragment key={`section-${section.code}`}>
                <tr className="border-b">
                  <td className="px-4 py-2.5 font-semibold">{section.code}</td>
                  <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                    {section.title}
                  </td>
                </tr>
                {sectionRows.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-b-0">
                    <td className="px-4 py-3 text-muted-foreground">{row.no}</td>
                    <td className="px-4 py-3 leading-relaxed">{row.criteria}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 rounded-md border px-2.5 py-2">
                        <Checkbox
                          checked={row.checked}
                          disabled={readOnly}
                          onCheckedChange={(value) => handleCheckChange(row.id, Boolean(value))}
                        />
                        <Label className="text-xs text-muted-foreground">{row.checked ? "Sudah" : "Belum"}</Label>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={row.officerName}
                        disabled={readOnly || !row.checked}
                        onChange={(event) => updateRow(row.id, { officerName: event.target.value })}
                        placeholder={row.checked ? "Nama petugas / TTD" : "Centang checklist untuk isi otomatis"}
                        className="h-9"
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
  );
}
