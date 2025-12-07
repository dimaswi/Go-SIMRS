import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Search, Stethoscope, Check, X } from "lucide-react";
import {
  proceduresApi,
  roomProceduresApi,
  getProcedureTypeLabel,
  calculateTotalTariff,
} from "@/lib/api/procedures";
import type { Procedure, RoomProcedure } from "@/lib/api/procedures";
import { cn } from "@/lib/utils";

interface ProcedureAssignmentPanelProps {
  roomId: number;
  roomProcedures: RoomProcedure[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function ProcedureAssignmentPanel({
  roomId,
  roomProcedures,
  onRefresh,
  hasPermission,
}: ProcedureAssignmentPanelProps) {
  const { toast } = useToast();
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadProcedures = useCallback(async () => {
    setLoadingProcedures(true);
    try {
      const res = await proceduresApi.getAll({ is_active: true });
      setProcedures(res.data.data || []);
    } catch (error) {
      console.error("Failed to load procedures:", error);
    } finally {
      setLoadingProcedures(false);
    }
  }, []);

  useEffect(() => {
    loadProcedures();
  }, [loadProcedures]);

  const assignedProcedureIds = roomProcedures.map((rp) => rp.procedure_id);

  const availableProcedures = procedures.filter(
    (proc) =>
      !assignedProcedureIds.includes(proc.id) &&
      (searchTerm === "" ||
        proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proc.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredRoomProcedures = roomProcedures.filter(
    (rp) =>
      searchTerm === "" ||
      rp.procedure?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rp.procedure?.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (procedureId: number) => {
    setAddingId(procedureId);
    try {
      await roomProceduresApi.create(roomId, {
        procedure_id: procedureId,
        is_available: true,
        max_per_day: 0,
        requires_booking: false,
        notes: "",
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil ditambahkan ke ruangan.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan tindakan.",
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (roomProcedureId: number) => {
    setRemovingId(roomProcedureId);
    try {
      await roomProceduresApi.delete(roomId, roomProcedureId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil dihapus dari ruangan.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus tindakan.",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleToggleAvailable = async (rp: RoomProcedure) => {
    try {
      await roomProceduresApi.update(roomId, rp.id, {
        ...rp,
        is_available: !rp.is_available,
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengubah status.",
      });
    }
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      consultation: "bg-blue-100 text-blue-800",
      examination: "bg-green-100 text-green-800",
      treatment: "bg-purple-100 text-purple-800",
      surgery: "bg-red-100 text-red-800",
      laboratory: "bg-yellow-100 text-yellow-800",
      radiology: "bg-cyan-100 text-cyan-800",
      therapy: "bg-orange-100 text-orange-800",
      nursing: "bg-pink-100 text-pink-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[type] || colors.other;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loadingProcedures) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau kode tindakan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Available Column */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <X className="h-4 w-4" />
              Tersedia ({availableProcedures.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Klik + untuk menambahkan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              {availableProcedures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Stethoscope className="h-8 w-8 mb-2" />
                  <p className="text-sm">Tidak ada tindakan tersedia</p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableProcedures.map((proc) => (
                    <div
                      key={proc.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <Stethoscope className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="font-medium text-sm truncate">{proc.name}</p>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1 shrink-0", getTypeBadgeColor(proc.procedure_type))}
                            >
                              {getProcedureTypeLabel(proc.procedure_type)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {proc.code} • {formatPrice(proc.tariffs?.[0] ? calculateTotalTariff(proc.tariffs[0]) : 0)}
                          </p>
                        </div>
                      </div>
                      {hasPermission && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleAdd(proc.id)}
                          disabled={addingId === proc.id}
                        >
                          {addingId === proc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Assigned Column */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4" />
              Ditugaskan ({roomProcedures.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Tindakan di ruangan ini
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              {filteredRoomProcedures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Stethoscope className="h-8 w-8 mb-2" />
                  <p className="text-sm">Belum ada tindakan ditugaskan</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredRoomProcedures.map((rp) => (
                    <div
                      key={rp.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                            rp.is_available ? "bg-green-100" : "bg-gray-100"
                          )}
                        >
                          <Stethoscope
                            className={cn(
                              "h-4 w-4",
                              rp.is_available ? "text-green-600" : "text-gray-400"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {rp.procedure?.name || "Unknown"}
                            </p>
                            {rp.procedure && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1 shrink-0",
                                  getTypeBadgeColor(rp.procedure.procedure_type)
                                )}
                              >
                                {getProcedureTypeLabel(rp.procedure.procedure_type)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="truncate">{rp.procedure?.code}</span>
                            {rp.max_per_day > 0 && (
                              <>
                                <span>•</span>
                                <span>Max {rp.max_per_day}/hari</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasPermission && (
                          <>
                            <Switch
                              checked={rp.is_available}
                              onCheckedChange={() => handleToggleAvailable(rp)}
                              className="scale-75"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRemove(rp.id)}
                              disabled={removingId === rp.id}
                            >
                              {removingId === rp.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Minus className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
