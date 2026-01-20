import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
  Printer,
  Loader2,
  Clock,
  Users,
  ChevronUp,
  ChevronDown,
  Volume2,
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      counter_id: 0,
      notes: "",
    },
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check scroll position
  const checkScrollPosition = () => {
    const container = gridContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, [counters]);

  const scrollUp = () => {
    const container = gridContainerRef.current;
    if (container) {
      container.scrollBy({ top: -300, behavior: "smooth" });
    }
  };

  const scrollDown = () => {
    const container = gridContainerRef.current;
    if (container) {
      container.scrollBy({ top: 300, behavior: "smooth" });
    }
  };

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
              font-family: 'Arial', sans-serif;
              width: 80mm;
              background: white;
            }
            .ticket {
              text-align: center;
              border: 3px solid #000;
              padding: 20px;
            }
            .header {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .queue-number {
              font-size: 64px;
              font-weight: 900;
              margin: 25px 0;
              letter-spacing: 4px;
            }
            .counter {
              font-size: 20px;
              font-weight: bold;
              margin: 20px 0;
              padding: 12px;
              border: 2px solid #000;
            }
            .datetime {
              font-size: 12px;
              color: #333;
              margin: 15px 0;
            }
            .footer {
              font-size: 11px;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 2px dashed #000;
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">${hospitalName}<br/>NOMOR ANTREAN</div>
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
              Mohon menunggu hingga nomor Anda dipanggil<br/>
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

  // Calculate statistics
  const totalQueues = (allQueues || []).length;
  const waitingQueues = (allQueues || []).filter(
    (q) => q.status === "waiting"
  ).length;
  const servingQueues = (allQueues || []).filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const completedQueues = (allQueues || []).filter(
    (q) => q.status === "completed"
  ).length;

  // Success Screen
  if (showSuccess) {
    return (
      <div className="h-screen overflow-hidden bg-white flex flex-col">
        {/* Header */}
        <div className="bg-black text-white py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-wide">{hospitalName}</h1>
              <p className="text-gray-400 text-sm">Sistem Antrean Pendaftaran</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold">
                {currentTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-gray-400 text-sm">
                {currentTime.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Success Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-black rounded-full flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
            </div>

            {/* Queue Number */}
            <p className="text-xl text-gray-500 mb-4 uppercase tracking-wider">
              Nomor Antrean Anda
            </p>
            <div className="border-4 border-black inline-block px-16 py-8 mb-6">
              <div className="text-8xl font-black tracking-wider">{queueNumber}</div>
            </div>
            <div className="text-2xl font-semibold text-gray-700 mb-6">
              {counters.find((c) => c.id === selectedCounter)?.name || "Loket"}
            </div>

            {/* Instructions */}
            <p className="text-lg text-gray-600 mb-8">
              Silakan tunggu hingga nomor Anda dipanggil
            </p>

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                variant="outline"
                onClick={handlePrint}
                className="text-lg px-8 py-6 h-auto border-2 border-black hover:bg-black hover:text-white transition-colors"
              >
                <Printer className="mr-2 h-5 w-5" />
                Cetak Tiket
              </Button>
              <Button
                size="lg"
                onClick={handleReset}
                className="text-lg px-8 py-6 h-auto bg-black hover:bg-gray-800"
              >
                Ambil Nomor Lagi
              </Button>
            </div>

            {/* Auto reset notice */}
            <p className="text-sm text-gray-400 mt-6">
              Halaman akan kembali otomatis dalam 5 detik
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-black text-white py-4 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{hospitalName}</h1>
            <p className="text-gray-400 text-sm uppercase tracking-wider">
              Ambil Nomor Antrean
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="text-gray-400 text-sm">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="border-b-2 border-gray-200 py-3 px-6 flex-shrink-0">
        <div className="flex items-center justify-center gap-12">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600 text-sm">Total</span>
            <span className="text-3xl font-bold">{totalQueues}</span>
          </div>
          <div className="w-px h-8 bg-gray-300" />
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600 text-sm">Menunggu</span>
            <span className="text-3xl font-bold">{waitingQueues}</span>
          </div>
          <div className="w-px h-8 bg-gray-300" />
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600 text-sm">Dilayani</span>
            <span className="text-3xl font-bold">{servingQueues}</span>
          </div>
          <div className="w-px h-8 bg-gray-300" />
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600 text-sm">Selesai</span>
            <span className="text-3xl font-bold">{completedQueues}</span>
          </div>
        </div>
      </div>

      {/* Title Bar */}
      <div className="py-4 px-6 text-center flex-shrink-0 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">
          Sentuh Loket untuk Mengambil Nomor Antrean
        </h2>
      </div>

      {/* Main Content - Counter Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Scroll Up Button */}
        {canScrollUp && (
          <button
            onClick={scrollUp}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-8 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg"
          >
            <ChevronUp className="h-5 w-5" />
            <span className="font-medium">Geser Ke Atas</span>
          </button>
        )}

        {/* Grid Container */}
        <div
          ref={gridContainerRef}
          onScroll={checkScrollPosition}
          className="flex-1 overflow-auto p-4"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
                  <span className="ml-4 text-xl text-gray-500">Memuat loket...</span>
                </div>
              ) : counters.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <AlertCircle className="h-16 w-16 text-gray-300 mr-4" />
                  <p className="text-xl text-gray-500">Tidak ada loket yang tersedia</p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="counter_id"
                  render={({ field: _field }) => (
                    <FormItem>
                      <FormControl>
                        {/* Grid that can accommodate 18+ cards like universal display */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-9 gap-3">
                          {counters.map((counter) => {
                            const isSelected = selectedCounter === counter.id;

                            // Statistics per counter
                            const counterAllQueues = (allQueues || []).filter(
                              (q) => q.counter_id === counter.id
                            );
                            const counterWaiting = counterAllQueues.filter(
                              (q) => q.status === "waiting"
                            ).length;
                            const counterServing = counterAllQueues.filter(
                              (q) => q.status === "serving" || q.status === "called"
                            ).length;

                            // Get current serving queue
                            const currentQueue = counterAllQueues.find(
                              (q) => q.status === "called" || q.status === "serving"
                            );

                            return (
                              <button
                                key={counter.id}
                                type="button"
                                onClick={() => handleCounterSelect(counter.id)}
                                className={cn(
                                  "border-2 transition-all duration-200 text-left",
                                  "hover:scale-[1.02] active:scale-[0.98]",
                                  isSelected
                                    ? "border-black bg-black text-white"
                                    : "border-gray-200 bg-gray-50 hover:border-black"
                                )}
                              >
                                {/* Counter Header */}
                                <div
                                  className={cn(
                                    "px-3 py-2 border-b",
                                    isSelected ? "border-gray-700" : "border-gray-200"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div
                                      className={cn(
                                        "text-lg font-bold",
                                        isSelected ? "text-white" : "text-gray-900"
                                      )}
                                    >
                                      {counter.code}
                                    </div>
                                    {isSelected && (
                                      <CheckCircle className="h-4 w-4 text-white" />
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-xs truncate",
                                      isSelected ? "text-gray-400" : "text-gray-500"
                                    )}
                                  >
                                    {counter.name}
                                  </div>
                                </div>

                                {/* Current Queue Display */}
                                <div className="px-3 py-4 text-center">
                                  {currentQueue ? (
                                    <>
                                      <div className="text-4xl font-black tracking-wide mb-1">
                                        {currentQueue.queue_number}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-xs",
                                          isSelected ? "text-gray-400" : "text-gray-500"
                                        )}
                                      >
                                        Sedang Dilayani
                                      </div>
                                    </>
                                  ) : (
                                    <div
                                      className={cn(
                                        "text-3xl py-2",
                                        isSelected ? "text-gray-500" : "text-gray-300"
                                      )}
                                    >
                                      ---
                                    </div>
                                  )}
                                </div>

                                {/* Counter Statistics */}
                                <div
                                  className={cn(
                                    "px-3 py-2 border-t",
                                    isSelected ? "border-gray-700" : "border-gray-200"
                                  )}
                                >
                                  <div className="flex justify-between text-xs">
                                    <div className="text-center">
                                      <div
                                        className={cn(
                                          "font-bold text-sm",
                                          isSelected ? "text-white" : "text-gray-900"
                                        )}
                                      >
                                        {counterWaiting}
                                      </div>
                                      <div
                                        className={cn(
                                          isSelected ? "text-gray-500" : "text-gray-400"
                                        )}
                                      >
                                        Tunggu
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div
                                        className={cn(
                                          "font-bold text-sm",
                                          isSelected ? "text-white" : "text-gray-900"
                                        )}
                                      >
                                        {counterServing}
                                      </div>
                                      <div
                                        className={cn(
                                          isSelected ? "text-gray-500" : "text-gray-400"
                                        )}
                                      >
                                        Layani
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage className="text-lg mt-6 text-center" />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        </div>

        {/* Scroll Down Button */}
        {canScrollDown && (
          <button
            onClick={scrollDown}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-8 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg"
          >
            <ChevronDown className="h-5 w-5" />
            <span className="font-medium">Geser Ke Bawah</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-gray-200 py-3 px-6 text-center bg-gray-50 flex-shrink-0">
        <p className="text-gray-500 text-sm">
          Sentuh loket yang dituju untuk mendapatkan nomor antrean
        </p>
      </div>
    </div>
  );
}
