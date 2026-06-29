import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, DoorOpen, DoorClosed, Loader2 } from "lucide-react";
import type { Counter } from "@/lib/api/counters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CounterSelectionDialogProps {
  open: boolean;
  counters: Counter[];
  togglingCounterId: number | null;
  onSelect: (counterId: string) => void;
  onToggleCounter: (id: number) => void;
}

export function CounterSelectionDialog({
  open,
  counters,
  togglingCounterId,
  onSelect,
  onToggleCounter,
}: CounterSelectionDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(null);
    }
  }, [open]);

  const handleSelect = (id: string) => {
    setSelected(id);
    onSelect(id);
  };


  return (
    <Dialog open={open} onOpenChange={() => { }}>
      <DialogContent
        className="sm:max-w-md"
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Pilih Loket Aktif</DialogTitle>
          <DialogDescription>
            Silakan pilih loket tempat Anda bertugas saat ini agar antrean yang Anda kelola tidak tercampur.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {counters.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Memuat data loket...
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="grid gap-3">
                {counters.map((counter) => (
                  <div
                    key={counter.id}
                    className={`flex items-center justify-between rounded-md border p-3 ${selected === counter.id.toString()
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                      } ${!counter.is_open ? 'opacity-80 bg-muted/30' : ''}`}
                  >
                    <div
                      className={`flex items-center gap-3 cursor-pointer flex-1 ${!counter.is_open ? 'pointer-events-none' : ''}`}
                      onClick={() => counter.is_open && handleSelect(counter.id.toString())}
                    >
                      {counter.is_open ? (
                        <DoorOpen className="h-5 w-5 text-green-500" />
                      ) : (
                        <DoorClosed className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {counter.name}
                          {!counter.is_open && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">TUTUP</Badge>
                          )}
                        </div>
                        <div className="text-xs font-normal opacity-70">
                          {counter.is_open ? "Pilih untuk mengelola antrean ini" : "Buka loket untuk mengelola"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center ml-4 border-l pl-4 h-full">
                      {togglingCounterId === counter.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={counter.is_open}
                          onCheckedChange={() => onToggleCounter(counter.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="mt-6 border-t pt-4">
            <Button
              variant="secondary"
              className="w-full text-xs h-9"
              onClick={() => handleSelect("all")}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Pantau Semua Loket (Mode Admin)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
