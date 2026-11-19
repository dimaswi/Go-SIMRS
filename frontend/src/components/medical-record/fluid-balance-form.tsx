import { useState, useEffect, useCallback } from "react";
import { useImmer } from "use-immer";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fluidBalanceApi, medicinesApi, SHIFT_TYPES } from "@/lib/api";
import type { FluidBalance, CreateFluidBalanceInput, Medicine } from "@/lib/api";
import { format } from "date-fns";
import { Loader2, Plus, Droplets, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";
import { cn } from "@/lib/utils";

interface FluidBalanceFormProps {
  visitId: number;
  readOnly?: boolean;
  externalData?: FluidBalance[];
  useExternalData?: boolean;
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (id: number, name: string) => void;
  onSetApprovedBy?: (id: number, name: string) => void;
}

function FluidBalanceCollapsibleRow({
  balance,
  onEdit,
  readOnly,
}: {
  balance: FluidBalance;
  onEdit: (balance: FluidBalance) => void;
  readOnly: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const intakeTotal = (balance.oral_drink || 0) + (balance.oral_food || 0) + (balance.oral_medicine || 0) + (balance.iv_fluid || 0) + (balance.iv_medicine || 0) + (balance.blood_product || 0) + (balance.enteral_feed || 0) + (balance.other_intake || 0);
  const outputTotal = (balance.urine_amount || 0) + (balance.feces_amount || 0) + (balance.vomit_amount || 0) + (balance.drain_amount || 0) + (balance.blood_loss || 0) + (balance.iwl || 0) + (balance.other_output || 0);

  const getParenteralLabel = () => {
    if (!balance.other_intake_note) return "Parenteral";
    const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Parenteral - "));
    if (matched.length > 0) return matched.join(", ");
    if (balance.iv_fluid && !balance.other_intake_note.includes("Parenteral - ") && !balance.other_intake_note.includes("Intravena - ") && !balance.other_intake_note.includes("Darah - ")) {
      return `Parenteral - ${balance.other_intake_note}`;
    }
    return "Parenteral";
  };

  const getIVLabel = () => {
    if (!balance.other_intake_note) return "Obat Intravena";
    const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Intravena - "));
    if (matched.length > 0) return matched.join(", ");
    if (balance.iv_medicine && !balance.other_intake_note.includes("Parenteral - ") && !balance.other_intake_note.includes("Intravena - ") && !balance.other_intake_note.includes("Darah - ")) {
      return `Intravena - ${balance.other_intake_note}`;
    }
    return "Obat Intravena";
  };

  const getBloodLabel = () => {
    if (!balance.other_intake_note) return "Darah";
    const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Darah - "));
    return matched.length > 0 ? matched.join(", ") : "Darah";
  };

  const netBalance = intakeTotal - outputTotal;

  return (
    <tbody className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors align-middle">
        <td className="px-3 py-2.5 w-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </td>
        <td className="px-3 py-2.5 font-mono font-medium text-foreground whitespace-nowrap">
          {format(new Date(balance.record_date), "dd/MM/yyyy")}
        </td>
        <td className="px-3 py-2.5 capitalize whitespace-nowrap">{balance.shift_type}</td>
        <td className="px-3 py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">
          +{intakeTotal} ml
        </td>
        <td className="px-3 py-2.5 font-mono font-semibold text-destructive text-right whitespace-nowrap">
          -{outputTotal} ml
        </td>
        <td className="px-3 py-2.5 font-mono font-semibold text-right whitespace-nowrap">
          <span className={netBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : netBalance < 0 ? "text-destructive" : "text-foreground"}>
            {netBalance > 0 ? "+" : ""}{netBalance} ml
          </span>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
              title="Edit"
              onClick={() => onEdit(balance)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-neutral-50/30 dark:bg-neutral-900/20">
          <td colSpan={7} className="px-4 py-3.5 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-3 space-y-2">
                <h4 className="border-l-2 border-emerald-600 pl-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Detail Intake
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {(balance.oral_drink || 0) > 0 && <><span className="text-muted-foreground">Minuman</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.oral_drink} ml</span></>}
                  {(balance.oral_food || 0) > 0 && <><span className="text-muted-foreground">Makanan</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.oral_food} ml</span></>}
                  {(balance.oral_medicine || 0) > 0 && <><span className="text-muted-foreground">Obat Oral</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.oral_medicine} ml</span></>}
                  {(balance.iv_fluid || 0) > 0 && <><span className="text-muted-foreground">{getParenteralLabel()}</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.iv_fluid} ml</span></>}
                  {(balance.iv_medicine || 0) > 0 && <><span className="text-muted-foreground">{getIVLabel()}</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.iv_medicine} ml</span></>}
                  {(balance.blood_product || 0) > 0 && <><span className="text-muted-foreground">{getBloodLabel()}</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.blood_product} ml</span></>}
                  {(balance.enteral_feed || 0) > 0 && <><span className="text-muted-foreground">NGT</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.enteral_feed} ml</span></>}
                  {(balance.other_intake || 0) > 0 && <><span className="text-muted-foreground">Lainnya</span><span className="font-mono text-right text-emerald-600 dark:text-emerald-400">{balance.other_intake} ml</span></>}
                </div>
                {balance.other_intake_note && (
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Catatan Intake: </span>
                    <span className="italic text-muted-foreground">{balance.other_intake_note}</span>
                  </div>
                )}
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-3 space-y-2">
                <h4 className="border-l-2 border-destructive pl-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Detail Output
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {(balance.urine_amount || 0) > 0 && <><span className="text-muted-foreground">Urine {balance.urine_color ? `(${balance.urine_color})` : ""} {balance.urine_catheter ? "[Catheter]" : ""}</span><span className="font-mono text-right text-destructive">{balance.urine_amount} ml</span></>}
                  {(balance.feces_amount || 0) > 0 && <><span className="text-muted-foreground">Feses {balance.feces_type ? `(${balance.feces_type})` : ""}</span><span className="font-mono text-right text-destructive">{balance.feces_amount} ml</span></>}
                  {(balance.vomit_amount || 0) > 0 && <><span className="text-muted-foreground">Muntah</span><span className="font-mono text-right text-destructive">{balance.vomit_amount} ml</span></>}
                  {(balance.drain_amount || 0) > 0 && <><span className="text-muted-foreground">Drain {balance.drain_type ? `(${balance.drain_type})` : ""}</span><span className="font-mono text-right text-destructive">{balance.drain_amount} ml</span></>}
                  {(balance.blood_loss || 0) > 0 && <><span className="text-muted-foreground">Perdarahan</span><span className="font-mono text-right text-destructive">{balance.blood_loss} ml</span></>}
                  {(balance.other_output || 0) > 0 && <><span className="text-muted-foreground">Lainnya (NGT)</span><span className="font-mono text-right text-destructive">{balance.other_output} ml</span></>}
                  {(balance.iwl || 0) > 0 && <><span className="text-muted-foreground">IWL</span><span className="font-mono text-right text-destructive">{balance.iwl} ml</span></>}
                </div>
              </div>
            </div>

            {balance.notes && (
              <div className="p-2.5 border border-neutral-200 dark:border-neutral-800 bg-background text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Catatan Keseluruhan: </span>
                <span className="text-foreground">{balance.notes}</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </tbody>
  );
}








const defaultFormData: CreateFluidBalanceInput = {
  record_date: format(new Date(), "yyyy-MM-dd"),
  shift_type: "pagi",
  oral_drink: 0,
  oral_food: 0,
  oral_medicine: 0,
  iv_fluid: 0,
  iv_medicine: 0,
  blood_product: 0,
  enteral_feed: 0,
  other_intake: 0,
  other_intake_note: "",
  urine_amount: 0,
  urine_color: "",
  urine_catheter: false,
  feces_amount: 0,
  feces_freq: 0,
  feces_type: "",
  vomit_amount: 0,
  vomit_freq: 0,
  drain_amount: 0,
  drain_type: "",
  drain_color: "",
  blood_loss: 0,
  blood_loss_note: "",
  iwl: 0,
  other_output: 0,
  other_output_note: "",
  notes: "",
};

const PARENTERAL_CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: "Kristaloid", label: "Kristaloid" },
  { value: "Koloid", label: "Koloid" },
  { value: "Nutrisi Parenteral", label: "Nutrisi Parenteral" },
  { value: "Elektrolit", label: "Elektrolit" },
  { value: "Cairan Maintenance", label: "Cairan Maintenance" },
  { value: "Cairan Resusitasi", label: "Cairan Resusitasi" },
];

const BLOOD_CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: "Darah - Package Red Cell", label: "Darah - Package Red Cell" },
  { value: "Darah - Whole Blood", label: "Darah - Whole Blood" },
  { value: "Darah - Fresh Frozen Plasma", label: "Darah - Fresh Frozen Plasma" },
  { value: "Darah - Trombosit Concentrate", label: "Darah - Trombosit Concentrate" },
];

export function FluidBalanceForm({
  visitId,
  readOnly = false,
  externalData,
  useExternalData = false,
}: FluidBalanceFormProps) {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<FluidBalance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateFluidBalanceInput>(defaultFormData);
  
  const [ivMedicineOptions, setIvMedicineOptions] = useState<ComboboxOption[]>([]);
  const [ivMedicineSearch, setIvMedicineSearch] = useState("");
  const [ivMedicineLoading, setIvMedicineLoading] = useState(false);
  // Intake/Output detail state for UI only (not persisted)
  // Use any[] for detail arrays to avoid TS union issues
  const [intakeDetails, updateIntakeDetails] = useImmer<any[]>([
    { type: "oral", label: "Oral", value: 0 },
    { type: "ngt", label: "NGT", value: 0 },
    { type: "makanan", jenis: "makanan", value: 0 },
    { type: "parenteral", inputJenis: "", inputJumlah: 0, items: [] },
    { type: "iv", inputJenis: "", inputJumlah: 0, items: [] },
  ]);
  const [outputDetails, updateOutputDetails] = useImmer<any[]>([
    { type: "muntah", label: "Oral (Muntah)", value: 0 },
    { type: "ngt", label: "NGT", value: 0 },
    { type: "drain", inputJenis: "", inputJumlah: 0, items: [] },
    { type: "urine", warna: "", value: 0, catheter: false },
    { type: "feses", tekstur: "", warna: "", value: 0 },
    { type: "perdarahan", value: 0 },
  ]);
  const [iwl, setIwl] = useState<{hitung: boolean, value: number}>({ hitung: false, value: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    if (useExternalData) {
      setBalances(externalData || []);
      setLoading(false);
      return;
    }
    try {
      const balanceRes = await fluidBalanceApi.getAll(visitId);
      const bData = balanceRes.data.data || [];
      setBalances(bData);
      emitMedicalRecordTabIndicator("fluid-balance", `${bData.length}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat catatan balance cairan",
      });
    } finally {
      setLoading(false);
    }
  }, [externalData, useExternalData, visitId, toast]);

  const mapMedicineOptions = (medicines: Medicine[]): ComboboxOption[] =>
    medicines.map((medicine) => ({
      value: medicine.name,
      label: medicine.name,
    }));

  const loadIVMedicineOptions = useCallback(async (search: string) => {
    setIvMedicineLoading(true);
    try {
      const response = await medicinesApi.getAll({
        page: 1,
        limit: 20,
        is_active: true,
        search: search.trim() || undefined,
      });
      const rows = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];
      setIvMedicineOptions(mapMedicineOptions(rows));
    } catch {
      setIvMedicineOptions([]);
    } finally {
      setIvMedicineLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);  // Open modal for create

  useEffect(() => {
    if (!isModalOpen) return;
    const timer = setTimeout(() => {
      void loadIVMedicineOptions(ivMedicineSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [isModalOpen, ivMedicineSearch, loadIVMedicineOptions]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      record_date: format(new Date(), "yyyy-MM-dd"),
    });
    updateIntakeDetails(() => [
      { type: "oral", label: "Oral", value: 0 },
      { type: "ngt", label: "NGT", value: 0 },
      { type: "makanan", jenis: "makanan", value: 0 },
      { type: "parenteral", inputJenis: "", inputJumlah: 0, items: [] },
      { type: "iv", inputJenis: "", inputJumlah: 0, items: [] },
    ]);
    updateOutputDetails(() => [
      { type: "muntah", label: "Oral (Muntah)", value: 0 },
      { type: "ngt", label: "NGT", value: 0 },
      { type: "drain", inputJenis: "", inputJumlah: 0, items: [] },
      { type: "urine", warna: "", value: 0, catheter: false },
      { type: "feses", tekstur: "", warna: "", value: 0 },
      { type: "perdarahan", value: 0 },
    ]);
    setIwl({ hitung: false, value: 0 });
    setIvMedicineSearch("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (balance: FluidBalance) => {
    setEditingId(balance.id);
    setFormData({
      record_date: format(new Date(balance.record_date), "yyyy-MM-dd"),
      shift_type: balance.shift_type || "pagi",
      oral_drink: balance.oral_drink || 0,
      oral_food: balance.oral_food || 0,
      oral_medicine: balance.oral_medicine || 0,
      iv_fluid: balance.iv_fluid || 0,
      iv_medicine: balance.iv_medicine || 0,
      blood_product: balance.blood_product || 0,
      enteral_feed: balance.enteral_feed || 0,
      other_intake: balance.other_intake || 0,
      other_intake_note: balance.other_intake_note || "",
      urine_amount: balance.urine_amount || 0,
      urine_color: balance.urine_color || "",
      urine_catheter: !!balance.urine_catheter,
      feces_amount: balance.feces_amount || 0,
      feces_freq: balance.feces_freq || 0,
      feces_type: balance.feces_type || "",
      vomit_amount: balance.vomit_amount || 0,
      vomit_freq: balance.vomit_freq || 0,
      drain_amount: balance.drain_amount || 0,
      drain_type: balance.drain_type || "",
      drain_color: balance.drain_color || "",
      blood_loss: balance.blood_loss || 0,
      blood_loss_note: balance.blood_loss_note || "",
      iwl: balance.iwl || 0,
      other_output: balance.other_output || 0,
      other_output_note: balance.other_output_note || "",
      notes: balance.notes || "",
    });

    const getParenteralEdit = () => {
      if (!balance.other_intake_note) return "Parenteral";
      const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Parenteral - "));
      if (matched.length > 0) return matched.join(", ");
      if (balance.iv_fluid && !balance.other_intake_note.includes("Parenteral - ") && !balance.other_intake_note.includes("Intravena - ") && !balance.other_intake_note.includes("Darah - ")) {
        return `Parenteral - ${balance.other_intake_note}`;
      }
      return "Parenteral";
    };

    const getIVEdit = () => {
      if (!balance.other_intake_note) return "Obat Intravena";
      const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Intravena - "));
      if (matched.length > 0) return matched.join(", ");
      if (balance.iv_medicine && !balance.other_intake_note.includes("Parenteral - ") && !balance.other_intake_note.includes("Intravena - ") && !balance.other_intake_note.includes("Darah - ")) {
        return `Intravena - ${balance.other_intake_note}`;
      }
      return "Obat Intravena";
    };

    const getBloodEdit = () => {
      if (!balance.other_intake_note) return "Darah";
      const matched = balance.other_intake_note.split(", ").filter(s => s.startsWith("Darah - "));
      return matched.length > 0 ? matched.join(", ") : "Darah";
    };

    const parenteralItems = [
      ...(balance.iv_fluid ? [{ jenis: getParenteralEdit(), jumlah: balance.iv_fluid }] : []),
      ...(balance.blood_product ? [{ jenis: getBloodEdit(), jumlah: balance.blood_product }] : []),
    ];
    const ivItems = balance.iv_medicine ? [{ jenis: getIVEdit(), jumlah: balance.iv_medicine }] : [];

    updateIntakeDetails(() => [
      { type: "oral", label: "Oral", value: balance.oral_drink || 0 },
      { type: "ngt", label: "NGT", value: balance.enteral_feed || 0 },
      { type: "makanan", jenis: (balance.oral_food || 0) > 0 ? "makanan" : "minuman", value: balance.oral_food || 0 },
      { type: "parenteral", inputJenis: "", inputJumlah: 0, items: parenteralItems },
      { type: "iv", inputJenis: "", inputJumlah: 0, items: ivItems },
    ]);

    const drainItems = balance.drain_amount ? [{ jenis: balance.drain_type || "Drain", jumlah: balance.drain_amount }] : [];
    
    let fWarna = "";
    let fTekstur = balance.feces_type || "";
    const warnaOptions = ["kuning", "coklat", "hitam", "kemerahan", "pucat", "hijau"];
    for (const w of warnaOptions) {
      if (fTekstur.toLowerCase().startsWith(w)) {
        fWarna = w;
        fTekstur = fTekstur.substring(w.length).trim();
        break;
      }
    }

    updateOutputDetails(() => [
      { type: "muntah", label: "Oral (Muntah)", value: balance.vomit_amount || 0 },
      { type: "ngt", label: "NGT", value: balance.other_output || 0 },
      { type: "drain", inputJenis: "", inputJumlah: 0, items: drainItems },
      { type: "urine", warna: balance.urine_color || "", value: balance.urine_amount || 0, catheter: !!balance.urine_catheter },
      { type: "feses", tekstur: fTekstur, warna: fWarna, value: balance.feces_amount || 0 },
      { type: "perdarahan", value: balance.blood_loss || 0 },
    ]);
    
    setIwl({ hitung: (balance.iwl || 0) > 0, value: balance.iwl || 0 });
    setIvMedicineSearch("");
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateFluidBalanceInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate totals for preview
  const calcIntake = () => {
    let total = 0;
    total += (intakeDetails[0]?.value || 0);
    total += (intakeDetails[1]?.value || 0);
    total += (intakeDetails[2]?.value || 0);
    for (let i = 3; i <= 4; i++) {
      if (intakeDetails[i]?.items) {
        intakeDetails[i].items.forEach((item: any) => { total += (item.jumlah || 0); });
      }
    }
    return total;
  };

  const calcOutput = () => {
    let total = 0;
    total += (outputDetails[0]?.value || 0);
    total += (outputDetails[1]?.value || 0);
    if (outputDetails[2]?.items) {
      outputDetails[2].items.forEach((item: any) => { total += (item.jumlah || 0); });
    }
    total += (outputDetails[3]?.value || 0);
    total += (outputDetails[4]?.value || 0);
    total += (outputDetails[5]?.value || 0);
    if (iwl.hitung) {
      total += (iwl.value || 0);
    }
    return total;
  };

  const syncFormData = (): CreateFluidBalanceInput => {
    const newData = { ...formData };
    const parenteralItems = intakeDetails[3]?.items || [];
    const ivMedicineItems = intakeDetails[4]?.items || [];
    const bloodItems = parenteralItems.filter((i: any) => String(i.jenis || "").startsWith("Darah - "));
    const nonBloodParenteralItems = parenteralItems.filter((i: any) => !String(i.jenis || "").startsWith("Darah - "));
    newData.oral_drink = (intakeDetails[0]?.value || 0) + (intakeDetails[2]?.jenis === "minuman" ? (intakeDetails[2]?.value || 0) : 0);
    newData.oral_food = (intakeDetails[2]?.jenis === "makanan" ? (intakeDetails[2]?.value || 0) : 0);
    newData.enteral_feed = intakeDetails[1]?.value || 0;
    newData.iv_fluid = nonBloodParenteralItems.reduce((sum: number, i: any) => sum + (i.jumlah || 0), 0);
    newData.iv_medicine = ivMedicineItems.reduce((sum: number, i: any) => sum + (i.jumlah || 0), 0);
    newData.blood_product = bloodItems.reduce((sum: number, i: any) => sum + (i.jumlah || 0), 0);
    newData.other_intake_note = [
      ...parenteralItems.map((i: any) => i.jenis),
      ...ivMedicineItems.map((i: any) => i.jenis)
    ].join(", ");

    newData.vomit_amount = outputDetails[0]?.value || 0;
    newData.other_output = outputDetails[1]?.value || 0;
    newData.other_output_note = outputDetails[1]?.value > 0 ? "Output NGT" : "";
    newData.drain_amount = outputDetails[2]?.items?.reduce((sum: number, i: any) => sum + (i.jumlah || 0), 0) || 0;
    newData.drain_type = outputDetails[2]?.items?.map((i: any) => i.jenis).join(", ") || "";
    newData.urine_amount = outputDetails[3]?.value || 0;
    newData.urine_color = outputDetails[3]?.warna || "";
    newData.urine_catheter = !!outputDetails[3]?.catheter;
    newData.feces_amount = outputDetails[4]?.value || 0;
    newData.feces_type = `${outputDetails[4]?.warna || ""} ${outputDetails[4]?.tekstur || ""}`.trim();
    newData.blood_loss = outputDetails[5]?.value || 0;
    newData.iwl = iwl.hitung ? (iwl.value || 0) : 0;
    return newData;
  };




  // Save
  const handleSave = async () => {
    if (!formData.shift_type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Shift harus dipilih",
      });
      return;
    }

    setSaving(true);
    const dataToSave = syncFormData();
    try {
      if (editingId) {
        await fluidBalanceApi.update(visitId, editingId, dataToSave);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil diperbarui",
        });
      } else {
        await fluidBalanceApi.create(visitId, dataToSave);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil ditambahkan",
        });
      }
      setIsModalOpen(false);
      await loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan balance cairan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete logic removed



  if (loading) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewBalance = calcIntake() - calcOutput();

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      {/* Header Section */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Balance Cairan
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pencatatan intake, output, IWL, dan keseimbangan cairan pasien per shift.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {balances.length} catatan
          </span>
          {!readOnly && !useExternalData && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Balance
            </Button>
          )}
        </div>
      </div>

      {/* Table / Empty State */}
      <div className="p-4 sm:p-5">
        {balances.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Shift</th>
                  <th className="px-3 py-2 text-right">Intake</th>
                  <th className="px-3 py-2 text-right">Output</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="w-16 px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              {balances.map((balance) => (
                <FluidBalanceCollapsibleRow
                  key={balance.id}
                  balance={balance}
                  onEdit={handleOpenEdit}
                  readOnly={readOnly || useExternalData}
                />
              ))}
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Droplets className="h-4 w-4 opacity-60 shrink-0" />
            <span>
              {readOnly
                ? "Belum ada catatan balance cairan pada RM duplikat."
                : useExternalData
                ? "Tidak ada data balance cairan pada RM asli."
                : "Belum ada catatan balance cairan — klik Tambah Balance untuk mulai mencatat."}
            </span>
          </div>
        )}
      </div>

      {/* Create/Edit Modal - Fullscreen Monolithic */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !gap-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 sm:px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5 text-left">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Droplets className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {editingId ? "Edit Balance Cairan" : "Tambah Balance Cairan"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Catat rincian masukan (intake) dan keluaran (output) cairan pasien per shift.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(false)}
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
            {/* Top Row: Date & Shift */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 shrink-0 px-4 py-3 bg-neutral-50/40 dark:bg-neutral-900/20">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tanggal</Label>
                <Input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => handleChange("record_date", e.target.value)}
                  className="rounded-none h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Shift</Label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(v) => handleChange("shift_type", v)}
                >
                  <SelectTrigger className="rounded-none h-9 text-xs">
                    <SelectValue placeholder="Pilih shift" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {SHIFT_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Middle Section: Intake & Output 2 Columns (flat split, zero nested card box) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-y lg:divide-y-0 divide-neutral-200 dark:divide-neutral-800 min-h-0">
              {/* Intake Column */}
              <div className="flex flex-col bg-background overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-900 px-4 h-9 border-b border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center justify-between">
                  <span className="border-l-2 border-emerald-600 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Intake (Masukan)
                  </span>
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Total: {calcIntake()} ml
                  </span>
                </div>

                <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto [&_input]:h-9 [&_input]:rounded-none [&_input]:text-xs [&_[role=combobox]]:h-9 [&_[role=combobox]]:rounded-none [&_[role=combobox]]:text-xs">
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Oral (ml)</Label>
                      <Input type="number" value={intakeDetails[0].value} onChange={(e) => updateIntakeDetails((d: any[]) => { (d[0] as any).value = +e.target.value || 0; })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">NGT (ml)</Label>
                      <Input type="number" value={intakeDetails[1].value} onChange={(e) => updateIntakeDetails((d: any[]) => { (d[1] as any).value = +e.target.value || 0; })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Jenis Konsumsi</Label>
                      <Select value={(intakeDetails[2] as any).jenis || ""} onValueChange={(v: string) => updateIntakeDetails((d: any[]) => { (d[2] as any).jenis = v; })}>
                        <SelectTrigger className="rounded-none h-9 text-xs"><SelectValue placeholder="Makanan/Minuman" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="makanan" className="text-xs">Makanan</SelectItem>
                          <SelectItem value="minuman" className="text-xs">Minuman</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Jumlah (ml)</Label>
                      <Input type="number" value={(intakeDetails[2] as any).value || 0} onChange={(e) => updateIntakeDetails((d: any[]) => { (d[2] as any).value = +e.target.value || 0; })} />
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {["parenteral", "iv"].map((type, idx) => (
                      <div key={type} className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex flex-col gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {type === "parenteral" ? "Parenteral" : "Obat Intravena"}
                        </Label>
                        <div className="flex gap-2">
                          <Combobox
                            options={
                              type === "parenteral"
                                ? [...PARENTERAL_CATEGORY_OPTIONS, ...BLOOD_CATEGORY_OPTIONS]
                                : ivMedicineOptions
                            }
                            value={(intakeDetails[3 + idx] as any).inputJenis || ""}
                            onValueChange={(v) => updateIntakeDetails((d: any[]) => { (d[3 + idx] as any).inputJenis = v; })}
                            onSearchChange={type === "iv" ? setIvMedicineSearch : undefined}
                            placeholder={
                              type === "parenteral"
                                ? "Pilih cairan parenteral..."
                                : "Pilih obat intravena..."
                            }
                            searchPlaceholder={
                              type === "parenteral"
                                ? "Cari kategori parenteral..."
                                : "Cari obat intravena..."
                            }
                            emptyText={
                              type === "parenteral"
                                ? "Tidak ada kategori yang cocok."
                                : "Tidak ada obat yang cocok."
                            }
                            loading={type === "iv" ? ivMedicineLoading : false}
                            className="flex-1"
                            disabled={readOnly}
                          />
                          <Input
                            type="number"
                            placeholder="ml"
                            value={(intakeDetails[3 + idx] as any).inputJumlah || ""}
                            onChange={(e) => updateIntakeDetails((d: any[]) => { (d[3 + idx] as any).inputJumlah = +e.target.value || 0; })}
                            className="w-20"
                          />
                          <Button
                            type="button"
                            size="icon"
                            className="rounded-none h-9 w-9 shrink-0 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900"
                            onClick={() => {
                              updateIntakeDetails((d: any[]) => {
                                const det = d[3 + idx] as any;
                                if (!det.items) det.items = [];
                                const prefix = type === "parenteral" ? "Parenteral - " : "Intravena - ";
                                const finalJenis =
                                  type === "parenteral" && det.inputJenis.startsWith("Darah - ")
                                    ? det.inputJenis
                                    : det.inputJenis.startsWith(prefix)
                                    ? det.inputJenis
                                    : `${prefix}${det.inputJenis}`;
                                if (det.inputJenis && det.inputJumlah > 0) det.items.push({ jenis: finalJenis, jumlah: det.inputJumlah });
                                det.inputJenis = "";
                                det.inputJumlah = 0;
                              });
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {((intakeDetails[3 + idx] as any).items || []).map((item: { jenis: string; jumlah: number }, i: number) => (
                          <div key={i} className="flex gap-2 text-xs items-center bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5">
                            <span className="flex-1 truncate">{item.jenis}</span>
                            <span className="font-mono font-semibold text-right">{item.jumlah} ml</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 rounded-none text-destructive"
                              onClick={() => updateIntakeDetails((d: any[]) => { ((d[3 + idx] as any).items as any[]).splice(i, 1); })}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Output Column */}
              <div className="flex flex-col bg-background overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-900 px-4 h-9 border-b border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center justify-between">
                  <span className="border-l-2 border-destructive pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Output (Keluaran)
                  </span>
                  <span className="font-mono text-xs font-semibold text-destructive">
                    Total: {calcOutput()} ml
                  </span>
                </div>

                <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto [&_input]:h-9 [&_input]:rounded-none [&_input]:text-xs">
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Oral / Muntah (ml)</Label>
                      <Input type="number" value={outputDetails[0].value} onChange={(e) => updateOutputDetails((d: any[]) => { (d[0] as any).value = +e.target.value || 0; })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">NGT (ml)</Label>
                      <Input type="number" value={outputDetails[1].value} onChange={(e) => updateOutputDetails((d: any[]) => { (d[1] as any).value = +e.target.value || 0; })} />
                    </div>
                  </div>

                  {/* Urine */}
                  <div className="grid grid-cols-3 gap-3 shrink-0 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Warna Urine</Label>
                      <Select value={(outputDetails[3] as any).warna || ""} onValueChange={(v: string) => updateOutputDetails((d: any[]) => { (d[3] as any).warna = v; })}>
                        <SelectTrigger className="rounded-none h-9 text-xs px-2.5"><SelectValue placeholder="Warna" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="jernih" className="text-xs">Jernih (Clear)</SelectItem>
                          <SelectItem value="kuning_muda" className="text-xs">Kuning Muda</SelectItem>
                          <SelectItem value="kuning_pekat" className="text-xs">Kuning Pekat</SelectItem>
                          <SelectItem value="kecoklatan" className="text-xs">Kuning Kecoklatan</SelectItem>
                          <SelectItem value="kemerahan" className="text-xs">Kemerahan (Hematuria)</SelectItem>
                          <SelectItem value="coklat" className="text-xs">Coklat Tua</SelectItem>
                          <SelectItem value="keruh" className="text-xs">Keruh (Cloudy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Jml Urine (ml)</Label>
                      <Input type="number" value={(outputDetails[3] as any).value || 0} onChange={(e) => updateOutputDetails((d: any[]) => { (d[3] as any).value = +e.target.value || 0; })} />
                    </div>
                    <label className="flex items-center gap-2 h-9 px-2.5 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                      <Checkbox checked={(outputDetails[3] as any).catheter} onCheckedChange={(v: boolean) => updateOutputDetails((d: any[]) => { (d[3] as any).catheter = !!v; })} className="rounded-none" />
                      <span className="text-xs font-medium leading-none">Catheter</span>
                    </label>
                  </div>

                  {/* Feses & Perdarahan */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Tekstur Feses</Label>
                      <Select value={(outputDetails[4] as any).tekstur || ""} onValueChange={(v: string) => updateOutputDetails((d: any[]) => { (d[4] as any).tekstur = v; })}>
                        <SelectTrigger className="rounded-none h-9 text-xs px-2.5"><SelectValue placeholder="Tekstur" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="padat" className="text-xs">Padat</SelectItem>
                          <SelectItem value="lunak" className="text-xs">Lunak</SelectItem>
                          <SelectItem value="cair" className="text-xs">Cair</SelectItem>
                          <SelectItem value="keras" className="text-xs">Keras</SelectItem>
                          <SelectItem value="berlendir" className="text-xs">Berlendir</SelectItem>
                          <SelectItem value="berdarah" className="text-xs">Berdarah</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Warna Feses</Label>
                      <Select value={(outputDetails[4] as any).warna || ""} onValueChange={(v: string) => updateOutputDetails((d: any[]) => { (d[4] as any).warna = v; })}>
                        <SelectTrigger className="rounded-none h-9 text-xs px-2.5"><SelectValue placeholder="Warna" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="kuning" className="text-xs">Kuning</SelectItem>
                          <SelectItem value="coklat" className="text-xs">Coklat</SelectItem>
                          <SelectItem value="hitam" className="text-xs">Hitam (Melena)</SelectItem>
                          <SelectItem value="kemerahan" className="text-xs">Kemerahan</SelectItem>
                          <SelectItem value="pucat" className="text-xs">Pucat/Dempul</SelectItem>
                          <SelectItem value="hijau" className="text-xs">Hijau</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium truncate">Jml Feses (ml)</Label>
                      <Input type="number" value={(outputDetails[4] as any).value || 0} onChange={(e) => updateOutputDetails((d: any[]) => { (d[4] as any).value = +e.target.value || 0; })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium truncate">Perdarahan (ml)</Label>
                      <Input type="number" value={(outputDetails[5] as any).value || 0} onChange={(e) => updateOutputDetails((d: any[]) => { (d[5] as any).value = +e.target.value || 0; })} />
                    </div>
                  </div>

                  {/* Drain (Dynamic) */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex flex-col gap-2 shrink-0">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Jenis Drain
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Jenis drain"
                        value={(outputDetails[2] as any).inputJenis || ""}
                        onChange={(e) => updateOutputDetails((d: any[]) => { (d[2] as any).inputJenis = e.target.value; })}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="ml"
                        value={(outputDetails[2] as any).inputJumlah || ""}
                        onChange={(e) => updateOutputDetails((d: any[]) => { (d[2] as any).inputJumlah = +e.target.value || 0; })}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="rounded-none h-9 w-9 shrink-0 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900"
                        onClick={() => {
                          updateOutputDetails((d: any[]) => {
                            const det = d[2] as any;
                            if (!det.items) det.items = [];
                            if (det.inputJenis && det.inputJumlah > 0) det.items.push({ jenis: det.inputJenis, jumlah: det.inputJumlah });
                            det.inputJenis = "";
                            det.inputJumlah = 0;
                          });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {((outputDetails[2] as any).items || []).map((item: { jenis: string; jumlah: number }, i: number) => (
                      <div key={i} className="flex gap-2 text-xs items-center bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5">
                        <span className="flex-1 truncate">{item.jenis}</span>
                        <span className="font-mono font-semibold text-right">{item.jumlah} ml</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 rounded-none text-destructive"
                          onClick={() => updateOutputDetails((d: any[]) => { ((d[2] as any).items as any[]).splice(i, 1); })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* IWL */}
                  <div className="flex items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-3 shrink-0 mt-auto">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Hitung IWL (Insensible Water Loss)
                      </Label>
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={iwl.hitung} onChange={() => setIwl({ hitung: true, value: iwl.value })} className="accent-neutral-900 dark:accent-white" />
                          Ya
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={!iwl.hitung} onChange={() => setIwl({ hitung: false, value: 0 })} className="accent-neutral-900 dark:accent-white" />
                          Tidak
                        </label>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-right">
                      <span className="text-xl font-mono font-bold">{iwl.value}</span>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">ml</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Balance Preview & Notes (flat split) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-y lg:divide-y-0 divide-neutral-200 dark:divide-neutral-800 shrink-0">
              <div
                className={cn(
                  "lg:col-span-4 px-4 py-3 flex flex-col items-center justify-center",
                  previewBalance > 0
                    ? "bg-emerald-500/10"
                    : previewBalance < 0
                    ? "bg-destructive/10"
                    : "bg-neutral-50/40 dark:bg-neutral-900/20"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Balance Cairan
                </p>
                <p
                  className={cn(
                    "text-2xl font-mono font-bold leading-none",
                    previewBalance > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : previewBalance < 0
                      ? "text-destructive"
                      : "text-foreground"
                  )}
                >
                  {previewBalance > 0 ? "+" : ""}
                  {previewBalance} <span className="text-xs font-normal">ml</span>
                </p>
              </div>

              <div className="lg:col-span-8 p-3.5 space-y-1.5">
                <Label className="text-xs font-medium">Catatan Tambahan</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Ketik catatan tambahan di sini (opsional)..."
                  className="min-h-[60px] rounded-none resize-none text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="h-8 rounded-none text-xs px-4">
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-8 rounded-none text-xs px-4 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
