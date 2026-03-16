import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Search,
  UtensilsCrossed,
  ChefHat,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Flame,
} from "lucide-react";
import {
  nutritionOrderApi,
  nutritionMenuApi,
  nutritionPackageApi,
  nutritionDietTypeLabels,
  nutritionMealTimeLabels,
  nutritionCategoryLabels,
  nutritionOrderStatusLabels,
  nutritionOrderStatusColors,
  type NutritionOrder,
  type NutritionMenu,
  type NutritionPackage,
  type CreateNutritionOrderInput,
} from "@/lib/api/nutrition";

interface NutritionOrderFormProps {
  visitId: number;
  readOnly?: boolean;
}

interface OrderItemInput {
  menu_id: number;
  menu?: NutritionMenu;
  quantity: number;
  notes: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  confirmed: <Clock className="h-3 w-3" />,
  preparing: <ChefHat className="h-3 w-3" />,
  delivered: <Truck className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
};

export function NutritionOrderForm({ visitId, readOnly = false }: NutritionOrderFormProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<NutritionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NutritionOrder | null>(null);

  // New order form state
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [mealTime, setMealTime] = useState("");
  const [dietType, setDietType] = useState("");
  const [allergyNotes, setAllergyNotes] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [orderMode, setOrderMode] = useState<"package" | "manual">("package");
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  // Manual items
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuResults, setMenuResults] = useState<NutritionMenu[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Package selection
  const [packages, setPackages] = useState<NutritionPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Reference data
  const dietTypeOptions = Object.entries(nutritionDietTypeLabels).map(([v, l]) => ({ value: v, label: l }));
  const mealTimeOptions = Object.entries(nutritionMealTimeLabels).map(([v, l]) => ({ value: v, label: l }));

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await nutritionOrderApi.getAll({ visit_id: visitId, limit: 100 });
      setOrders(res.data.data || []);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat order gizi." });
    } finally {
      setLoading(false);
    }
  };

  // Load packages when diet_type and meal_time change
  useEffect(() => {
    if (orderMode === "package" && dietType && mealTime) {
      loadPackages();
    }
  }, [dietType, mealTime, orderMode]);

  const loadPackages = async () => {
    setPackagesLoading(true);
    try {
      const res = await nutritionPackageApi.getAll({ diet_type: dietType, meal_time: mealTime, is_active: "true", limit: 50 });
      setPackages(res.data.data || []);
    } catch { /* ignore */ }
    setPackagesLoading(false);
  };

  // Search menu for manual mode
  useEffect(() => {
    if (orderMode !== "manual" || menuSearch.length < 2) { setMenuResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await nutritionMenuApi.getAll({ search: menuSearch, limit: 10, is_active: "true" });
        setMenuResults(res.data.data || []);
      } catch { /* ignore */ }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [menuSearch, orderMode]);

  const addItem = (menu: NutritionMenu) => {
    if (items.find(i => i.menu_id === menu.id)) {
      toast({ variant: "destructive", title: "Sudah ada", description: `${menu.name} sudah ditambahkan.` });
      return;
    }
    setItems([...items, { menu_id: menu.id, menu, quantity: 1, notes: "" }]);
    setMenuSearch("");
    setMenuResults([]);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItemQty = (idx: number, qty: number) => {
    const upd = [...items];
    upd[idx].quantity = Math.max(1, qty);
    setItems(upd);
  };

  const resetForm = () => {
    setOrderDate(new Date().toISOString().split("T")[0]);
    setMealTime("");
    setDietType("");
    setAllergyNotes("");
    setSpecialNotes("");
    setOrderMode("package");
    setSelectedPackageId(null);
    setItems([]);
    setMenuSearch("");
    setMenuResults([]);
    setPackages([]);
  };

  const handleCreateOrder = async () => {
    if (!mealTime || !dietType || !orderDate) {
      toast({ variant: "destructive", title: "Error!", description: "Tanggal, waktu makan, dan jenis diet wajib diisi." });
      return;
    }

    if (orderMode === "package" && !selectedPackageId) {
      toast({ variant: "destructive", title: "Error!", description: "Pilih paket makanan." });
      return;
    }

    if (orderMode === "manual" && items.length === 0) {
      toast({ variant: "destructive", title: "Error!", description: "Tambahkan minimal 1 menu." });
      return;
    }

    setSaving(true);
    try {
      const data: CreateNutritionOrderInput = {
        visit_id: visitId,
        order_date: orderDate,
        meal_time: mealTime,
        diet_type: dietType,
        allergy_notes: allergyNotes,
        special_notes: specialNotes,
      };

      if (orderMode === "package" && selectedPackageId) {
        data.package_id = selectedPackageId;
      } else {
        data.items = items.map(i => ({ menu_id: i.menu_id, quantity: i.quantity, notes: i.notes }));
      }

      await nutritionOrderApi.create(data);
      toast({ title: "Berhasil!", description: "Order gizi berhasil dibuat dan dikirim ke dapur." });
      setDialogOpen(false);
      resetForm();
      loadOrders();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error!", description: err?.response?.data?.error || "Gagal membuat order gizi." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await nutritionOrderApi.delete(deleteTarget.id);
      toast({ title: "Berhasil!", description: "Order gizi berhasil dihapus/dibatalkan." });
      loadOrders();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error!", description: err?.response?.data?.error || "Gagal menghapus order." });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Group orders by date
  const ordersByDate = orders.reduce((acc, o) => {
    const d = o.order_date?.split("T")[0] || "unknown";
    if (!acc[d]) acc[d] = [];
    acc[d].push(o);
    return acc;
  }, {} as Record<string, NutritionOrder[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" /> Order Gizi
          </h3>
          <p className="text-sm text-muted-foreground">
            Kelola pesanan makanan pasien rawat inap ke dapur
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Order Makan
          </Button>
        )}
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div>
          <div className="py-8">
            <p className="text-center text-muted-foreground text-sm">
              Belum ada order gizi untuk pasien ini.
            </p>
          </div>
        </div>
      ) : (
        Object.entries(ordersByDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateOrders]) => (
            <div key={date}>
              <div className="px-4 pb-4 space-y-3">
                {dateOrders
                  .sort((a, b) => {
                    const order = ["pagi", "snack_pagi", "siang", "snack_sore", "sore", "snack_malam"];
                    return order.indexOf(a.meal_time) - order.indexOf(b.meal_time);
                  })
                  .map((order) => (
                    <div key={order.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {nutritionMealTimeLabels[order.meal_time] || order.meal_time}
                          </Badge>
                          <Badge variant="outline">
                            {nutritionDietTypeLabels[order.diet_type] || order.diet_type}
                          </Badge>
                          <Badge className={nutritionOrderStatusColors[order.status] || ''}>
                            <span className="flex items-center gap-1">
                              {statusIcons[order.status]}
                              {nutritionOrderStatusLabels[order.status] || order.status}
                            </span>
                          </Badge>
                        </div>
                        {!readOnly && (order.status === "confirmed" || order.status === "draft") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {order.package && (
                        <p className="text-xs text-muted-foreground">
                          Paket: <span className="font-medium">{order.package.name}</span>
                        </p>
                      )}

                      {order.items && order.items.length > 0 && (
                        <div className="text-xs space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                              <span>{item.menu?.name || `Menu #${item.menu_id}`}</span>
                              <span className="text-muted-foreground">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(order.allergy_notes || order.special_notes) && (
                        <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                          {order.allergy_notes && <div>Alergi: {order.allergy_notes}</div>}
                          {order.special_notes && <div>Catatan: {order.special_notes}</div>}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {order.ordered_by && <span>Oleh: {order.ordered_by.name}</span>}
                        {order.delivered_at && (
                          <span>· Diantar: {new Date(order.delivered_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
      )}

      {/* Create Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" /> Order Makan Baru
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tanggal *</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Waktu Makan *</Label>
                <Combobox options={mealTimeOptions} value={mealTime} onValueChange={setMealTime} placeholder="Pilih..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jenis Diet *</Label>
                <Combobox options={dietTypeOptions} value={dietType} onValueChange={setDietType} placeholder="Pilih..." />
              </div>
            </div>

            <Separator />

            {/* Mode selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={orderMode === "package" ? "default" : "outline"}
                size="sm"
                onClick={() => { setOrderMode("package"); setItems([]); }}
              >
                Pilih Paket Makanan
              </Button>
              <Button
                type="button"
                variant={orderMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => { setOrderMode("manual"); setSelectedPackageId(null); }}
              >
                Pilih Menu Manual
              </Button>
            </div>

            {/* Package mode */}
            {orderMode === "package" && (
              <div className="space-y-2">
                {!dietType || !mealTime ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Pilih waktu makan dan jenis diet terlebih dahulu
                  </p>
                ) : packagesLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Tidak ada paket tersedia untuk kombinasi ini. Gunakan mode manual.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedPackageId === pkg.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-accent"
                          }`}
                        onClick={() => setSelectedPackageId(pkg.id)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">{pkg.name}</div>
                            <div className="text-xs text-muted-foreground">{pkg.code}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-orange-600">
                              <Flame className="h-3 w-3" /> {pkg.total_calories} kkal
                            </div>
                            {selectedPackageId === pkg.id && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                        {pkg.items && pkg.items.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {pkg.items.map(i => i.menu?.name || `#${i.menu_id}`).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual mode */}
            {orderMode === "manual" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Cari menu makanan..."
                    className="pl-9"
                  />
                  {menuResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
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
                  {searchLoading && menuSearch.length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground text-center">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Mencari...
                    </div>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                    Cari dan tambahkan menu di atas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={item.menu_id} className="flex items-center gap-2 rounded-lg border p-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.menu?.name}</div>
                          <div className="text-xs text-muted-foreground">{item.menu?.calories} kkal/porsi</div>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          className="w-14 h-7 text-center text-xs"
                          value={item.quantity}
                          onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Catatan Alergi</Label>
                <Textarea value={allergyNotes} onChange={(e) => setAllergyNotes(e.target.value)} rows={2} placeholder="Alergi makanan..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Catatan Khusus</Label>
                <Textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} rows={2} placeholder="Catatan tambahan..." />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Batal</Button>
            <Button onClick={handleCreateOrder} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim ke Dapur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus/Batalkan Order"
        description={`Yakin ingin menghapus order ${nutritionMealTimeLabels[deleteTarget?.meal_time || ''] || ''} ini?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
