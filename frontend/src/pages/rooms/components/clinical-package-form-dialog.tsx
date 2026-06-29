import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, Loader2 } from "lucide-react";
import { clinicalPackagesApi, roomClinicalPackagesApi, type ClinicalPackage } from "@/lib/api/clinical-packages";
import { useToast } from "@/hooks/use-toast";

interface RoomClinicalPackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  assignedPackageIds: number[];
  onSuccess: () => void;
}

export function RoomClinicalPackageFormDialog({
  open,
  onOpenChange,
  roomId,
  assignedPackageIds,
  onSuccess,
}: RoomClinicalPackageFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<ClinicalPackage[]>([]);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clinicalPackagesApi.getAll({ is_active: true, limit: 200 });
      setPackages(res.data.data || []);
    } catch (error) {
      console.error("Failed to load packages:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadPackages();
      setSearch("");
    }
  }, [open, loadPackages]);

  const availablePackages = useMemo(() => {
    return packages.filter((pkg) => !assignedPackageIds.includes(pkg.id));
  }, [packages, assignedPackageIds]);

  const filteredPackages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availablePackages;

    return availablePackages.filter((pkg) =>
      [pkg.name, pkg.code, pkg.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [availablePackages, search]);

  const handleAdd = async (packageId: number) => {
    setAddingId(packageId);
    try {
      await roomClinicalPackagesApi.create(roomId, {
        clinical_package_id: packageId,
        is_active: true,
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Paket klinis berhasil ditambahkan ke ruangan.",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan paket klinis.",
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Tambah Paket Klinis</DialogTitle>
          <DialogDescription>
            Pilih dan tambahkan paket klinis ke ruangan ini
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari paket klinis..."
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-auto rounded-md border min-h-[300px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
                Tidak ada paket klinis tersedia.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paket</th>
                    <th className="px-4 py-3 font-medium">Isi</th>
                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-background">
                  {filteredPackages.map((pkg) => (
                    <tr key={pkg.id} className="align-middle hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{pkg.name}</div>
                        <div className="text-xs text-muted-foreground">{pkg.code}</div>
                        {pkg.description && (
                          <div className="mt-1 text-xs text-muted-foreground">{pkg.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px] font-normal">{pkg.procedure_items?.length || 0} tindakan</Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">{pkg.medicine_items?.length || 0} obat</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleAdd(pkg.id)}
                          disabled={addingId === pkg.id}
                        >
                          {addingId === pkg.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <PlusCircle className="mr-2 h-4 w-4" />
                          )}
                          Tambah
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
