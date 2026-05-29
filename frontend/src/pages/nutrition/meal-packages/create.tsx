import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  nutritionPackageApi,
  nutritionMenuApi,
  nutritionCategoryLabels,
  type NutritionMenu,
  type NutritionPackageInput,
} from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Trash2, UtensilsCrossed, Flame, Search } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel, NutritionSummaryCue } from "../shared-page-chrome";

interface PackageItem {
  menu_id: number;
  menu?: NutritionMenu;
  quantity: number;
  notes: string;
}

export default function NutritionMealPackageCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dietType, setDietType] = useState("");
  const [mealTime, setMealTime] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  // Items
  const [items, setItems] = useState<PackageItem[]>([]);

  // Menu search
  const [menuSearch, setMenuSearch] = useState("");
  const [menuResults, setMenuResults] = useState<NutritionMenu[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Reference data
  const [dietTypes, setDietTypes] = useState<{ value: string; label: string }[]>([]);
  const [mealTimes, setMealTimes] = useState<{ value: string; label: string }[]>([]);
  const [dietTypeMap, setDietTypeMap] = useState<Record<string, string>>({});

  const [dietModalOpen, setDietModalOpen] = useState(false);
  const [dietSaving, setDietSaving] = useState(false);
  const [newDietName, setNewDietName] = useState("");
  const [newDietCode, setNewDietCode] = useState("");
  const [newDietDescription, setNewDietDescription] = useState("");

  useEffect(() => {
    setPageTitle("Tambah Paket Makanan");
    loadReferenceData();
  }, []);

  const loadMenuLookup = async (term: string) => {
    setSearchLoading(true);
    try {
      const params: { search?: string; limit: number; is_active: string } = { limit: 10, is_active: "true" };
      if (term.trim()) {
        params.search = term;
      }
      const res = await nutritionMenuApi.getAll(params);
      setMenuResults(res.data.data || []);
    } catch {
      setMenuResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [dietRes, mealRes] = await Promise.all([
        nutritionMenuApi.getDietTypes(),
        nutritionMenuApi.getMealTimes(),
      ]);
      const dtOptions = dietRes.data?.data || [];
      const mtOptions = mealRes.data?.data || [];
      setDietTypes(dtOptions);
      setMealTimes(mtOptions);
      setDietTypeMap(
        dtOptions.reduce((acc: Record<string, string>, item: { value: string; label: string }) => {
          acc[item.value] = item.label;
          return acc;
        }, {})
      );
    } catch {
      setDietTypes([]);
      setMealTimes([]);
      setDietTypeMap({});
    }
  };

  const handleCreateDietType = async () => {
    if (!newDietName.trim()) {
      toast({ variant: "destructive", title: "Error!", description: "Nama jenis diet wajib diisi." });
      return;
    }
    setDietSaving(true);
    try {
      const res = await nutritionMenuApi.createDietType({
        name: newDietName.trim(),
        code: newDietCode.trim() || undefined,
        description: newDietDescription.trim() || undefined,
      });
      const created = res.data?.data;
      await loadReferenceData();
      if (created?.value) {
        setDietType(created.value);
      }
      setDietModalOpen(false);
      setNewDietName("");
      setNewDietCode("");
      setNewDietDescription("");
      toast({ variant: "success", title: "Berhasil!", description: "Jenis diet berhasil ditambahkan." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menambahkan jenis diet.",
      });
    } finally {
      setDietSaving(false);
    }
  };

  // Search menus
  useEffect(() => {
    if (!menuSearch.trim()) { setMenuResults([]); return; }
    const timer = setTimeout(async () => {
      await loadMenuLookup(menuSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [menuSearch]);

  const addItem = (menu: NutritionMenu) => {
    // Prevent duplicate
    if (items.find(i => i.menu_id === menu.id)) {
      toast({ variant: "destructive", title: "Sudah ditambahkan", description: `${menu.name} sudah ada dalam paket.` });
      return;
    }
    setItems([...items, { menu_id: menu.id, menu, quantity: 1, notes: "" }]);
    setMenuSearch("");
    setMenuResults([]);
  };

  const updateItemQty = (idx: number, qty: number) => {
    const updated = [...items];
    updated[idx].quantity = Math.max(1, qty);
    setItems(updated);
  };

  const updateItemNotes = (idx: number, notes: string) => {
    const updated = [...items];
    updated[idx].notes = notes;
    setItems(updated);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Calculate totals
  const totals = items.reduce(
    (acc, item) => {
      const qty = item.quantity || 1;
      acc.calories += (item.menu?.calories || 0) * qty;
      acc.protein += (item.menu?.protein || 0) * qty;
      acc.fat += (item.menu?.fat || 0) * qty;
      acc.carbohydrate += (item.menu?.carbohydrate || 0) * qty;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbohydrate: 0 }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dietType || !mealTime) {
      toast({ variant: "destructive", title: "Error!", description: "Nama, jenis diet, dan waktu makan wajib diisi." });
      return;
    }
    if (items.length === 0) {
      toast({ variant: "destructive", title: "Error!", description: "Tambahkan minimal 1 item menu." });
      return;
    }

    setSaving(true);
    try {
      const data: NutritionPackageInput = {
        name,
        description,
        diet_type: dietType,
        meal_time: mealTime,
        price: 0,
        is_active: isActive,
        notes,
        items: items.map(i => ({ menu_id: i.menu_id, quantity: i.quantity, notes: i.notes })),
      };
      await nutritionPackageApi.create(data);
      toast({ title: "Berhasil!", description: "Paket makanan berhasil ditambahkan." });
      navigate("/nutrition/meal-packages");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error!", description: err?.response?.data?.error || "Gagal menyimpan paket makanan." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Tambah Paket Makanan"
        description="Susun paket makanan layanan gizi dari kombinasi menu aktif, jadwal makan, diet, harga, dan total nilai gizi yang siap dipakai operasional."
        icon={UtensilsCrossed}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/meal-packages")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="nutrition-package-create-form" size="sm" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Paket
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Diet wajib dipilih</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Minimal satu item menu</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Paket tanpa harga</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <NutritionSummaryCue label="Informasi Paket" description={`Diet: ${dietTypeMap[dietType] || "belum dipilih"} • Waktu: ${mealTimes.find((item) => item.value === mealTime)?.label || "belum dipilih"}`} tone="from-background via-background to-emerald-50/50" />
          <NutritionSummaryCue label="Komposisi Menu" description="Cari menu aktif dan susun item paket sesuai kebutuhan layanan gizi." tone="from-background via-background to-sky-50/40" />
          <NutritionSummaryCue label="Ringkasan Nutrisi" description="Pantau total kalori, protein, lemak, dan karbohidrat paket secara otomatis." tone="from-background via-background to-amber-50/50" />
        </div>

      <form id="nutrition-package-create-form" onSubmit={handleSubmit} className="space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Basic Info */}
        <NutritionSectionPanel icon={UtensilsCrossed} title="Informasi Paket" description="Identitas paket, jenis diet, waktu makan, status, dan deskripsi singkat paket makanan.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nama Paket *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Paket Sarapan Diet Biasa" required />
            </div>
            <div className="space-y-2">
              <Label>Jenis Diet *</Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    options={dietTypes}
                    value={dietType}
                    onValueChange={setDietType}
                    placeholder="Pilih jenis diet..."
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => setDietModalOpen(true)} title="Tambah jenis diet">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Waktu Makan *</Label>
              <Combobox
                options={mealTimes}
                value={mealTime}
                onValueChange={setMealTime}
                placeholder="Pilih waktu makan..."
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
        </NutritionSectionPanel>

        {/* Menu Items */}
        <NutritionSectionPanel icon={Plus} title="Item Menu" description="Cari menu aktif, atur jumlah porsi, dan lengkapi catatan per item untuk membangun komposisi paket.">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              onFocus={() => {
                if (menuResults.length === 0) {
                  loadMenuLookup("");
                }
              }}
              placeholder="Cari menu untuk ditambahkan..."
              className="pl-9"
            />
            {/* Search Results Dropdown */}
            {menuResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
                {menuResults.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                    onClick={() => addItem(menu)}
                  >
                    <div>
                      <div className="font-medium">{menu.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {nutritionCategoryLabels[menu.category] || menu.category} · {menu.calories} kkal
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{menu.code}</Badge>
                  </button>
                ))}
              </div>
            )}
            {searchLoading && menuSearch.trim().length >= 1 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Mencari...
              </div>
            )}
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
              Belum ada item. Cari dan tambahkan menu di atas.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.menu_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.menu?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {nutritionCategoryLabels[item.menu?.category || ''] || ''} · {item.menu?.calories} kkal/porsi
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Qty:</Label>
                    <Input
                      type="number"
                      min="1"
                      className="w-16 h-8 text-center"
                      value={item.quantity}
                      onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Input
                    placeholder="Catatan"
                    className="w-32 h-8 text-xs"
                    value={item.notes}
                    onChange={(e) => updateItemNotes(idx, e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Nutrition Totals */}
          {items.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Total Nilai Gizi</h4>
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div><div className="font-bold">{totals.calories.toFixed(0)}</div><div className="text-xs text-muted-foreground">kkal</div></div>
                <div><div className="font-bold">{totals.protein.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Protein</div></div>
                <div><div className="font-bold">{totals.fat.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Lemak</div></div>
                <div><div className="font-bold">{totals.carbohydrate.toFixed(1)}g</div><div className="text-xs text-muted-foreground">Karbohidrat</div></div>
              </div>
            </div>
          )}
        </NutritionSectionPanel>

        {/* Notes */}
        <NutritionSectionPanel title="Catatan" description="Catatan tambahan paket untuk kebutuhan operasional dapur atau pelayanan gizi.">
          <Label>Catatan</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </NutritionSectionPanel>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/nutrition/meal-packages")}>Batal</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
          </Button>
        </div>
      </form>
      </PageContent>

      <Dialog open={dietModalOpen} onOpenChange={setDietModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Jenis Diet</DialogTitle>
            <DialogDescription>Jenis diet baru disimpan di master backend dan langsung bisa dipilih pada paket makanan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nama Jenis Diet *</Label>
              <Input value={newDietName} onChange={(e) => setNewDietName(e.target.value)} placeholder="Contoh: Diet Tinggi Serat" />
            </div>
            <div className="space-y-2">
              <Label>Kode (opsional)</Label>
              <Input value={newDietCode} onChange={(e) => setNewDietCode(e.target.value)} placeholder="Contoh: tinggi_serat" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={newDietDescription} onChange={(e) => setNewDietDescription(e.target.value)} rows={2} placeholder="Catatan tambahan..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDietModalOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={handleCreateDietType} disabled={dietSaving}>
                {dietSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Jenis Diet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
