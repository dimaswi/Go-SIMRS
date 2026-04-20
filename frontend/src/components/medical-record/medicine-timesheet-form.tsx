import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { medicineOrdersApi } from "@/lib/api";
import type {
  MedicationTimesheetItem,
  MedicationTimesheetStatus,
} from "@/lib/api";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "@/components/medical-record/tab-indicator";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface MedicineTimesheetFormProps {
  visitId: number;
  readOnly?: boolean;
}

const TIMESHEET_HOURS = Array.from({ length: 24 }, (_, i) => i);

export function MedicineTimesheetForm({ visitId, readOnly = false }: MedicineTimesheetFormProps) {
  const { toast } = useToast();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 });
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const [timesheetDate, setTimesheetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetItems, setTimesheetItems] = useState<MedicationTimesheetItem[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<Record<string, MedicationTimesheetStatus>>({});
  const [timesheetSavingKey, setTimesheetSavingKey] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const getCellKey = (orderItemId: number, hour: number) => `${orderItemId}-${hour}`;

  const getCellStatus = (orderItemId: number, hour: number) => {
    return timesheetEntries[getCellKey(orderItemId, hour)];
  };

  const getTimesheetCellClassName = (status?: MedicationTimesheetStatus) => {
    switch (status) {
      case "given":
        return "bg-emerald-500 text-white hover:bg-emerald-600";
      case "held":
        return "bg-amber-500 text-white hover:bg-amber-600";
      case "skipped":
        return "bg-rose-500 text-white hover:bg-rose-600";
      case "scheduled":
        return "bg-sky-500 text-white hover:bg-sky-600";
      default:
        return "bg-muted/50 text-muted-foreground hover:bg-muted";
    }
  };

  const loadTimesheet = async () => {
    setTimesheetLoading(true);
    try {
      const res = await medicineOrdersApi.getTimesheet(visitId, timesheetDate);
      const data = res.data;
      const items = data.items || [];
      setTimesheetItems(items);
      emitMedicalRecordTabIndicator("medicine-timesheet", `${items.length}`);
      emitMedicalRecordTabSaved("medicine-timesheet", items.length > 0);

      const mappedEntries: Record<string, MedicationTimesheetStatus> = {};
      (data.entries || []).forEach((entry) => {
        const hour = new Date(entry.scheduled_at).getHours();
        mappedEntries[getCellKey(entry.medicine_order_item_id, hour)] = entry.status;
      });
      setTimesheetEntries(mappedEntries);
    } catch (error: any) {
      emitMedicalRecordTabIndicator("medicine-timesheet", "0");
      emitMedicalRecordTabSaved("medicine-timesheet", false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat timesheet obat ruangan",
      });
    } finally {
      setTimesheetLoading(false);
    }
  };

  const handleToggleTimesheetCell = async (orderItemId: number, hour: number) => {
    if (readOnly) {
      return;
    }

    const statusFlow: Array<MedicationTimesheetStatus | ""> = ["", "given", "held", "skipped"];
    const key = getCellKey(orderItemId, hour);
    if (inFlightKeysRef.current.has(key)) {
      return;
    }
    const currentStatus = timesheetEntries[key] || "";
    const currentIndex = statusFlow.indexOf(currentStatus as MedicationTimesheetStatus | "");
    const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];
    const previousEntries = { ...timesheetEntries };

    inFlightKeysRef.current.add(key);
    setTimesheetSavingKey(key);
    setTimesheetEntries((prev) => {
      const updated = { ...prev };
      if (!nextStatus) {
        delete updated[key];
      } else {
        updated[key] = nextStatus;
      }
      return updated;
    });

    try {
      await medicineOrdersApi.upsertTimesheetEntry({
        visit_id: visitId,
        medicine_order_item_id: orderItemId,
        date: timesheetDate,
        hour,
        status: nextStatus,
      });
    } catch (error: any) {
      setTimesheetEntries(previousEntries);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan timesheet",
      });
    } finally {
      inFlightKeysRef.current.delete(key);
      setTimesheetSavingKey(null);
    }
  };

  const updateHorizontalScrollState = () => {
    const container = tableScrollRef.current;
    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setCanScrollLeft(container.scrollLeft > 2);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 2);
  };

  const scrollHours = (direction: "left" | "right") => {
    const container = tableScrollRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction === "left" ? -336 : 336,
      behavior: "smooth",
    });
  };

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = tableScrollRef.current;
    if (!container) return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
    setIsDragging(true);
  };

  const handleDragMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = tableScrollRef.current;
    if (!container || !dragStateRef.current.isDragging) return;

    event.preventDefault();
    const deltaX = event.clientX - dragStateRef.current.startX;
    container.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
  };

  const handleDragEnd = () => {
    if (!dragStateRef.current.isDragging) return;
    dragStateRef.current.isDragging = false;
    setIsDragging(false);
  };

  const handleTableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = tableScrollRef.current;
    if (!container) return;

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft <= 0) return;

    container.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  useEffect(() => {
    loadTimesheet();
  }, [visitId, timesheetDate]);

  useEffect(() => {
    updateHorizontalScrollState();

    const container = tableScrollRef.current;
    if (!container) return;

    const onScroll = () => updateHorizontalScrollState();
    const onResize = () => updateHorizontalScrollState();

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [timesheetItems, timesheetLoading]);

  return (
    <div className="space-y-4">
      <div className="border border-border/70 bg-muted/20 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Timesheet Pemberian Obat Ruangan</p>
            <p className="text-xs text-muted-foreground">
              Klik sel per jam untuk mengubah status: kosong - diberikan - ditahan - dilewati.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="timesheet-date" className="text-xs text-muted-foreground">Tanggal</Label>
            <Input
              id="timesheet-date"
              type="date"
              value={timesheetDate}
              onChange={(e) => setTimesheetDate(e.target.value)}
              className="h-9 w-[170px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-emerald-500 hover:bg-emerald-500">Diberikan</Badge>
          <Badge className="bg-amber-500 hover:bg-amber-500">Ditahan</Badge>
          <Badge className="bg-rose-500 hover:bg-rose-500">Dilewati</Badge>
          <Badge variant="outline">Kosong: belum dicatat</Badge>
        </div>
      </div>

      {timesheetLoading ? (
        <div className="flex items-center justify-center h-44 border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : timesheetItems.length === 0 ? (
        <div className="text-center py-10 border rounded-lg text-muted-foreground">
          <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada obat dengan kategori dipakai di ruangan</p>
          <p className="text-xs mt-1">Buat order obat dengan pemakaian "Dipakai di Ruangan".</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">
              Geser kolom jam dengan drag tabel atau tombol panah.
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => scrollHours("left")}
                disabled={!canScrollLeft}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => scrollHours("right")}
                disabled={!canScrollRight}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={tableScrollRef}
            className={cn(
              "border rounded-lg overflow-x-auto overflow-y-hidden select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onWheel={handleTableWheel}
          >
            <table className="w-max min-w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="py-2 px-2 text-left font-medium sticky left-0 bg-muted/50 z-20 min-w-[300px] w-[300px] border-r">Obat</th>
                  {TIMESHEET_HOURS.map((hour) => (
                    <th key={`hour-${hour}`} className="py-2 px-1 text-center font-medium min-w-[56px] w-[56px]">
                      {String(hour).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timesheetItems.map((item) => (
                  <tr key={`timesheet-row-${item.order_item_id}`} className="border-t">
                    <td className="py-2 px-2 align-top sticky left-0 bg-background z-10 border-r min-w-[300px] w-[300px]">
                      <p className="font-medium text-sm leading-4">{item.medicine_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {item.dosage || "-"} • {item.frequency || "-"} • {item.route || "-"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Qty {item.quantity} {item.unit} • {item.order_number}
                      </p>
                    </td>
                    {TIMESHEET_HOURS.map((hour) => {
                      const key = getCellKey(item.order_item_id, hour);
                      const status = getCellStatus(item.order_item_id, hour);
                      return (
                        <td key={key} className="py-1 px-1 min-w-[56px] w-[56px]">
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn("h-8 w-11 rounded-md text-[11px] p-0 font-semibold", getTimesheetCellClassName(status))}
                            disabled={readOnly || timesheetSavingKey === key}
                            onClick={() => handleToggleTimesheetCell(item.order_item_id, hour)}
                          >
                            {timesheetSavingKey === key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : status === "given" ? (
                              "OK"
                            ) : status === "held" ? (
                              "T"
                            ) : status === "skipped" ? (
                              "X"
                            ) : (
                              "-"
                            )}
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
