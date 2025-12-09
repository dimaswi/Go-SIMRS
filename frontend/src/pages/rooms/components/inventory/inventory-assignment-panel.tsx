// import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Package } from "lucide-react";
import { type RoomInventory } from "@/lib/api/inventories";
import { createInventoryColumns } from "./columns";

interface InventoryAssignmentPanelProps {
  roomId: number;
  roomInventories: RoomInventory[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function InventoryAssignmentPanel({
  roomInventories,
}: InventoryAssignmentPanelProps) {
  const lowStockCount = roomInventories.filter(
    (ri) => ri.quantity <= ri.min_quantity
  ).length;

  const columns = createInventoryColumns();

  return (
    <div className="space-y-4">
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
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                Inventaris di Ruangan
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar inventaris yang tersedia di ruangan ini ({roomInventories.length}{" "}
                item
                {lowStockCount > 0 && `, ${lowStockCount} stok rendah`})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={roomInventories}
            searchPlaceholder="Cari nama atau kode inventaris..."
            pageSize={10}

          />
        </CardContent>
      </Card>
    </div>
  );
}
