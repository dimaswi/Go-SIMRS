import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, AlertTriangle, Info } from "lucide-react";
import {
  inventoryCategoryLabels,
  type RoomInventory,
  type InventoryCategory,
} from "@/lib/api/inventories";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InventoryAssignmentPanelProps {
  roomId: number;
  roomInventories: RoomInventory[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function InventoryAssignmentPanel({
  roomInventories,
}: InventoryAssignmentPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRoomInventories = roomInventories.filter(
    (ri) =>
      searchTerm === "" ||
      ri.inventory?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ri.inventory?.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryBadgeColor = (category: InventoryCategory) => {
    const colorMap: Record<InventoryCategory, string> = {
      medical: "bg-red-100 text-red-800",
      non_medical: "bg-blue-100 text-blue-800",
      consumable: "bg-yellow-100 text-yellow-800",
      equipment: "bg-purple-100 text-purple-800",
      furniture: "bg-orange-100 text-orange-800",
      electronic: "bg-cyan-100 text-cyan-800",
      infrastructure: "bg-gray-100 text-gray-800",
    };
    return colorMap[category] || "bg-gray-100 text-gray-800";
  };

  const lowStockCount = roomInventories.filter(ri => ri.quantity <= ri.min_quantity).length;

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Inventaris di ruangan ini dikelola melalui <strong>Permintaan Logistik</strong>. 
          Untuk menambah inventaris, silakan buat permintaan melalui menu Permintaan Stok.
        </AlertDescription>
      </Alert>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau kode inventaris..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory List Card */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventaris di Ruangan ({roomInventories.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar inventaris yang tersedia di ruangan ini
              </CardDescription>
            </div>
            {lowStockCount > 0 && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {lowStockCount} stok rendah
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {filteredRoomInventories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Belum ada inventaris di ruangan ini</p>
                <p className="text-xs mt-1">Buat permintaan stok untuk menambahkan inventaris</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredRoomInventories.map((ri) => {
                  const isLowStock = ri.quantity <= ri.min_quantity;
                  return (
                    <div
                      key={ri.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                            isLowStock ? "bg-yellow-100" : "bg-green-100"
                          )}
                        >
                          {isLowStock ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          ) : (
                            <Package className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {ri.inventory?.name || "Unknown"}
                            </p>
                            {ri.inventory && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 shrink-0",
                                  getCategoryBadgeColor(ri.inventory.category)
                                )}
                              >
                                {inventoryCategoryLabels[ri.inventory.category]}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate">{ri.inventory?.code}</span>
                            {ri.inventory && (
                              <>
                                <span>•</span>
                                <span>{ri.inventory.unit}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isLowStock ? "text-yellow-600" : "text-foreground"
                          )}
                        >
                          {ri.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          min: {ri.min_quantity}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
