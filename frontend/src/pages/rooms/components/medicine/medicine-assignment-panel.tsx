import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Info, Pill, Search } from "lucide-react";
import { medicineTypeLabels, type RoomMedicine } from "@/lib/api/medicines";

interface MedicineAssignmentPanelProps {
  roomId: number;
  roomMedicines: RoomMedicine[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function MedicineAssignmentPanel({
  roomId,
  roomMedicines,
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
        <div className="min-w-0 overflow-hidden rounded-lg border">
          {roomMedicines.length > 0 ? (
            <>
              <div className="border-b border-border/70 px-3 py-3">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari obat..." className="pl-9" />
                </div>
              </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[34%] px-3 py-2.5 font-medium">Obat</th>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Tipe</th>
                    <th className="w-[14%] px-3 py-2.5 font-medium">Stok</th>
                    <th className="w-[12%] px-3 py-2.5 font-medium">Min.</th>
                    <th className="w-[22%] px-3 py-2.5 font-medium">Harga Jual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredMedicines.map((item) => {
                    const isLowStock = item.quantity <= item.min_quantity;

                    return (
                      <tr key={item.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium break-words">{item.medicine?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground break-words">{item.medicine?.code || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          {item.medicine?.type ? (
                            <Badge variant="outline" className="text-xs">
                              {medicineTypeLabels[item.medicine.type] || item.medicine.type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className={isLowStock ? 'font-semibold text-yellow-600' : 'font-semibold'}>{item.quantity}</span>
                            {isLowStock ? <Badge variant="outline" className="text-[10px]">Rendah</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{item.min_quantity}</td>
                        <td className="px-3 py-3 text-muted-foreground break-words">
                          {item.medicine?.selling_price
                            ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(item.medicine.selling_price)
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada obat yang tercatat di ruangan ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
