import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { counterApi } from "@/lib/api/counters";
import { setPageTitle } from "@/lib/page-title";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const counterSchema = z.object({
  name: z.string().min(1, "Nama loket wajib diisi"),
  description: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  display_order: z.number().min(0, "Urutan harus >= 0"),
  is_active: z.boolean(),
});

type CounterFormData = z.infer<typeof counterSchema>;

export default function CounterCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CounterFormData>({
    resolver: zodResolver(counterSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      display_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    setPageTitle("Tambah Loket");
  }, []);

  const onSubmit = async (values: CounterFormData) => {
    setSubmitting(true);
    try {
      await counterApi.createCounter(values);
      toast({
        title: "Berhasil!",
        description: "Loket baru berhasil ditambahkan.",
      });
      navigate("/counters");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan loket.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Informasi Loket"
        description="Masukkan detail informasi loket baru"
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      <PageContent>
      <div className="border border-border/70 bg-background">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          DATA LOKET
        </div>
        <div className="p-3 sm:p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 [&_input]:h-9">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Loket</FormLabel>
                      <FormControl>
                        <Input placeholder="Loket Pendaftaran" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lokasi</FormLabel>
                      <FormControl>
                        <Input placeholder="Lantai 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="display_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urutan Tampilan</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? ""
                                : parseInt(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Deskripsi</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Deskripsi loket"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 md:col-span-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Status Aktif</FormLabel>
                        <FormDescription>
                          Centang jika loket aktif dan dapat digunakan
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur -mx-3 sm:-mx-4 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/counters")}
                  disabled={submitting}
                  className="h-9"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting} className="h-9 min-w-28">
                  {submitting ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      </PageContent>
    </PageShell>
  );
}
