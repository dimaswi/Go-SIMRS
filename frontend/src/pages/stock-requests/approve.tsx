import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  stockRequestsApi,
  type StockRequest,
  stockRequestStatusLabels,
  priorityLabels,
  requestTypeLabels,
} from "@/lib/api/stock-requests";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
  Loader2,
  Package,
  Pill,
  CheckCircle,
  XCircle,
  Building,
  AlertTriangle,
  FileText,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200",
};

interface ApprovalItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  current_stock: number;
  quantity_requested: number;
  quantity_approved: number;
}

export default function StockRequestApprove() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<StockRequest | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [notes, setNotes] = useState("");

  // Reject Dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await stockRequestsApi.getById(Number(id));
      const data = response.data.data as StockRequest;
      setRequest(data);

      // Map items for approval
      const approvalItems: ApprovalItem[] = (data.items || []).map((item) => {
        const itemData = item.inventory || item.medicine;
        return {
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          current_stock: itemData?.current_stock || 0,
          quantity_requested: item.quantity_requested,
          quantity_approved: item.quantity_requested, // Default to requested amount
        };
      });
      setItems(approvalItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data permintaan stok.",
      });
      navigate("/stock-requests");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Proses Persetujuan");
    loadData();
  }, [loadData]);

  const handleItemChange = (itemId: number, quantity: number) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, quantity_approved: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleApproveAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity_approved: item.quantity_requested,
      }))
    );
  };

  const handleClearAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity_approved: 0,
      }))
    );
  };

  const handleApprove = async () => {
    // Validate at least one item has quantity
    const hasApprovedItems = items.some((item) => item.quantity_approved > 0);
    if (!hasApprovedItems) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Setidaknya satu item harus memiliki jumlah yang disetujui.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await stockRequestsApi.approve(Number(id), {
        items: items.map((item) => ({
          id: item.id,
          quantity_approved: item.quantity_approved,
        })),
        notes,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil disetujui.",
      });
      navigate(`/stock-requests/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyetujui permintaan.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Alasan penolakan wajib diisi.",
      });
      return;
    }

    setRejecting(true);
    try {
      await stockRequestsApi.reject(Number(id), {
        rejection_reason: rejectionReason,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil ditolak.",
      });
      navigate(`/stock-requests/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menolak permintaan.",
      });
    } finally {
      setRejecting(false);
      setRejectDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate("/stock-requests")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  if (request.status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-muted-foreground">
          Permintaan ini sudah diproses (Status: {stockRequestStatusLabels[request.status]})
        </p>
        <Button onClick={() => navigate(`/stock-requests/${id}`)}>
          Lihat Detail
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header Card */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/stock-requests/${id}`)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold">
                  Proses Persetujuan
                </CardTitle>
                <Badge className={statusColors[request.status]}>
                  {stockRequestStatusLabels[request.status]}
                </Badge>
              </div>
              <CardDescription>
                {request.request_number} • {requestTypeLabels[request.request_type]} •{" "}
                <Badge variant="outline" className={priorityColors[request.priority]}>
                  Prioritas: {priorityLabels[request.priority]}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* From Room */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                Dari Ruangan
              </div>
              <p className="font-medium">
                {request.from_room?.code} - {request.from_room?.name}
              </p>
            </div>

            {/* To Room */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                Ke Ruangan (Anda)
              </div>
              <p className="font-medium">
                {request.to_room?.code} - {request.to_room?.name}
              </p>
            </div>

            {/* Requested By */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Diminta Oleh
              </div>
              <p className="font-medium">{request.requested_by?.full_name || "-"}</p>
            </div>
          </div>

          {request.reason && (
            <>
              <Separator className="my-4" />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Alasan Permintaan</div>
                <p className="text-sm">{request.reason}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Items Approval Card */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Daftar Item</CardTitle>
              <CardDescription>Tentukan jumlah yang disetujui untuk setiap item</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleApproveAll}>
                Setujui Semua
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead className="text-center">Stok Tersedia</TableHead>
                <TableHead className="text-center">Qty Diminta</TableHead>
                <TableHead className="text-center">Qty Disetujui</TableHead>
                <TableHead>Satuan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.inventory_id ? (
                        <Package className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Pill className="h-4 w-4 text-green-500" />
                      )}
                      {item.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        item.current_stock >= item.quantity_requested
                          ? "default"
                          : "destructive"
                      }
                    >
                      {item.current_stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.quantity_requested}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Input
                        type="number"
                        min={0}
                        max={Math.min(item.quantity_requested, item.current_stock)}
                        value={item.quantity_approved}
                        onChange={(e) =>
                          handleItemChange(item.id, parseInt(e.target.value) || 0)
                        }
                        className="w-24 text-center"
                      />
                    </div>
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-6" />

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan Persetujuan</Label>
            <Textarea
              placeholder="Catatan tambahan untuk persetujuan ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => navigate(`/stock-requests/${id}`)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Tolak
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Setujui
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Permintaan</DialogTitle>
            <DialogDescription>
              Berikan alasan mengapa permintaan ini ditolak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Alasan Penolakan *</Label>
              <Textarea
                placeholder="Jelaskan alasan penolakan..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tolak Permintaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
