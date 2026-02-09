import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { icd10Api, icd9cmApi, type ICD10, type ICD9CM } from "@/lib/api/icd";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ICDType = "icd10" | "icd9cm";

export default function ICDShowPage() {
  const navigate = useNavigate();
  const { type, code } = useParams<{ type: ICDType; code: string }>();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [data, setData] = useState<ICD10 | ICD9CM | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!type || !code) return;
      
      try {
        setLoading(true);
        const decodedCode = decodeURIComponent(code);
        
        if (type === "icd10") {
          const result = await icd10Api.getByCode(decodedCode);
          setData(result);
          setPageTitle(`ICD-10: ${result.code}`);
        } else {
          const result = await icd9cmApi.getByCode(decodedCode);
          setData(result);
          setPageTitle(`ICD-9-CM: ${result.code}`);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: error instanceof Error ? error.message : "Gagal memuat data ICD.",
        });
        navigate(`/icd?type=${type}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [type, code, toast, navigate]);

  const handleDelete = async () => {
    if (!data || !type) return;

    try {
      if (type === "icd10") {
        await icd10Api.delete(data.id);
      } else {
        await icd9cmApi.delete(data.id);
      }
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data ICD berhasil dihapus.",
      });
      navigate(`/icd?type=${type}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus data ICD.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded-lg border p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-9 w-9" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isICD10 = type === "icd10";
  const icdData = data as ICD10;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild className="h-9 w-9">
                <Link to={`/icd?type=${type}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{data.display}</h1>
                  <Badge variant={data.is_active ? "default" : "secondary"}>
                    {data.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  Kode: {data.code} ({isICD10 ? "ICD-10" : "ICD-9-CM"})
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {hasPermission("icd.update") && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/icd/${type}/${data.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
              {hasPermission("icd.delete") && (
                <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              )}
            </div>
      </div>
      <div className="rounded-lg border p-6">
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.valid_code ? "default" : "secondary"}>
                {data.valid_code ? "Kode Valid" : "Header/Kategori"}
              </Badge>
              {isICD10 && icdData.im && (
                <Badge variant="outline">Indonesia Modified</Badge>
              )}
              {isICD10 && icdData.acc_pdx && (
                <Badge variant="outline">Acceptable as PDx</Badge>
              )}
              {isICD10 && icdData.asterisk && (
                <Badge variant="outline">Asterisk Code</Badge>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Deskripsi</h3>
              <p className="text-sm">{data.display}</p>
            </div>

            <Separator />

            {/* Details */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Kode</h3>
                <p className="text-sm font-mono">{data.code}</p>
              </div>
              {data.code2 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Kode Alternatif</h3>
                  <p className="text-sm font-mono">{data.code2}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Tipe</h3>
                <p className="text-sm">{isICD10 ? "ICD-10" : "ICD-9-CM"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
                <p className="text-sm">{data.is_active ? "Aktif" : "Nonaktif"}</p>
              </div>
              {isICD10 && icdData.chapter && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Chapter</h3>
                  <p className="text-sm">{icdData.chapter}</p>
                </div>
              )}
              {isICD10 && icdData.chapter_name && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Nama Chapter</h3>
                  <p className="text-sm">{icdData.chapter_name}</p>
                </div>
              )}
            </div>
          </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Hapus Data ICD"
        description={`Apakah Anda yakin ingin menghapus kode ${data.code}? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </div>
  );
}
