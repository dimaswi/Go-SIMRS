import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Pill, AlertTriangle, Info } from "lucide-react";
import { type RoomMedicine, medicineTypeLabels } from "@/lib/api/medicines";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MedicineAssignmentPanelProps {
  roomId: number;
  roomMedicines: RoomMedicine[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function MedicineAssignmentPanel({
  roomMedicines,
}: MedicineAssignmentPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRoomMedicines = roomMedicines.filter(
    (rm) =>
      searchTerm === "" ||
      rm.medicine?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rm.medicine?.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      ethical: "bg-blue-100 text-blue-800",
      generic: "bg-green-100 text-green-800",
      patent: "bg-purple-100 text-purple-800",
      otc: "bg-yellow-100 text-yellow-800",
      herbal: "bg-emerald-100 text-emerald-800",
      supplement: "bg-orange-100 text-orange-800",
      cosmetic: "bg-pink-100 text-pink-800",
      medical_device: "bg-cyan-100 text-cyan-800",
      consumable: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const lowStockCount = roomMedicines.filter(rm => rm.quantity <= rm.min_quantity).length;

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Obat di ruangan ini dikelola melalui <strong>Permintaan Logistik</strong>. 
          Untuk menambah stok obat, silakan buat permintaan melalui menu Permintaan Stok.
        </AlertDescription>
      </Alert>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau kode obat..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Medicine List Card */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Obat di Ruangan ({roomMedicines.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar obat yang tersedia di ruangan ini
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
            {filteredRoomMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Pill className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Belum ada obat di ruangan ini</p>
                <p className="text-xs mt-1">Buat permintaan stok untuk menambahkan obat</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredRoomMedicines.map((rm) => {
                  const isLowStock = rm.quantity <= rm.min_quantity;
                  return (
                    <div
                      key={rm.id}
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
                            <Pill className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {rm.medicine?.name || "Unknown"}
                            </p>
                            {rm.medicine && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 shrink-0",
                                  getTypeBadgeColor(rm.medicine.type)
                                )}
                              >
                                {medicineTypeLabels[rm.medicine.type] || rm.medicine.type}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate">{rm.medicine?.code}</span>
                            {rm.medicine && (
                              <>
                                <span>•</span>
                                <span>{formatPrice(rm.medicine.selling_price)}</span>
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
                          {rm.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          min: {rm.min_quantity}
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
