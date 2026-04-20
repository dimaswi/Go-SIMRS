import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { queueApi, queueTypeLabels } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { ArrowLeft, Loader2, Ticket } from "lucide-react";

const formSchema = z.object({
  queue_type: z.enum(["general", "bpjs"]),
  counter_id: z.number().min(1, "Loket wajib dipilih"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function QueueCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<Counter[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      queue_type: "general",
      counter_id: 0,
      notes: "",
    },
  });

  useEffect(() => {
    setPageTitle("Ambil Nomor Antrean");
    
    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
        if (data.length > 0) {
          form.setValue("counter_id", data[0].id);
        }
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
  }, [toast, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const response = await queueApi.create({
        queue_type: values.queue_type,
        counter_id: values.counter_id,
        notes: values.notes,
      });

      const counterName = counters.find(c => c.id === values.counter_id)?.name || "";
      toast({
        title: "Berhasil!",
        description: `Nomor antrean ${response.data.data.queue_number} untuk ${counterName} berhasil diambil.`,
      });

      // Navigate back to queue list
      navigate("/queues");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal mengambil nomor antrean.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.history.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Ambil Nomor Antrean
          </h1>
          <p className="text-sm text-muted-foreground">
            Pilih jenis layanan dan loket pendaftaran
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6 max-w-2xl mx-auto w-full">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="queue_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Layanan</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="text-lg h-12">
                          <SelectValue placeholder="Pilih jenis layanan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general" className="text-lg py-3">
                          {queueTypeLabels.general} (A)
                        </SelectItem>
                        <SelectItem value="bpjs" className="text-lg py-3">
                          {queueTypeLabels.bpjs} (B)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counter_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loket Pendaftaran</FormLabel>
                    {loading ? (
                      <div className="flex items-center justify-center h-12 border rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Memuat loket...</span>
                      </div>
                    ) : (
                      <Select
                        onValueChange={(val) => field.onChange(parseInt(val))}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="text-lg h-12">
                            <SelectValue placeholder="Pilih loket" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {counters.map((counter) => (
                            <SelectItem
                              key={counter.id}
                              value={counter.id.toString()}
                              className="text-lg py-3"
                            >
                              {counter.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Catatan tambahan..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/queues")}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting} size="lg">
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Ticket className="mr-2 h-4 w-4" />
                  Ambil Nomor Antrean
                </Button>
              </div>
            </form>
          </Form>
      </div>
    </div>
  );
}
