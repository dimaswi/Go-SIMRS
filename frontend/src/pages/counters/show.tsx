import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { counterApi } from "@/lib/api/counters";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";

export default function CounterShow() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [counter, setCounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setPageTitle("Detail Loket");
    loadCounter();
  }, [id]);

  const loadCounter = async () => {
    try {
      const data = await counterApi.getCounter(Number(id));
      setCounter(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memuat data loket.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteDialogOpen(false);
    try {
      await counterApi.deleteCounter(Number(id!));
      toast({
        title: "Berhasil!",
        description: "Loket berhasil dihapus.",
      });
      setTimeout(() => navigate("/counters"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus loket.",
      });
      setDeleting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!counter) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Loket tidak ditemukan</p>
          <Button onClick={() => navigate("/counters")} className="mt-4">
            Kembali ke Daftar Loket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/counters")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold font-mono">
                  {counter.code} - {counter.name}
                </CardTitle>
                <CardDescription>
                  {counter.description || "Tidak ada deskripsi"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission("counters.update") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/counters/${id}/edit`)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {hasPermission("counters.delete") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Hapus
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">

          {/* Informasi Loket */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              INFORMASI LOKET
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Kode Loket</label>
                <p className="font-medium text-sm font-mono">{counter.code}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nama Loket</label>
                <p className="font-medium text-sm">{counter.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={counter.is_active ? "default" : "secondary"}>
                    {counter.is_active ? "Aktif" : "Tidak Aktif"}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Deskripsi</label>
                <p className="font-medium text-sm">{counter.description || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Lokasi</label>
                <p className="font-medium text-sm">{counter.location || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Urutan Tampilan</label>
                <p className="font-medium text-sm">{counter.display_order ?? 0}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              INFORMASI SISTEM
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">ID Loket</label>
                <p className="font-medium text-sm">#{counter.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dibuat</label>
                <p className="font-medium text-sm">{formatDate(counter.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDate(counter.updated_at)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Loket"
        description="Apakah Anda yakin ingin menghapus loket ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
