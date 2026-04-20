import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { icd10Api, icd9cmApi } from "@/lib/api/icd";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useEffect } from "react";

type ICDType = "icd10" | "icd9cm";

interface ICDFormData {
  code: string;
  code2?: string;
  display: string;
  valid_code: boolean;
  acc_pdx: boolean;
  asterisk: boolean;
  im: boolean;
  is_active: boolean;
  chapter?: string;
  chapter_name?: string;
}

const icdFormSchema = z.object({
  code: z.string().min(1, "Kode wajib diisi").max(20, "Kode maksimal 20 karakter"),
  code2: z.string().max(20, "Kode alternatif maksimal 20 karakter").optional(),
  display: z.string().min(1, "Nama/deskripsi wajib diisi").max(500, "Nama maksimal 500 karakter"),
  valid_code: z.boolean(),
  acc_pdx: z.boolean(),
  asterisk: z.boolean(),
  im: z.boolean(),
  is_active: z.boolean(),
  chapter: z.string().max(10, "Chapter maksimal 10 karakter").optional(),
  chapter_name: z.string().max(200, "Nama chapter maksimal 200 karakter").optional(),
});

export default function ICDCreatePage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: ICDType }>();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const isICD10 = type === "icd10";

  const form = useForm<ICDFormData>({
    resolver: zodResolver(icdFormSchema),
    defaultValues: {
      code: "",
      code2: "",
      display: "",
      valid_code: true,
      acc_pdx: true,
      asterisk: false,
      im: false,
      is_active: true,
      chapter: "",
      chapter_name: "",
    },
  });

  useEffect(() => {
    setPageTitle(isICD10 ? "Tambah ICD-10" : "Tambah ICD-9-CM");
  }, [isICD10]);

  const onSubmit = async (data: ICDFormData) => {
    try {
      setSubmitting(true);
      if (isICD10) {
        await icd10Api.create({
          code: data.code,
          code2: data.code2 || "",
          display: data.display,
          valid_code: data.valid_code,
          acc_pdx: data.acc_pdx,
          asterisk: data.asterisk,
          im: data.im,
          is_active: data.is_active,
          chapter: data.chapter,
          chapter_name: data.chapter_name,
        });
      } else {
        await icd9cmApi.create({
          code: data.code,
          code2: data.code2 || "",
          display: data.display,
          valid_code: data.valid_code,
          acc_pdx: data.acc_pdx,
          asterisk: data.asterisk,
          im: data.im,
          is_active: data.is_active,
          chapter: data.chapter,
          chapter_name: data.chapter_name,
        });
      }
      
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `Kode ${isICD10 ? "ICD-10" : "ICD-9-CM"} berhasil ditambahkan.`,
      });
      navigate(`/icd?type=${type}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan data.",
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
          <h1 className="text-lg font-semibold">Tambah {isICD10 ? "ICD-10" : "ICD-9-CM"}</h1>
          <p className="text-sm text-muted-foreground">
            {isICD10
              ? "Tambah kode diagnosis baru ke database ICD-10"
              : "Tambah kode prosedur baru ke database ICD-9-CM"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Informasi Dasar
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kode *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={isICD10 ? "Contoh: A00.1" : "Contoh: 00.01"}
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Kode {isICD10 ? "ICD-10" : "ICD-9-CM"} dengan format standar
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="code2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kode Alternatif</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={isICD10 ? "Contoh: A001" : "Contoh: 0001"}
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Kode tanpa titik (opsional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="display"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama/Deskripsi *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={isICD10 ? "Contoh: Cholera due to Vibrio cholerae 01, biovar eltor" : "Contoh: Therapeutic ultrasound of vessels of head and neck"}
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Attributes */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Atribut Kode
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="valid_code"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Kode Valid</FormLabel>
                            <FormDescription className="text-xs">
                              Bukan header/kategori
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="acc_pdx"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Acc PDx</FormLabel>
                            <FormDescription className="text-xs">
                              Acceptable as Primary Dx
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="asterisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Asterisk</FormLabel>
                            <FormDescription className="text-xs">
                              Kode manifestasi (*)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="im"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Indonesia Modified</FormLabel>
                            <FormDescription className="text-xs">
                              Modifikasi Indonesia
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Classification */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Klasifikasi (Opsional)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="chapter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chapter</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: I, II, III..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="chapter_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Chapter</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: Certain infectious and parasitic diseases" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Status
                  </h3>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Status Aktif</FormLabel>
                          <FormDescription>
                            Kode yang tidak aktif tidak akan muncul di pencarian
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/icd?type=${type}`)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Simpan
                  </Button>
                </div>
              </form>
            </Form>
      </div>
    </div>
  );
}
