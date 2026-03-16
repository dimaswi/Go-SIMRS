import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pill, Clock3, MapPin } from "lucide-react";
import { formatDateTimeID } from "@/lib/print-utils";
import type { VisitMedicineItemSummary } from "@/lib/api/medical-records";

interface VisitMedicineSummaryProps {
  items?: VisitMedicineItemSummary[];
}

function joinSegments(values: Array<string | undefined | null>) {
  return values
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .join(" • ");
}

export function VisitMedicineSummary({ items = [] }: VisitMedicineSummaryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 via-background to-lime-50/60 shadow-sm">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700">
              <Pill className="h-4 w-4" />
              <span className="text-sm font-semibold">Obat Langsung dari Stok Ruangan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Item ini dicatat langsung saat pendaftaran dan sudah terhubung ke billing kunjungan.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            {items.length} item
          </Badge>
        </div>

        <div className="grid gap-3">
          {items.map((item) => {
            const medicineName = item.medicine?.name || item.medicine?.generic_name || `Obat #${item.medicine_id}`;
            const subtitle = joinSegments([
              item.medicine?.generic_name && item.medicine?.generic_name !== medicineName ? item.medicine.generic_name : undefined,
              item.medicine?.strength,
              item.route,
            ]);
            const usage = joinSegments([
              item.dosage,
              item.frequency,
              item.duration,
            ]);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-emerald-200/70 bg-background/90 p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{medicineName}</p>
                      <Badge variant="outline" className="text-[11px]">
                        {item.quantity} {item.unit || item.medicine?.unit || "unit"}
                      </Badge>
                    </div>

                    {subtitle && (
                      <p className="text-xs text-muted-foreground">{subtitle}</p>
                    )}

                    {usage && (
                      <p className="text-xs text-foreground/80">Aturan pakai: {usage}</p>
                    )}

                    {item.instructions && (
                      <p className="text-xs text-foreground/80">Instruksi: {item.instructions}</p>
                    )}

                    {item.notes && (
                      <p className="text-xs text-muted-foreground">Catatan: {item.notes}</p>
                    )}
                  </div>

                  <div className="grid gap-1 text-xs text-muted-foreground shrink-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{item.room?.name || "Ruangan tidak diketahui"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{formatDateTimeID(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}