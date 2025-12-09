import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Printer,
  Loader2,
  Users,
  Clock,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  counter_id: z.number().min(1, "Pilih loket"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function KioskIndex() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      counter_id: 0,
      notes: "",
    },
  });

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) {
          setHospitalName(settings.app_name);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Load active counters
  useEffect(() => {
    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Gagal!",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadCounters();
  }, [toast]);

  // Load queue statistics
  useEffect(() => {
    const loadQueues = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const response = await queueApi.getAll({ date: today });
        const data = response.data.data || [];
        setAllQueues(data);
      } catch (error) {
        console.error("Failed to load queues:", error);
      }
    };
    loadQueues();
    const interval = setInterval(loadQueues, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCounterSelect = (counter: number) => {
    setSelectedCounter(counter);
    form.setValue("counter_id", counter);
    // Auto submit setelah pilih counter
    setTimeout(() => {
      form.handleSubmit(onSubmit)();
    }, 300);
  };

  const onSubmit = async (values: FormData) => {
    try {
      const response = await queueApi.create({
        queue_type: "general",
        counter_id: values.counter_id,
        notes: values.notes || "",
      });

      setQueueNumber(response.data.data.queue_number);
      setShowSuccess(true);

      // Auto reset after 5 seconds
      setTimeout(() => {
        handleReset();
      }, 5000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal!",
        description:
          error.response?.data?.error || "Gagal mengambil nomor antrean.",
      });
    }
  };

  const handleReset = () => {
    setSelectedCounter(null);
    setShowSuccess(false);
    setQueueNumber("");
    form.reset();
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Antrean - ${queueNumber}</title>
          <style>
            @page { margin: 0; }
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              width: 80mm;
            }
            .ticket {
              text-align: center;
              border: 2px dashed #333;
              padding: 15px;
            }
            .header {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .queue-number {
              font-size: 48px;
              font-weight: bold;
              margin: 20px 0;
            }
            .info {
              font-size: 14px;
              margin: 8px 0;
            }
            .counter {
              font-size: 24px;
              font-weight: bold;
              margin: 15px 0;
              padding: 10px;
              border: 2px solid #333;
              border-radius: 5px;
            }
            .footer {
              font-size: 12px;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #333;
            }
            .datetime {
              font-size: 11px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">${hospitalName}<br/>ANTREAN PENDAFTARAN</div>
            <div class="queue-number">${queueNumber}</div>
            <div class="counter">
              ${counters.find((c) => c.id === selectedCounter)?.name || "Loket"}
            </div>
            <div class="datetime">
              ${new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}<br/>
              ${new Date().toLocaleTimeString("id-ID")}
            </div>
            <div class="footer">
              Harap menunggu panggilan<br/>
              Terima kasih
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 100);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  if (showSuccess) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-2xl border-2 border-green-200">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Nomor Antrean Anda
              </h1>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6 mb-4">
                <div className="text-7xl font-bold mb-2">{queueNumber}</div>
                <div className="text-2xl mt-2">
                  {counters.find((c) => c.id === selectedCounter)?.name || "Loket"}
                </div>
              </div>
              <p className="text-lg text-gray-600 mb-1">
                Silakan tunggu nomor Anda dipanggil
              </p>
              <p className="text-base text-gray-500">
                Mengulang otomatis dalam 5 detik...
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                size="lg"
                variant="outline"
                onClick={handlePrint}
                className="text-lg px-8 py-5 h-auto"
              >
                <Printer className="mr-2 h-5 w-5" />
                Cetak
              </Button>
              <Button
                size="lg"
                onClick={handleReset}
                className="text-lg px-10 py-5 h-auto"
              >
                Ambil Nomor Lagi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate statistics
  const totalQueues = (allQueues || []).length;
  const waitingQueues = (allQueues || []).filter((q) => q.status === "waiting").length;
  const servingQueues = (allQueues || []).filter((q) => q.status === "serving").length;
  const completedQueues = (allQueues || []).filter((q) => q.status === "completed").length;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-3">
          <a
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Kembali</span>
          </a>
        </div>

          <div className="text-center mb-3">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Selamat Datang
            </h1>
            <p className="text-base text-gray-600">
              Silakan pilih loket untuk mengambil nomor antrean
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalQueues}</div>
                    <div className="text-xs text-blue-100">Total Antrean</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Hourglass className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{waitingQueues}</div>
                    <div className="text-xs text-yellow-100">Menunggu</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{servingQueues}</div>
                    <div className="text-xs text-purple-100">Sedang Dilayani</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{completedQueues}</div>
                    <div className="text-xs text-green-100">Selesai</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {/* Pilih Loket */}
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <div className="bg-white text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      1
                    </div>
                    Pilih Loket Pendaftaran
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                      <span className="ml-3 text-lg text-gray-600">Memuat loket...</span>
                    </div>
                  ) : counters.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <AlertCircle className="h-16 w-16 mx-auto mb-3 text-gray-400" />
                      <p className="text-lg">Tidak ada loket yang tersedia</p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="counter_id"
                      render={({ field: _field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {counters.map((counter) => {
                                const isSelected = selectedCounter === counter.id;
                                
                                // Statistics per counter
                                const counterAllQueues = (allQueues || []).filter((q) => q.counter_id === counter.id);
                                const counterWaiting = counterAllQueues.filter((q) => q.status === "waiting").length;
                                const counterServing = counterAllQueues.filter((q) => q.status === "serving").length;
                                const counterCompleted = counterAllQueues.filter((q) => q.status === "completed").length;
                                
                                return (
                                  <button
                                    key={counter.id}
                                    type="button"
                                    onClick={() => handleCounterSelect(counter.id)}
                                    className={cn(
                                      "relative p-6 rounded-xl border-3 transition-all duration-200",
                                      "hover:scale-105 hover:shadow-lg",
                                      isSelected
                                        ? "border-indigo-500 bg-indigo-50 shadow-lg"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    )}
                                  >
                                    <div className="text-center">
                                      <div
                                        className={cn(
                                          "text-4xl font-bold mb-2",
                                          isSelected
                                            ? "text-indigo-600"
                                            : "text-gray-400"
                                        )}
                                      >
                                        {counter.code}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-sm font-semibold mb-3",
                                          isSelected
                                            ? "text-indigo-600"
                                            : "text-gray-600"
                                        )}
                                      >
                                        {counter.name}
                                      </div>
                                      
                                      {/* Counter Statistics */}
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="grid grid-cols-3 gap-1 text-xs">
                                          <div>
                                            <div className="text-yellow-600 font-bold">{counterWaiting}</div>
                                            <div className="text-gray-500">Tunggu</div>
                                          </div>
                                          <div>
                                            <div className="text-purple-600 font-bold">{counterServing}</div>
                                            <div className="text-gray-500">Layani</div>
                                          </div>
                                          <div>
                                            <div className="text-green-600 font-bold">{counterCompleted}</div>
                                            <div className="text-gray-500">Selesai</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="absolute top-2 right-2">
                                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                                          <CheckCircle className="h-4 w-4 text-white" />
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage className="text-lg mt-4" />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
