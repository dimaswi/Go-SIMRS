import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createQueueColumns } from "./columns";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RegistrationDialog } from "./registration-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Plus,
  Phone,
  ClipboardList,
  RefreshCcw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QueueIndex() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCounters, setLoadingCounters] = useState(true);
  const [selectedCounter, setSelectedCounter] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [calling, setCalling] = useState(false);
  const [skipId, setSkipId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [registerQueue, setRegisterQueue] = useState<{id: number; number: string} | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (selectedCounter !== "all")
        params.counter_id = parseInt(selectedCounter);
      if (selectedStatus !== "all") params.status = selectedStatus;

      const response = await queueApi.getAll(params);
      setQueues(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data antrean.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCounter, selectedStatus, toast]);

  useEffect(() => {
    setPageTitle("Antrean");
    
    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoadingCounters(false);
      }
    };
    loadCounters();
  }, [toast]);

  useEffect(() => {
    loadData();
    // Hentikan auto refresh jika dialog registrasi sedang dibuka
    if (registerQueue !== null) return;
    
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData, registerQueue]);

  const handleCallNext = async () => {
    if (selectedCounter === "all") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih loket terlebih dahulu untuk memanggil antrean.",
      });
      return;
    }

    setCalling(true);
    try {
      const response = await queueApi.callNext({
        counter_id: parseInt(selectedCounter),
      });
      toast({
        title: "Antrean Dipanggil",
        description: `Nomor ${response.data.data.queue_number} berhasil dipanggil.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil antrean.",
      });
    } finally {
      setCalling(false);
    }
  };

  const handleCall = async (id: number) => {
    try {
      const response = await queueApi.call(id);
      toast({
        title: "Antrean Dipanggil",
        description: `Nomor ${response.data.data.queue_number} berhasil dipanggil.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil antrean.",
      });
    }
  };

  const handleRecall = async (id: number) => {
    try {
      const response = await queueApi.call(id);
      toast({
        title: "Antrean Dipanggil Ulang",
        description: `Nomor ${response.data.data.queue_number} berhasil dipanggil ulang.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil ulang antrean.",
      });
    }
  };

  const handleSkip = async () => {
    if (!skipId) return;
    try {
      await queueApi.skip(skipId);
      toast({
        title: "Antrean Dilewati",
        description: "Antrean berhasil dilewati.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal melewati antrean.",
      });
    } finally {
      setSkipId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await queueApi.cancel(cancelId);
      toast({
        title: "Antrean Dibatalkan",
        description: "Antrean berhasil dibatalkan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan antrean.",
      });
    } finally {
      setCancelId(null);
    }
  };

  const handleRegister = (queue: Queue) => {
    setRegisterQueue({ id: queue.id, number: queue.queue_number });
  };

  const columns = createQueueColumns({
    onCall: handleCall,
    onRecall: handleRecall,
    onSkip: setSkipId,
    onCancel: setCancelId,
    onRegister: handleRegister,
    hasCallPermission: hasPermission("queues.call"),
    hasDeletePermission: hasPermission("queues.delete"),
    hasRegisterPermission: hasPermission("registrations.create"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Antrean Pasien
                  </CardTitle>
                  <CardDescription>
                    Kelola antrean pasien untuk pendaftaran
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCounter}
                  onValueChange={setSelectedCounter}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Pilih Loket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Loket</SelectItem>
                    {loadingCounters ? (
                      <SelectItem value="loading" disabled>
                        <Loader2 className="h-3 w-3 animate-spin mr-2 inline" />
                        Memuat...
                      </SelectItem>
                    ) : (
                      counters.map((counter) => (
                        <SelectItem
                          key={counter.id}
                          value={counter.id.toString()}
                        >
                          {counter.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="waiting">Menunggu</SelectItem>
                    <SelectItem value="called">Dipanggil</SelectItem>
                    <SelectItem value="serving">Dilayani</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                    <SelectItem value="skipped">Dilewati</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={loadData}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                {hasPermission("queues.call") && (
                  <Button onClick={handleCallNext} disabled={calling} size="sm">
                    {calling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="mr-2 h-4 w-4" />
                    )}
                    Panggil
                  </Button>
                )}
                {hasPermission("queues.create") && (
                  <Button
                    onClick={() => navigate("/queues/create")}
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ambil Antrean
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={queues}
              searchPlaceholder="Cari nomor antrean atau nama pasien..."
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={skipId !== null}
        onOpenChange={(open) => !open && setSkipId(null)}
        onConfirm={handleSkip}
        title="Lewati Antrean?"
        description="Antrean akan ditandai sebagai dilewati dan bisa dipanggil lagi nanti."
        confirmText="Ya, Lewati"
        cancelText="Batal"
      />

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        onConfirm={handleCancel}
        title="Batalkan Antrean?"
        description="Apakah Anda yakin ingin membatalkan antrean ini?"
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />

      <RegistrationDialog
        open={registerQueue !== null}
        onOpenChange={(open) => !open && setRegisterQueue(null)}
        queueId={registerQueue?.id || 0}
        queueNumber={registerQueue?.number || ""}
        onSuccess={() => {
          setRegisterQueue(null);
          loadData();
        }}
      />
    </div>
  );
}
