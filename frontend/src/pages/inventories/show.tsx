import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  inventoriesApi,
  type Inventory,
  type InventoryItem,
  type InventoryTransaction,
  type InventoryCategory,
  type InventoryCondition,
  type InventoryStatus,
  inventoryCategoryLabels,
  inventoryConditionLabels,
  inventoryStatusLabels,
} from "@/lib/api/inventories";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  XCircle,
  Check,
  X,
  ShoppingCart,
  ClipboardList,
  Send,
  FileText,
} from "lucide-react";

const categoryColors: Record<InventoryCategory, string> = {
  medical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  non_medical: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  consumable: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  equipment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  furniture: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  electronic: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  infrastructure: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const conditionColors: Record<InventoryCondition, string> = {
  new: "bg-green-100 text-green-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-yellow-100 text-yellow-800",
  damaged: "bg-orange-100 text-orange-800",
  broken: "bg-red-100 text-red-800",
  disposed: "bg-gray-100 text-gray-800",
};

const statusColors: Record<InventoryStatus, string> = {
  available: "bg-green-100 text-green-800",
  in_use: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  reserved: "bg-purple-100 text-purple-800",
  disposed: "bg-gray-100 text-gray-800",
};

const conditionOptions: ComboboxOption[] = [
  { value: "new", label: "Baru" },
  { value: "good", label: "Baik" },
  { value: "fair", label: "Cukup" },
  { value: "damaged", label: "Rusak Ringan" },
  { value: "broken", label: "Rusak Berat" },
  { value: "disposed", label: "Dihapuskan" },
];

const statusOptions: ComboboxOption[] = [
  { value: "available", label: "Tersedia" },
  { value: "in_use", label: "Sedang Digunakan" },
  { value: "maintenance", label: "Dalam Perawatan" },
  { value: "reserved", label: "Direservasi" },
  { value: "disposed", label: "Dihapuskan" },
];

export default function InventoryShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  
  // Item Dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemForm, setItemForm] = useState({
    serial_number: "",
    asset_number: "",
    barcode: "",
    condition: "new" as InventoryCondition,
    status: "available" as InventoryStatus,
    purchase_price: 0,
    supplier: "",
    notes: "",
  });

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [inventoryRes, itemsRes, transactionsRes] = await Promise.all([
        inventoriesApi.getById(Number(id)),
        inventoriesApi.getItems(Number(id)),
        inventoriesApi.getTransactions(Number(id)),
      ]);
      
      setInventory(inventoryRes.data.data);
      setItems(itemsRes.data.data || []);
      setTransactions(transactionsRes.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data inventaris.",
      });
      navigate("/inventories");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Detail Inventaris");
    loadData();
  }, [loadData]);

  const handleCreateItem = async () => {
    setItemLoading(true);
    try {
      await inventoriesApi.createItem(Number(id), itemForm);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Item inventaris berhasil ditambahkan.",
      });
      setItemDialogOpen(false);
      setItemForm({
        serial_number: "",
        asset_number: "",
        barcode: "",
        condition: "new",
        status: "available",
        purchase_price: 0,
        supplier: "",
        notes: "",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan item.",
      });
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    try {
      await inventoriesApi.deleteItem(Number(id), itemToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Item berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus item.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "in":
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case "out":
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case "purchase":
        return <ShoppingCart className="h-4 w-4 text-blue-600" />;
      case "opname":
        return <ClipboardList className="h-4 w-4 text-purple-600" />;
      case "distribution":
        return <Send className="h-4 w-4 text-cyan-600" />;
      case "request":
        return <FileText className="h-4 w-4 text-orange-600" />;
      case "adjustment":
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case "disposal":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "in":
        return "Barang Masuk";
      case "out":
        return "Barang Keluar";
      case "purchase":
        return "Pembelian";
      case "opname":
        return "Stok Opname";
      case "distribution":
        return "Distribusi";
      case "request":
        return "Permintaan";
      case "adjustment":
        return "Penyesuaian";
      case "disposal":
        return "Penghapusan";
      default:
        return type;
    }
  };

  if (loading || !inventory) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {inventory.name}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-mono">{inventory.code}</span>
              <Badge className={categoryColors[inventory.category]}>
                {inventoryCategoryLabels[inventory.category]}
              </Badge>
              <Badge variant={inventory.is_active ? "default" : "secondary"}>
                {inventory.is_active ? "Aktif" : "Tidak Aktif"}
              </Badge>
            </p>
          </div>
        </div>
        {hasPermission("inventories.update") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/inventories/${id}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="rounded-lg border p-6">
          <Tabs defaultValue="detail" variant="inline">
            <TabsList>
              <TabsTrigger value="detail">Detail</TabsTrigger>
              <TabsTrigger value="items">
                Item ({items.length})
              </TabsTrigger>
              <TabsTrigger value="transactions">
                Transaksi ({transactions.length})
              </TabsTrigger>
            </TabsList>

            {/* Detail Tab */}
            <TabsContent value="detail" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informasi Umum */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Informasi Umum
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Merek</span>
                      <span className="text-sm font-medium">
                        {inventory.brand || "-"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Model</span>
                      <span className="text-sm font-medium">
                        {inventory.model || "-"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Satuan</span>
                      <span className="text-sm font-medium">{inventory.unit}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Harga Satuan
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(inventory.price)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Informasi Stok */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Informasi Stok
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Stok Saat Ini
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          inventory.current_stock <= inventory.min_stock
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {inventory.current_stock}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Stok Minimum
                      </span>
                      <span className="text-sm font-medium">
                        {inventory.min_stock}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Stok Maksimum
                      </span>
                      <span className="text-sm font-medium">
                        {inventory.max_stock}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Total Nilai
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(inventory.total_value)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Properti */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Properti
                </h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    {inventory.is_consumable ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Habis Pakai</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {inventory.is_reusable ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Dapat Dipakai Ulang</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {inventory.require_serial ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Wajib Serial Number</span>
                  </div>
                </div>
              </div>

              {/* Deskripsi & Spesifikasi */}
              {(inventory.description || inventory.specifications) && (
                <div className="space-y-4">
                  {inventory.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                        Deskripsi
                      </h3>
                      <p className="text-sm">{inventory.description}</p>
                    </div>
                  )}
                  {inventory.specifications && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                        Spesifikasi
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">
                        {inventory.specifications}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items" className="pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold">Daftar Item</h3>
                {hasPermission("inventories.create") && (
                  <Button size="sm" onClick={() => setItemDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Item
                  </Button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada item terdaftar
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Asset Number</TableHead>
                      <TableHead>Kondisi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">
                          {item.serial_number || "-"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {item.asset_number || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={conditionColors[item.condition]}>
                            {inventoryConditionLabels[item.condition]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[item.status]}>
                            {inventoryStatusLabels[item.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {hasPermission("inventories.delete") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setItemToDelete(item.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold">Riwayat Transaksi</h3>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada riwayat transaksi
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Stok Sebelum</TableHead>
                      <TableHead className="text-right">Stok Setelah</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {formatDate(tx.transaction_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.transaction_type)}
                            <span>{getTransactionLabel(tx.transaction_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            ["in", "purchase"].includes(tx.transaction_type)
                              ? "text-green-600"
                              : ["out", "distribution", "disposal"].includes(tx.transaction_type)
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          {["in", "purchase"].includes(tx.transaction_type) ? "+" : 
                           ["out", "distribution", "disposal"].includes(tx.transaction_type) ? "-" : ""}
                          {tx.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.previous_stock}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {tx.current_stock}
                        </TableCell>
                        <TableCell>{tx.reference_number || "-"}</TableCell>
                        <TableCell>{tx.reason || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
      </div>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Item</DialogTitle>
            <DialogDescription>
              Tambahkan item baru untuk inventaris ini
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  placeholder="SN-XXX"
                  value={itemForm.serial_number}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, serial_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset_number">Asset Number</Label>
                <Input
                  id="asset_number"
                  placeholder="AST-XXX"
                  value={itemForm.asset_number}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, asset_number: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                placeholder="Barcode"
                value={itemForm.barcode}
                onChange={(e) =>
                  setItemForm({ ...itemForm, barcode: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Combobox
                  options={conditionOptions}
                  value={itemForm.condition}
                  onValueChange={(value) =>
                    setItemForm({
                      ...itemForm,
                      condition: value as InventoryCondition,
                    })
                  }
                  placeholder="Pilih kondisi"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Combobox
                  options={statusOptions}
                  value={itemForm.status}
                  onValueChange={(value) =>
                    setItemForm({
                      ...itemForm,
                      status: value as InventoryStatus,
                    })
                  }
                  placeholder="Pilih status"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Harga Beli</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  placeholder="0"
                  value={itemForm.purchase_price || ""}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      purchase_price: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  placeholder="Nama supplier"
                  value={itemForm.supplier}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, supplier: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_notes">Catatan</Label>
              <Textarea
                id="item_notes"
                placeholder="Catatan tambahan..."
                value={itemForm.notes}
                onChange={(e) =>
                  setItemForm({ ...itemForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemDialogOpen(false)}
            >
              Batal
            </Button>
            <Button onClick={handleCreateItem} disabled={itemLoading}>
              {itemLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteItem}
        title="Hapus Item"
        description="Apakah Anda yakin ingin menghapus item ini?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
