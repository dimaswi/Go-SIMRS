import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  roomsApi,
  masterDataApi,
  type RoomTariffRequest,
  type MasterData,
  ROOM_TARIFF_COMPONENTS,
} from "@/lib/api";
import { Loader2, Save, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

interface RoomTariffPanelProps {
  roomId: number;
  hasPermission: (permission: string) => boolean;
}

export function RoomTariffPanel({
  roomId,
  hasPermission,
}: RoomTariffPanelProps) {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<RoomTariffRequest[]>([]);
  const [patientClasses, setPatientClasses] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tariffRes, masterDataRes] = await Promise.all([
        roomsApi.getTariffs(roomId),
        masterDataApi.getByCategory("patient_class"),
      ]);
      const currentTariffs = tariffRes.data.data || [];
      const classes = masterDataRes.data.data || [];

      const mergedTariffs: RoomTariffRequest[] = classes.map((pc: any) => {
        const existing = currentTariffs.find((t: any) => t.patient_class === pc.code);
        if (existing) {
          return {
            patient_class: pc.code,
            akomodasi: existing.akomodasi,
            makan: existing.makan,
            perawatan: existing.perawatan,
            administrasi: existing.administrasi,
            lainnya: existing.lainnya,
            is_active: existing.is_active,
          };
        }
        return {
          patient_class: pc.code,
          akomodasi: 0,
          makan: 0,
          perawatan: 0,
          administrasi: 0,
          lainnya: 0,
          is_active: true,
        };
      });

      setPatientClasses(classes);
      setTariffs(mergedTariffs);
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data tarif.",
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await roomsApi.bulkUpdateTariffs(roomId, { tariffs });
      toast({
        title: "Berhasil!",
        description: "Tarif berhasil diperbarui.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan tarif.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTariff = (patientClass: string, component: string, value: number) => {
    setTariffs((prev) =>
      prev.map((t) =>
        t.patient_class === patientClass
          ? ({ ...t, [component]: value } as unknown as RoomTariffRequest)
          : t
      )
    );
  };

  const getTariffValue = (patientClass: string, component: string): number => {
    const tariff = tariffs.find((t) => t.patient_class === patientClass);
    return tariff ? (tariff[component as keyof RoomTariffRequest] as number) || 0 : 0;
  };

  const calculateRowTotal = (patientClass: string): number => {
    const tariff = tariffs.find((t) => t.patient_class === patientClass);
    if (!tariff) return 0;
    return ROOM_TARIFF_COMPONENTS.reduce(
      (sum: number, comp: any) => sum + ((tariff[comp.key as keyof RoomTariffRequest] as number) || 0),
      0
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tarif Ruangan</h2>
            <p className="text-xs text-muted-foreground">
              Tetapkan tarif per kelas pasien untuk ruangan ini
            </p>
          </div>
        </div>
        {hasPermission("rooms.update") && (
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 text-xs">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Simpan Semua Tarif
          </Button>
        )}
      </div>

      {/* Grid */}
      <div>
        {patientClasses.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Tidak ada data kelas pasien
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground min-w-[140px]">
                  Kelas Pasien
                </TableHead>
                {ROOM_TARIFF_COMPONENTS.map((comp: any) => (
                  <TableHead key={comp.key} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground min-w-[110px]">
                    {comp.label}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-muted-foreground min-w-[120px] font-semibold bg-muted/40">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patientClasses.map((pc: any) => (
                <TableRow key={pc.code}>
                  <TableCell className="font-medium">
                    {pc.name}
                  </TableCell>
                  {ROOM_TARIFF_COMPONENTS.map((comp: any) => (
                    <TableCell key={comp.key} className="p-1.5">
                      <Input
                        type="number"
                        className="h-8 text-right text-xs"
                        value={getTariffValue(pc.code, comp.key) || ""}
                        onChange={(e) =>
                          updateTariff(pc.code, comp.key, Number(e.target.value) || 0)
                        }
                        placeholder="0"
                        disabled={!hasPermission("rooms.update")}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold bg-muted/20">
                    {formatCurrency(calculateRowTotal(pc.code))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
