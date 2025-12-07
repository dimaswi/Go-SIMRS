import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Trash2, Edit2, Package, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SelectedItemWithQty } from "./item-picker-dialog";

interface SelectedItemsTableProps {
  items: SelectedItemWithQty[];
  onUpdateItem: (index: number, updates: Partial<SelectedItemWithQty>) => void;
  onRemoveItem: (index: number) => void;
  onRemoveMultiple: (indices: number[]) => void;
  showPrice?: boolean;
  showBatch?: boolean;
  showExpiry?: boolean;
  emptyMessage?: string;
}

export function SelectedItemsTable({
  items,
  onUpdateItem,
  onRemoveItem,
  onRemoveMultiple,
  showPrice = false,
  showBatch = false,
  showExpiry = false,
  emptyMessage = "Belum ada item ditambahkan",
}: SelectedItemsTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkQty, setBulkQty] = useState<number>(1);
  const [bulkPrice, setBulkPrice] = useState<number>(0);

  const toggleRow = (index: number) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedRows(newSet);
  };

  const toggleAll = () => {
    if (selectedRows.size === items.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(items.map((_, i) => i)));
    }
  };

  const handleBulkDelete = () => {
    onRemoveMultiple(Array.from(selectedRows).sort((a, b) => b - a));
    setSelectedRows(new Set());
  };

  const handleBulkUpdateQty = () => {
    selectedRows.forEach((index) => {
      onUpdateItem(index, { quantity: bulkQty });
    });
  };

  const handleBulkUpdatePrice = () => {
    selectedRows.forEach((index) => {
      onUpdateItem(index, { unit_price: bulkPrice });
    });
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unit_price || 0);
  }, 0);

  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border rounded-md text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <Badge variant="secondary">{selectedRows.size} item dipilih</Badge>
          <div className="flex-1" />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-1" />
                Ubah Qty
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <Label>Jumlah Baru</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkQty}
                  onChange={(e) => setBulkQty(parseInt(e.target.value) || 1)}
                />
                <Button size="sm" className="w-full" onClick={handleBulkUpdateQty}>
                  Terapkan
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {showPrice && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Ubah Harga
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <Label>Harga Baru</Label>
                  <Input
                    type="number"
                    min={0}
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 0)}
                  />
                  <Button size="sm" className="w-full" onClick={handleBulkUpdatePrice}>
                    Terapkan
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        </div>
      )}

      {/* Table */}
      <ScrollArea className="h-[350px] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedRows.size === items.length && items.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-10"></TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Item</TableHead>
              <TableHead className="w-24 text-center">Qty</TableHead>
              <TableHead>Satuan</TableHead>
              {showPrice && <TableHead className="w-32 text-right">Harga</TableHead>}
              {showPrice && <TableHead className="w-32 text-right">Subtotal</TableHead>}
              {showBatch && <TableHead className="w-28">Batch</TableHead>}
              {showExpiry && <TableHead className="w-32">Exp. Date</TableHead>}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const subtotal = (item.quantity || 0) * (item.unit_price || 0);
              return (
                <TableRow
                  key={`${item.type}_${item.id}_${index}`}
                  className={cn(selectedRows.has(index) && "bg-muted/50")}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(index)}
                      onCheckedChange={() => toggleRow(index)}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full",
                        item.type === "medicine" ? "bg-blue-100" : "bg-green-100"
                      )}
                    >
                      {item.type === "medicine" ? (
                        <Pill className="h-3.5 w-3.5 text-blue-600" />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateItem(index, { quantity: parseInt(e.target.value) || 1 })
                      }
                      className="w-20 h-8 text-center"
                    />
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  {showPrice && (
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.unit_price || 0}
                        onChange={(e) =>
                          onUpdateItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                        }
                        className="w-28 h-8 text-right"
                      />
                    </TableCell>
                  )}
                  {showPrice && (
                    <TableCell className="text-right font-medium">
                      Rp {subtotal.toLocaleString("id-ID")}
                    </TableCell>
                  )}
                  {showBatch && (
                    <TableCell>
                      <Input
                        placeholder="Batch"
                        value={(item as any).batch_number || ""}
                        onChange={(e) =>
                          onUpdateItem(index, { batch_number: e.target.value } as any)
                        }
                        className="w-24 h-8"
                      />
                    </TableCell>
                  )}
                  {showExpiry && (
                    <TableCell>
                      <Input
                        type="date"
                        value={(item as any).expiry_date || ""}
                        onChange={(e) =>
                          onUpdateItem(index, { expiry_date: e.target.value } as any)
                        }
                        className="w-32 h-8"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{items.length} jenis</span> ({totalItems} item)
        </div>
        {showPrice && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Harga</p>
            <p className="text-xl font-bold text-primary">
              Rp {totalAmount.toLocaleString("id-ID")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
