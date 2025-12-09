import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";
import {
  proceduresApi,
  roomProceduresApi,
} from "@/lib/api/procedures";
import type { Procedure, RoomProcedure } from "@/lib/api/procedures";
import { createProcedureColumns } from "./columns";
import { createAvailableProcedureColumns } from "./available-columns";

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
  const [addingId, setAddingId] = useState<number | null>(null);

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
    (proc) => !assignedProcedureIds.includes(proc.id)
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
    }
  };

  const assignedColumns = createProcedureColumns({
    onRemove: handleRemove,
    hasPermission,
  });

  const availableColumns = createAvailableProcedureColumns({
    onAdd: handleAdd,
    hasPermission,
    addingId,
  });

  if (loadingProcedures) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Available Column */}
        <Card className="shadow-md">
          <CardHeader className="py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <X className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Tersedia ({availableProcedures.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Tindakan yang belum ditugaskan
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <DataTable
              columns={availableColumns}
              data={availableProcedures}

            />
          </CardContent>
        </Card>

        {/* Assigned Column */}
        <Card className="shadow-md">
          <CardHeader className="py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Ditugaskan ({roomProcedures.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Tindakan di ruangan ini
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <DataTable
              columns={assignedColumns}
              data={roomProcedures}

            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
