import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { inventoryCategoryLabels, type RoomInventory } from "@/lib/api/inventories";

interface InventoryAssignmentPanelProps {
  roomId: number;
  roomInventories: RoomInventory[];
  onRefresh: () => void;
  hasPermission: boolean;
  onAdd?: () => void;
  onEdit?: (ri: RoomInventory) => void;
  onDelete?: (riId: number) => void;
}

export function InventoryAssignmentPanel({
  roomInventories,
  hasPermission,
  onAdd,
  onEdit,
  onDelete,
}: InventoryAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  // const lowStockCount = roomInventories.filter(
  //   (ri) => ri.quantity <= ri.min_quantity
  // ).length;

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
      {/* Inventory Table */}
      <div className="space-y-3">
        <div className="min-w-0 overflow-hidden rounded-lg border">
          <div className="border-b border-border/70 bg-muted/20 p-3 flex justify-between">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari inventaris..."
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {hasPermission && onAdd && (
                <Button onClick={onAdd} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Inventaris Manual
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/70 bg-muted/50 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Inventaris</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Min.</th>
                  <th className="px-4 py-3 font-medium">Satuan</th>
                  <th className="px-4 py-3 font-medium">Lokasi</th>
                  {hasPermission && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-background">
                {filteredInventories.length === 0 ? (
                  <tr>
                    <td colSpan={hasPermission ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                      Belum ada inventaris yang tercatat di ruangan ini.
                    </td>
                  </tr>
                ) : (
                  filteredInventories.map((item) => {
                    const isLowStock = item.quantity <= item.min_quantity;

                    return (
                      <tr key={item.id} className="align-middle hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.inventory?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{item.inventory?.code || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {item.inventory?.category ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {inventoryCategoryLabels[item.inventory.category] || item.inventory.category}
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
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.inventory?.unit || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs break-words">-</td>
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
