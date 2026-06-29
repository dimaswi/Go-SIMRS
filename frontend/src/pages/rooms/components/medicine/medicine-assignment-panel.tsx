import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info, Pill, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { medicineTypeLabels, type RoomMedicine } from "@/lib/api/medicines";

interface MedicineAssignmentPanelProps {
  roomId: number;
  roomMedicines: RoomMedicine[];
  onRefresh: () => void;
  hasPermission: boolean;
  onAdd?: () => void;
  onEdit?: (rm: RoomMedicine) => void;
  onDelete?: (rmId: number) => void;
}

export function MedicineAssignmentPanel({
  roomMedicines,
  hasPermission,
  onAdd,
  onEdit,
  onDelete,
}: MedicineAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const lowStockCount = roomMedicines.filter(
    (rm) => rm.quantity <= rm.min_quantity
  ).length;

  const filteredMedicines = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roomMedicines;

    return roomMedicines.filter((item) =>
      [
        item.medicine?.name,
        item.medicine?.code,
        item.medicine?.type ? medicineTypeLabels[item.medicine.type] : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [roomMedicines, search]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Obat di ruangan ini dikelola melalui{" "}
          <strong>Permintaan Logistik</strong>. Untuk menambah stok obat,
          silakan buat permintaan melalui menu Permintaan Stok.
        </AlertDescription>
      </Alert>

      {/* Medicine Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                Obat di Ruangan
              </h2>
              <p className="text-xs text-muted-foreground">
                Daftar obat yang tersedia di ruangan ini ({roomMedicines.length}{" "}
                obat
                {lowStockCount > 0 && `, ${lowStockCount} stok rendah`})
              </p>
            </div>
          </div>
          {hasPermission && onAdd && (
            <Button onClick={onAdd} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Obat Manual
            </Button>
          )}
        </div>
        
        <div className="min-w-0 overflow-hidden rounded-lg border">
          <div className="border-b border-border/70 bg-muted/20 p-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={search} 
                onChange={(event) => setSearch(event.target.value)} 
                placeholder="Cari obat..." 
                className="pl-9 h-9" 
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/70 bg-muted/50 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Obat</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Min.</th>
                  <th className="px-4 py-3 font-medium">Harga Jual</th>
                  {hasPermission && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-background">
                {filteredMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={hasPermission ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                      Belum ada obat yang tercatat di ruangan ini.
                    </td>
                  </tr>
                ) : (
                  filteredMedicines.map((item) => {
                    const isLowStock = item.quantity <= item.min_quantity;

                    return (
                      <tr key={item.id} className="align-middle hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.medicine?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{item.medicine?.code || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {item.medicine?.type ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {medicineTypeLabels[item.medicine.type] || item.medicine.type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={isLowStock ? 'font-semibold text-yellow-600' : 'font-semibold'}>{item.quantity}</span>
                            {isLowStock ? <Badge variant="outline" className="text-[10px] font-normal">Rendah</Badge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.min_quantity}</td>
                        <td className="px-4 py-3 font-medium text-primary">
                          {item.medicine?.selling_price
                            ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(item.medicine.selling_price)
                            : '-'}
                        </td>
                        {hasPermission && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {onEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
