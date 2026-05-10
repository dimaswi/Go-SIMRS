import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, PlusCircle, Trash2, Search } from "lucide-react";
import {
  proceduresApi,
  roomProceduresApi,
  calculateTotalTariff,
  getProcedureTypeLabel,
} from "@/lib/api/procedures";
import type { Procedure, RoomProcedure } from "@/lib/api/procedures";

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
  const [availableSearch, setAvailableSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");

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

  const filteredAvailableProcedures = useMemo(() => {
    const query = availableSearch.trim().toLowerCase();
    if (!query) return availableProcedures;

    return availableProcedures.filter((procedure) =>
      [procedure.name, procedure.code, getProcedureTypeLabel(procedure.procedure_type)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [availableProcedures, availableSearch]);

  const filteredAssignedProcedures = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    if (!query) return roomProcedures;

    return roomProcedures.filter((item) =>
      [
        item.procedure?.name,
        item.procedure?.code,
        item.procedure?.procedure_type ? getProcedureTypeLabel(item.procedure.procedure_type) : '',
        item.is_available ? 'tersedia' : 'tidak tersedia',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [assignedSearch, roomProcedures]);

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

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loadingProcedures) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Two Column Layout */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Available Column */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <X className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Tersedia ({availableProcedures.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Tindakan yang belum ditugaskan
              </p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={availableSearch} onChange={(event) => setAvailableSearch(event.target.value)} placeholder="Cari tindakan tersedia..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[44%] px-3 py-2.5 font-medium">Tindakan</th>
                    <th className="w-[22%] px-3 py-2.5 font-medium">Tipe</th>
                    <th className="w-[20%] px-3 py-2.5 font-medium">Tarif</th>
                    <th className="w-[14%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAvailableProcedures.map((procedure) => {
                    const tariff = procedure.tariffs?.[0];
                    const total = tariff ? calculateTotalTariff(tariff) : 0;

                    return (
                      <tr key={procedure.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium break-words">{procedure.name}</div>
                          <div className="text-xs text-muted-foreground break-words">{procedure.code}</div>
                        </td>
                        <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{getProcedureTypeLabel(procedure.procedure_type)}</Badge></td>
                        <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(total)}</td>
                        <td className="px-3 py-3 text-right">
                          {hasPermission ? (
                            <Button size="sm" variant="ghost" onClick={() => handleAdd(procedure.id)} disabled={addingId === procedure.id} className="h-8">
                              {addingId === procedure.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4 text-green-500" />}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Assigned Column */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Ditugaskan ({roomProcedures.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Tindakan di ruangan ini
              </p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={assignedSearch} onChange={(event) => setAssignedSearch(event.target.value)} placeholder="Cari tindakan ditugaskan..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[28%] px-3 py-2.5 font-medium">Tindakan</th>
                    <th className="w-[16%] px-3 py-2.5 font-medium">Tipe</th>
                    <th className="w-[14%] px-3 py-2.5 font-medium">Tarif</th>
                    <th className="w-[12%] px-3 py-2.5 font-medium">Status</th>
                    <th className="w-[10%] px-3 py-2.5 font-medium">Booking</th>
                    <th className="w-[10%] px-3 py-2.5 font-medium">Maks</th>
                    <th className="w-[10%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAssignedProcedures.map((item) => {
                    const tariff = item.procedure?.tariffs?.[0];
                    const total = tariff ? calculateTotalTariff(tariff) : 0;

                    return (
                      <tr key={item.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium break-words">{item.procedure?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground break-words">{item.procedure?.code || '-'}</div>
                        </td>
                        <td className="px-3 py-3">{item.procedure?.procedure_type ? <Badge variant="outline" className="text-[10px]">{getProcedureTypeLabel(item.procedure.procedure_type)}</Badge> : <span className="text-muted-foreground">-</span>}</td>
                        <td className="px-3 py-3 text-primary break-words">{tariff ? formatCurrency(total) : '-'}</td>
                        <td className="px-3 py-3"><Badge variant={item.is_available ? 'default' : 'secondary'} className="text-[10px]">{item.is_available ? 'Tersedia' : 'Tidak Tersedia'}</Badge></td>
                        <td className="px-3 py-3"><Badge variant={item.requires_booking ? 'outline' : 'secondary'} className="text-[10px]">{item.requires_booking ? 'Ya' : 'Tidak'}</Badge></td>
                        <td className="px-3 py-3 text-muted-foreground">{item.max_per_day > 0 ? item.max_per_day : 'Unlimited'}</td>
                        <td className="px-3 py-3 text-right">
                          {hasPermission ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemove(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
