import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  TestTube,
  ScanLine,
  Stethoscope,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, Procedure } from "@/lib/api/procedure-orders";

interface ProcedureEditOrderProps {
  visitId: number;
  orderType: "laboratory" | "radiology" | "surgery";
  readOnly?: boolean;
}

interface ItemFormData {
  procedure_id: number;
  procedureName: string;
  notes: string;
}

export function ProcedureEditOrder({ 
  visitId, 
  orderType,
  readOnly = false 
}: ProcedureEditOrderProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);
  const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcedureOrderItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [itemForm, setItemForm] = useState<ItemFormData>({
    procedure_id: 0,
    procedureName: "",
    notes: "",
  });
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ProcedureOrderItem | null>(null);

  const canEdit = hasPermission("procedure_orders.edit") && !readOnly;

  const orderTypeConfig = useMemo(() => {
    switch (orderType) {
      case "laboratory":
        return {
          title: "Edit Order Laboratorium",
          icon: TestTube,
          emptyMessage: "Tidak ada order laboratorium untuk dikerjakan",
        };
      case "radiology":
        return {
          title: "Edit Order Radiologi",
          icon: ScanLine,
          emptyMessage: "Tidak ada order radiologi untuk dikerjakan",
        };
      case "surgery":
        return {
          title: "Edit Order Operasi",
          icon: Stethoscope,
          emptyMessage: "Tidak ada order operasi untuk dikerjakan",
        };
    }
  }, [orderType]);

  useEffect(() => {
    loadOrders();
  }, [visitId, orderType]);

  useEffect(() => {
    if (selectedOrder?.target_room_id) {
      loadAvailableProcedures(selectedOrder.target_room_id);
    }
  }, [selectedOrder?.target_room_id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await procedureOrdersApi.getAll({
        target_visit_id: visitId,
        order_type: orderType,
      });
      const data = res.data || [];
      setOrders(data);
      
      // Select first pending/in_progress order
      const activeOrder = data.find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(activeOrder);
      } else if (data.length > 0) {
        setSelectedOrder(data[0]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableProcedures = async (roomId: number) => {
    try {
      const res = await procedureOrdersApi.getProceduresByRoom(roomId);
      setAvailableProcedures(res.data || []);
    } catch (error) {
      console.error("Error loading available procedures:", error);
    }
  };

  const resetItemForm = useCallback(() => {
    setItemForm({
      procedure_id: 0,
      procedureName: "",
      notes: "",
    });
    setSearchTerm("");
  }, []);

  const openAddDialog = () => {
    resetItemForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (item: ProcedureOrderItem) => {
    setEditingItem(item);
    setItemForm({
      procedure_id: item.procedure_id,
      procedureName: item.procedure?.name || "",
      notes: item.notes || "",
    });
    setShowEditDialog(true);
  };

  const handleAddItem = async () => {
    if (!selectedOrder) return;
    if (!itemForm.procedure_id) {
      toast({ variant: "destructive", title: "Pilih prosedur terlebih dahulu" });
      return;
    }

    setSubmitting(true);
    try {
      await procedureOrdersApi.addItem(selectedOrder.id, {
        procedure_id: itemForm.procedure_id,
        notes: itemForm.notes,
      });
      
      toast({ title: "Berhasil", description: "Prosedur berhasil ditambahkan" });
      setShowAddDialog(false);
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menambahkan prosedur",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedOrder || !editingItem) return;

    setSubmitting(true);
    try {
      await procedureOrdersApi.updateItem(selectedOrder.id, editingItem.id!, {
        notes: itemForm.notes,
      });
      
      toast({ title: "Berhasil", description: "Prosedur berhasil diperbarui" });
      setShowEditDialog(false);
      setEditingItem(null);
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui prosedur",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: ProcedureOrderItem) => {
    if (!selectedOrder) return;
    setDeleteConfirmItem(item);
  };

  const handleConfirmDeleteItem = async () => {
    const item = deleteConfirmItem;
    if (!item || !selectedOrder) return;
    setDeleteConfirmItem(null);

    try {
      await procedureOrdersApi.deleteItem(selectedOrder.id, item.id!);
      toast({ title: "Berhasil", description: "Prosedur berhasil dihapus" });
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus prosedur",
      });
    }
  };

  const selectProcedure = (procedure: Procedure) => {
    setItemForm(prev => ({
      ...prev,
      procedure_id: procedure.id,
      procedureName: procedure.name,
    }));
    setSearchTerm("");
  };

  const filteredProcedures = useMemo(() => {
    // Filter out procedures already in the order
    const existingProcedureIds = new Set(
      selectedOrder?.items?.map(item => item.procedure_id) || []
    );
    
    let filtered = availableProcedures.filter(
      p => !existingProcedureIds.has(p.id)
    );
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.code?.toLowerCase().includes(lower)
      );
    }
    
    return filtered.slice(0, 20);
  }, [availableProcedures, searchTerm, selectedOrder?.items]);

  const getStatusBadge = (status: string) => {
    const config = PROCEDURE_ORDER_STATUS[status as keyof typeof PROCEDURE_ORDER_STATUS] || {
      label: status,
      variant: "secondary" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Menunggu</Badge>;
      case "in_progress":
        return <Badge variant="default">Dikerjakan</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600">Selesai</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canModifyOrder = (order: ProcedureOrder | null) => {
    if (!order) return false;
    return order.status === "pending" || order.status === "in_progress";
  };

  const canModifyItem = (item: ProcedureOrderItem) => {
    return item.status === "pending";
  };

  const Icon = orderTypeConfig.icon;

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

  if (orders.length === 0) {
    return (
      <div>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Icon className="h-12 w-12 mb-4 opacity-50" />
            <p>{orderTypeConfig.emptyMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {orders.length > 1 && (
              <Select
                value={selectedOrder?.id.toString()}
                onValueChange={(val) => {
                  const order = orders.find((o) => o.id === Number(val));
                  if (order) setSelectedOrder(order);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Pilih order" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      {order.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedOrder && (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-muted-foreground">No. Order:</span>{" "}
                  <span className="font-medium">{selectedOrder.order_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {getStatusBadge(selectedOrder.status)}
                </div>
                {selectedOrder.target_room && (
                  <div>
                    <span className="text-muted-foreground">Ruangan:</span>{" "}
                    <span className="font-medium">{selectedOrder.target_room.name}</span>
                  </div>
                )}
              </div>
              {canEdit && canModifyOrder(selectedOrder) && (
                <Button size="sm" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Prosedur
                </Button>
              )}
            </div>

            {/* Items Table */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama Prosedur</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && canModifyOrder(selectedOrder) && (
                      <TableHead className="w-[100px] text-center">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Belum ada prosedur dalam order ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedOrder.items?.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.procedure?.name}</TableCell>
                        <TableCell>{item.procedure?.code || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.notes || "-"}
                        </TableCell>
                        <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                        {canEdit && canModifyOrder(selectedOrder) && (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {canModifyItem(item) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(item)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(item)}
                                    title="Hapus"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Notes */}
            {selectedOrder.clinical_notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Catatan Klinis:</span>{" "}
                <span>{selectedOrder.clinical_notes}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Procedure Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Prosedur</DialogTitle>
            <DialogDescription>
              Pilih prosedur yang tersedia di ruangan tujuan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search/Select Procedure */}
            <div className="space-y-2">
              <Label>Prosedur</Label>
              {itemForm.procedure_id ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{itemForm.procedureName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItemForm(prev => ({ ...prev, procedure_id: 0, procedureName: "" }))}
                  >
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari prosedur..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="h-[200px] border rounded-md">
                    {filteredProcedures.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">Tidak ada prosedur ditemukan</p>
                      </div>
                    ) : (
                      <div className="p-1">
                        {filteredProcedures.map((procedure) => (
                          <button
                            key={procedure.id}
                            className="w-full text-left p-2 hover:bg-muted rounded-md transition-colors"
                            onClick={() => selectProcedure(procedure)}
                          >
                            <div className="font-medium">{procedure.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {procedure.code && `Kode: ${procedure.code}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={itemForm.notes}
                onChange={(e) => setItemForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleAddItem} disabled={submitting || !itemForm.procedure_id}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Procedure Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Prosedur</DialogTitle>
            <DialogDescription>
              {editingItem?.procedure?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={itemForm.notes}
                onChange={(e) => setItemForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleUpdateItem} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Hapus Prosedur?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin menghapus {deleteConfirmItem?.procedure?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteItem}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProcedureEditOrder;
