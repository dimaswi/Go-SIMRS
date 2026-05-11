import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Info, Package, Search } from "lucide-react";
import { inventoryCategoryLabels, type RoomInventory } from "@/lib/api/inventories";

interface InventoryAssignmentPanelProps {
  roomId: number;
  roomInventories: RoomInventory[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function InventoryAssignmentPanel({
  roomInventories,
}: InventoryAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const lowStockCount = roomInventories.filter(
    (ri) => ri.quantity <= ri.min_quantity
  ).length;

  const filteredInventories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roomInventories;

    return roomInventories.filter((item) =>
      [
        item.inventory?.name,
        item.inventory?.code,
        item.inventory?.category ? inventoryCategoryLabels[item.inventory.category] : '',
        item.inventory?.unit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [roomInventories, search]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Inventaris di ruangan ini dikelola melalui{" "}
          <strong>Permintaan Logistik</strong>. Untuk menambah inventaris,
          silakan buat permintaan melalui menu Permintaan Stok.
        </AlertDescription>
      </Alert>

      {/* Inventory Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">
              Inventaris di Ruangan
            </h2>
            <p className="text-xs text-muted-foreground">
              Daftar inventaris yang tersedia di ruangan ini ({roomInventories.length}{" "}
              item
              {lowStockCount > 0 && `, ${lowStockCount} stok rendah`})
            </p>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-lg border">
          {roomInventories.length > 0 ? (
            <>
              <div className="border-b border-border/70 px-3 py-3">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari inventaris..." className="pl-9" />
                </div>
              </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[30%] px-3 py-2.5 font-medium">Inventaris</th>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Kategori</th>
                    <th className="w-[14%] px-3 py-2.5 font-medium">Stok</th>
                    <th className="w-[10%] px-3 py-2.5 font-medium">Min.</th>
                    <th className="w-[12%] px-3 py-2.5 font-medium">Satuan</th>
                    <th className="w-[16%] px-3 py-2.5 font-medium">Lokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredInventories.map((item) => {
                    const isLowStock = item.quantity <= item.min_quantity;

                    return (
                      <tr key={item.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium break-words">{item.inventory?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground break-words">{item.inventory?.code || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          {item.inventory?.category ? (
                            <Badge variant="outline" className="text-xs">
                              {inventoryCategoryLabels[item.inventory.category] || item.inventory.category}
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
                        <td className="px-3 py-3 text-muted-foreground">{item.inventory?.unit || '-'}</td>
                        <td className="px-3 py-3 text-muted-foreground break-words">-</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada inventaris yang tercatat di ruangan ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
