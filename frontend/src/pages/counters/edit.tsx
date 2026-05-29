import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usePermission } from "@/hooks/usePermission";

const counterSchema = z.object({
  name: z.string().min(1, "Nama loket wajib diisi"),
  description: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  display_order: z.number().min(0, "Urutan harus >= 0"),
  is_active: z.boolean(),
});

type CounterFormData = z.infer<typeof counterSchema>;

export default function CounterEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { hasPermission } = usePermission();

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
    setPageTitle("Edit Loket");
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await counterApi.getCounter(Number(id));
      form.reset({
        name: data.name,
        description: data.description || "",
        location: data.location || "",
        display_order: data.display_order ?? 0,
        is_active: data.is_active,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memuat data loket.",
      });
      navigate("/counters");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: CounterFormData) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await counterApi.updateCounter(Number(id), values);
      toast({
        title: "Berhasil!",
        description: "Data loket berhasil diperbarui.",
      });
      navigate("/counters");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui data loket.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await counterApi.deleteCounter(Number(id));
      toast({
        title: "Berhasil!",
        description: "Loket berhasil dihapus.",
      });
      navigate("/counters");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus loket.",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Edit Loket"
        description="Perbarui informasi loket"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.history.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {hasPermission("counters.delete") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            )}
          </div>
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
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Loket"
        description="Apakah Anda yakin ingin menghapus loket ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
      />
    </PageShell>
  );
}
