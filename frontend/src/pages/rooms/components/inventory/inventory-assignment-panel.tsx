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
    <div className="min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari inventaris..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        {hasPermission && onAdd && (
          <Button onClick={onAdd} size="sm" className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Inventaris Manual
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/70 bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Inventaris</th>
              <th className="px-3 py-2 font-medium">Kategori</th>
              <th className="px-3 py-2 font-medium">Stok</th>
              <th className="px-3 py-2 font-medium">Min.</th>
              <th className="px-3 py-2 font-medium">Satuan</th>
              <th className="px-3 py-2 font-medium">Lokasi</th>
              {hasPermission && <th className="px-4 py-2 text-right font-medium">Aksi</th>}
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
                  <tr key={item.id} className="align-middle hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.inventory?.name || 'Unknown'}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{item.inventory?.code || '-'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.inventory?.category ? (
                        <Badge variant="outline" className="h-5 text-[10px] font-normal">
                          {inventoryCategoryLabels[item.inventory.category] || item.inventory.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={isLowStock ? 'font-semibold text-yellow-600' : 'font-semibold'}>{item.quantity}</span>
                        {isLowStock ? <Badge variant="outline" className="h-4 text-[10px] font-normal">Rendah</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.min_quantity}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.inventory?.unit || '-'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground break-words">-</td>
                    {hasPermission && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
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
  );
}
