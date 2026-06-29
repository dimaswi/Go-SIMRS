import { useToast } from "@/hooks/use-toast";
// import { useImmer } from "use-immer";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fluidBalanceApi, medicinesApi, SHIFT_TYPES } from "@/lib/api";
import type { FluidBalance, CreateFluidBalanceInput, Medicine } from "@/lib/api";
import { format } from "date-fns";
import { Loader2, Plus, Droplets, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="hover:bg-muted/10 border-b">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center">
          <div className="col-span-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className="col-span-2">{format(new Date(balance.record_date), "dd/MM/yyyy")}</div>
          <div className="col-span-2 capitalize">{balance.shift_type}</div>
          <div className="col-span-2 font-mono font-semibold text-emerald-600">+{intakeTotal} ml</div>
          <div className="col-span-2 font-mono font-semibold text-destructive">-{outputTotal} ml</div>
          <div className="col-span-2 font-mono font-medium">
            <span className={intakeTotal - outputTotal > 0 ? "text-emerald-600" : intakeTotal - outputTotal < 0 ? "text-destructive" : ""}>
              {intakeTotal - outputTotal > 0 ? "+" : ""}{intakeTotal - outputTotal} ml
            </span>
          </div>
          <div className="col-span-1 flex gap-2">
            {!readOnly && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onEdit(balance)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-12 py-3 bg-muted/5 grid grid-cols-2 gap-8 text-xs border-t">
            <div className="space-y-2">
              <h4 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b pb-1">Detail Intake</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(balance.oral_drink || 0) > 0 && <><span className="text-muted-foreground">Minuman</span><span className="font-mono text-right text-emerald-600">{balance.oral_drink} ml</span></>}
                {(balance.oral_food || 0) > 0 && <><span className="text-muted-foreground">Makanan</span><span className="font-mono text-right text-emerald-600">{balance.oral_food} ml</span></>}
                {(balance.oral_medicine || 0) > 0 && <><span className="text-muted-foreground">Obat Oral</span><span className="font-mono text-right text-emerald-600">{balance.oral_medicine} ml</span></>}
                {(balance.iv_fluid || 0) > 0 && <><span className="text-muted-foreground">{getParenteralLabel()}</span><span className="font-mono text-right text-emerald-600">{balance.iv_fluid} ml</span></>}
                {(balance.iv_medicine || 0) > 0 && <><span className="text-muted-foreground">{getIVLabel()}</span><span className="font-mono text-right text-emerald-600">{balance.iv_medicine} ml</span></>}
                {(balance.blood_product || 0) > 0 && <><span className="text-muted-foreground">{getBloodLabel()}</span><span className="font-mono text-right text-emerald-600">{balance.blood_product} ml</span></>}
                {(balance.enteral_feed || 0) > 0 && <><span className="text-muted-foreground">NGT</span><span className="font-mono text-right text-emerald-600">{balance.enteral_feed} ml</span></>}
                {(balance.other_intake || 0) > 0 && <><span className="text-muted-foreground">Lainnya</span><span className="font-mono text-right text-emerald-600">{balance.other_intake} ml</span></>}
              </div>
              {balance.other_intake_note && (
                <div className="pt-2">
                  <span className="block text-[10px] text-muted-foreground uppercase">Catatan Intake</span>
                  <span className="italic">{balance.other_intake_note}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b pb-1">Detail Output</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(balance.urine_amount || 0) > 0 && <><span className="text-muted-foreground">Urine {balance.urine_color ? `(${balance.urine_color})` : ''} {balance.urine_catheter ? '[Catheter]' : ''}</span><span className="font-mono text-right text-destructive">{balance.urine_amount} ml</span></>}
                {(balance.feces_amount || 0) > 0 && <><span className="text-muted-foreground">Feses {balance.feces_type ? `(${balance.feces_type})` : ''}</span><span className="font-mono text-right text-destructive">{balance.feces_amount} ml</span></>}
                {(balance.vomit_amount || 0) > 0 && <><span className="text-muted-foreground">Muntah</span><span className="font-mono text-right text-destructive">{balance.vomit_amount} ml</span></>}
                {(balance.drain_amount || 0) > 0 && <><span className="text-muted-foreground">Drain {balance.drain_type ? `(${balance.drain_type})` : ''}</span><span className="font-mono text-right text-destructive">{balance.drain_amount} ml</span></>}
                {(balance.blood_loss || 0) > 0 && <><span className="text-muted-foreground">Perdarahan</span><span className="font-mono text-right text-destructive">{balance.blood_loss} ml</span></>}
                {(balance.other_output || 0) > 0 && <><span className="text-muted-foreground">Lainnya (NGT)</span><span className="font-mono text-right text-destructive">{balance.other_output} ml</span></>}
                {(balance.iwl || 0) > 0 && <><span className="text-muted-foreground">IWL</span><span className="font-mono text-right text-destructive">{balance.iwl} ml</span></>}
              </div>
            </div>
          </div>
          {balance.notes && (
            <div className="px-12 pb-3 bg-muted/5 text-xs">
              <span className="block text-[10px] text-muted-foreground uppercase mb-1">Catatan Keseluruhan</span>
              <p className="bg-background p-2 border rounded-sm">{balance.notes}</p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useImmer } from "use-immer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";








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
      label: `${medicine.name}${medicine.generic_name ? ` - ${medicine.generic_name}` : ""}${medicine.code ? ` (${medicine.code})` : ""}`,
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
      <div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Daftar Balance Cairan</span>
                {!readOnly && !useExternalData && (
                  <Button onClick={handleOpenCreate} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {balances.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0 rounded-t-lg">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Tanggal</div>
                  <div className="col-span-2">Shift</div>
                  <div className="col-span-2">Intake</div>
                  <div className="col-span-2">Output</div>
                  <div className="col-span-2">Balance</div>
                  <div className="col-span-1">Aksi</div>
                </div>
                <div className="flex flex-col">
                  {balances.map((balance) => (
                    <FluidBalanceCollapsibleRow
                      key={balance.id}
                      balance={balance}
                      onEdit={handleOpenEdit}
                      readOnly={readOnly || useExternalData}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan balance cairan</p>
                <p className="text-sm mt-1">
                  {readOnly
                    ? "Belum ada catatan balance cairan pada RM duplikat."
                    : useExternalData
                    ? "Tidak ada data balance cairan pada RM asli."
                    : 'Klik "Tambah Balance" untuk menambahkan catatan.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal - Fullscreen Monolithic, No Scroll */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Droplets className="h-4 w-4" />
              {editingId ? "Edit Balance Cairan" : "Tambah Balance Cairan"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-6 w-6 rounded-none text-muted-foreground hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
            {/* Top Row: Date & Shift */}
            <div className="flex items-center gap-4 bg-muted/10 border border-border/70 p-2 shrink-0">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold w-16">Tanggal</Label>
                <Input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => handleChange("record_date", e.target.value)}
                  className="rounded-none border-border/70 h-8 text-xs w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold w-12">Shift</Label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(v) => handleChange("shift_type", v)}
                >
                  <SelectTrigger className="rounded-none border-border/70 h-8 text-xs w-48">
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

            {/* Middle Section: Intake & Output 2 Columns */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
              {/* Intake Column */}
              <div className="flex flex-col border border-border/70 bg-background overflow-hidden">
                <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0 flex justify-between">
                  <span>INTAKE (Masukan)</span>
                  <span className="text-primary">Total: {calcIntake()} ml</span>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-3 min-h-0">
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Oral</Label>
                      <Input type="number" value={intakeDetails[0].value} onChange={e=>updateIntakeDetails((d:any[])=>{(d[0] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">NGT</Label>
                      <Input type="number" value={intakeDetails[1].value} onChange={e=>updateIntakeDetails((d:any[])=>{(d[1] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Jenis Konsumsi</Label>
                      <Select value={(intakeDetails[2] as any).jenis||""} onValueChange={(v: string)=>updateIntakeDetails((d:any[])=>{(d[2] as any).jenis=v})}>
                        <SelectTrigger className="rounded-none border-border/70 h-7 text-xs"><SelectValue placeholder="Makanan/Minuman" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="makanan" className="text-xs">Makanan</SelectItem>
                          <SelectItem value="minuman" className="text-xs">Minuman</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Jumlah</Label>
                      <Input type="number" value={(intakeDetails[2] as any).value||0} onChange={e=>updateIntakeDetails((d:any[])=>{(d[2] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                  </div>
                  
                  {/* Dynamic Rows wrapped in flex-1 overflow-auto just in case there are many items, but keep it tight */}
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                    {["parenteral","iv"].map((type,idx)=>(
                      <div key={type} className="bg-muted/5 border border-border/40 p-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">{type==="parenteral"?"Parenteral":"Obat Intravena"}</Label>
                        </div>
                        <div className="flex gap-2">
                          {(type === "parenteral" || type === "iv") ? (
                            <Combobox
                              options={
                                type === "parenteral"
                                  ? [...PARENTERAL_CATEGORY_OPTIONS, ...BLOOD_CATEGORY_OPTIONS]
                                  : type === "iv"
                                  ? ivMedicineOptions
                                  : BLOOD_CATEGORY_OPTIONS
                              }
                              value={(intakeDetails[3+idx] as any).inputJenis || ""}
                              onValueChange={(v) => updateIntakeDetails((d:any[])=>{(d[3+idx] as any).inputJenis=v})}
                              onSearchChange={type === "iv" ? setIvMedicineSearch : undefined}
                              placeholder={
                                type === "parenteral"
                                  ? "Pilih cairan parenteral..."
                                  : type === "iv"
                                  ? "Pilih obat intravena..."
                                  : "Pilih kategori darah..."
                              }
                              searchPlaceholder={
                                type === "parenteral"
                                  ? "Cari kategori parenteral..."
                                  : type === "iv"
                                  ? "Cari obat intravena..."
                                  : "Cari kategori darah..."
                              }
                              emptyText={
                                type === "parenteral"
                                  ? "Tidak ada kategori yang cocok."
                                  : "Tidak ada obat yang cocok."
                              }
                              loading={type === "iv" ? ivMedicineLoading : false}
                              className="flex-1 rounded-none border-border/70 h-7 text-xs"
                              disabled={readOnly}
                            />
                          ) : null}
                          <Input type="number" placeholder="ml" value={(intakeDetails[3+idx] as any).inputJumlah||""} onChange={e=>updateIntakeDetails((d:any[])=>{(d[3+idx] as any).inputJumlah=+e.target.value||0})} className="w-16 rounded-none border-border/70 h-7 text-xs" />
                          <Button type="button" size="sm" className="rounded-none h-7 w-7 p-0" onClick={()=>{
                            updateIntakeDetails((d:any[])=>{
                              const det = d[3+idx] as any;
                              if(!det.items) det.items=[];
                              const prefix = type === "parenteral" ? "Parenteral - " : "Intravena - ";
                              const finalJenis =
                                type === "parenteral" && det.inputJenis.startsWith("Darah - ")
                                  ? det.inputJenis
                                  : det.inputJenis.startsWith(prefix)
                                  ? det.inputJenis
                                  : `${prefix}${det.inputJenis}`;
                              if(det.inputJenis&&det.inputJumlah>0) det.items.push({jenis: finalJenis, jumlah:det.inputJumlah});
                              det.inputJenis="";det.inputJumlah=0;
                            });
                          }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {((intakeDetails[3+idx] as any).items||[]).map((item: {jenis:string;jumlah:number},i:number)=>(
                          <div key={i} className="flex gap-2 text-[10px] items-center bg-background border border-border/30 px-2 py-1">
                            <span className="flex-1 truncate">{item.jenis}</span>
                            <span className="font-mono w-12 text-right">{item.jumlah} ml</span>
                            <Button type="button" variant="ghost" className="h-4 w-4 p-0 rounded-none text-destructive" onClick={()=>updateIntakeDetails((d:any[])=>{((d[3+idx] as any).items as any[]).splice(i,1)})}>✕</Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Output Column */}
              <div className="flex flex-col border border-border/70 bg-background overflow-hidden">
                <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0 flex justify-between">
                  <span>OUTPUT (Keluaran)</span>
                  <span className="text-destructive">Total: {calcOutput()} ml</span>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Oral (Muntah)</Label>
                      <Input type="number" value={outputDetails[0].value} onChange={e=>updateOutputDetails((d:any[])=>{(d[0] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">NGT</Label>
                      <Input type="number" value={outputDetails[1].value} onChange={e=>updateOutputDetails((d:any[])=>{(d[1] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                  </div>

                  {/* Urine */}
                  <div className="grid grid-cols-3 gap-3 shrink-0 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Warna Urine</Label>
                      <Select value={(outputDetails[3] as any).warna||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[3] as any).warna=v})}>
                        <SelectTrigger className="rounded-none border-border/70 h-7 text-xs px-2"><SelectValue placeholder="Warna" /></SelectTrigger>
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
                      <Label className="text-[10px] uppercase text-muted-foreground">Jml Urine (ml)</Label>
                      <Input type="number" value={(outputDetails[3] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[3] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs" />
                    </div>
                    <div className="flex items-center gap-2 h-7">
                      <Checkbox checked={(outputDetails[3] as any).catheter} onCheckedChange={(v: boolean)=>updateOutputDetails((d:any[])=>{(d[3] as any).catheter=!!v})} className="rounded-none border-border/70" />
                      <span className="text-[10px] font-medium leading-none">Catheter</span>
                    </div>
                  </div>

                  {/* Feses & Perdarahan */}
                  <div className="grid grid-cols-4 gap-3 shrink-0">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Tekstur Feses</Label>
                      <Select value={(outputDetails[4] as any).tekstur||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[4] as any).tekstur=v})}>
                        <SelectTrigger className="rounded-none border-border/70 h-7 text-xs px-2"><SelectValue placeholder="Tekstur" /></SelectTrigger>
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
                      <Label className="text-[10px] uppercase text-muted-foreground">Warna Feses</Label>
                      <Select value={(outputDetails[4] as any).warna||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[4] as any).warna=v})}>
                        <SelectTrigger className="rounded-none border-border/70 h-7 text-xs px-2"><SelectValue placeholder="Warna" /></SelectTrigger>
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
                      <Label className="text-[10px] uppercase text-muted-foreground truncate">Jml Feses</Label>
                      <Input type="number" value={(outputDetails[4] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[4] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs px-2" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground truncate">Perdarahan</Label>
                      <Input type="number" value={(outputDetails[5] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[5] as any).value=+e.target.value||0})} className="rounded-none border-border/70 h-7 text-xs px-2" />
                    </div>
                  </div>

                  {/* Drain (Dynamic) */}
                  <div className="bg-muted/5 border border-border/40 p-2 flex flex-col gap-2 shrink-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Jenis Drain</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Jenis drain" value={(outputDetails[2] as any).inputJenis||""} onChange={e=>updateOutputDetails((d:any[])=>{(d[2] as any).inputJenis=e.target.value})} className="flex-1 rounded-none border-border/70 h-7 text-xs" />
                      <Input type="number" placeholder="ml" value={(outputDetails[2] as any).inputJumlah||""} onChange={e=>updateOutputDetails((d:any[])=>{(d[2] as any).inputJumlah=+e.target.value||0})} className="w-16 rounded-none border-border/70 h-7 text-xs" />
                      <Button type="button" size="sm" className="rounded-none h-7 w-7 p-0" onClick={()=>{
                        updateOutputDetails((d:any[])=>{
                          const det = d[2] as any;
                          if(!det.items) det.items=[];
                          if(det.inputJenis&&det.inputJumlah>0) det.items.push({jenis:det.inputJenis,jumlah:det.inputJumlah});
                          det.inputJenis="";det.inputJumlah=0;
                        });
                      }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {((outputDetails[2] as any).items||[]).map((item: {jenis:string;jumlah:number},i:number)=>(
                      <div key={i} className="flex gap-2 text-[10px] items-center bg-background border border-border/30 px-2 py-1">
                        <span className="flex-1 truncate">{item.jenis}</span>
                        <span className="font-mono w-12 text-right">{item.jumlah} ml</span>
                        <Button type="button" variant="ghost" className="h-4 w-4 p-0 rounded-none text-destructive" onClick={()=>updateOutputDetails((d:any[])=>{((d[2] as any).items as any[]).splice(i,1)})}>✕</Button>
                      </div>
                    ))}
                  </div>

                  {/* IWL */}
                  <div className="flex items-center gap-4 bg-muted/10 border border-border/40 p-2 shrink-0 mt-auto">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Hitung IWL (Insensible Water Loss)</Label>
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={iwl.hitung} onChange={()=>setIwl({hitung:true,value:iwl.value})} className="accent-primary"/> Ya</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!iwl.hitung} onChange={()=>setIwl({hitung:false,value:0})} className="accent-primary"/> Tidak</label>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-right">
                      <span className="text-xl font-mono font-semibold">{iwl.value}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">ml</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Balance Preview & Notes */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 shrink-0 h-24">
              <div className={`border border-border/70 flex flex-col items-center justify-center ${
                calcIntake() - calcOutput() > 0 ? "bg-emerald-500/10" : 
                calcIntake() - calcOutput() < 0 ? "bg-destructive/10" : "bg-muted/10"
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">BALANCE CAIRAN</p>
                <p className={`text-3xl font-mono leading-none ${
                  calcIntake() - calcOutput() > 0 ? "text-emerald-600" : 
                  calcIntake() - calcOutput() < 0 ? "text-destructive" : "text-foreground"
                }`}>
                  {calcIntake() - calcOutput() > 0 ? "+" : ""}{calcIntake() - calcOutput()} <span className="text-sm">ml</span>
                </p>
              </div>

              <div className="border border-border/70 flex flex-col bg-background overflow-hidden">
                <div className="bg-muted/30 px-3 py-1 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                  Catatan Tambahan
                </div>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Ketik catatan tambahan di sini..."
                  className="flex-1 rounded-none border-none resize-none text-xs focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t bg-muted/30 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-none text-xs">
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-none text-xs">
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation removed */}
    </>
  );
}
