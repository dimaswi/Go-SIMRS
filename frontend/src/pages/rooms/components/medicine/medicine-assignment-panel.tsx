import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Pill } from "lucide-react";
import { type RoomMedicine } from "@/lib/api/medicines";
import { createMedicineColumns } from "./columns";

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
  const lowStockCount = roomMedicines.filter(
    (rm) => rm.quantity <= rm.min_quantity
  ).length;

  const columns = createMedicineColumns();

  return (
    <div className="space-y-4">
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
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                Obat di Ruangan
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar obat yang tersedia di ruangan ini ({roomMedicines.length}{" "}
                obat
                {lowStockCount > 0 && `, ${lowStockCount} stok rendah`})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={roomMedicines}
            searchPlaceholder="Cari nama atau kode obat..."
            pageSize={10}
            tableId={`room_medicine_${roomId}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
