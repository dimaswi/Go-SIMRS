import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { icd10Api, icd9cmApi, type ICD10, type ICD9CM } from "@/lib/api/icd";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Plus, Stethoscope, Syringe } from "lucide-react";
import { createColumns } from "./columns";

type ICDType = "icd10" | "icd9cm";

export default function ICDIndexPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  
  const initialType = (searchParams.get("type") as ICDType) || "icd10";
  const [activeTab, setActiveTab] = useState<ICDType>(initialType);
  const [data, setData] = useState<(ICD10 | ICD9CM)[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "icd10") {
        const dataRes = await icd10Api.search({ limit: 100, valid_only: false });
        setData(dataRes);
      } else {
        const dataRes = await icd9cmApi.search({ limit: 100, valid_only: false });
        setData(dataRes);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data ICD.",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    const title = activeTab === "icd10" ? "ICD-10 (Diagnosis)" : "ICD-9-CM (Prosedur)";
    setPageTitle(title);
    loadData();
  }, [loadData, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as ICDType);
    setSearchParams({ type: value });
  };

  const handleView = (code: string) => {
    navigate(`/icd/${activeTab}/${encodeURIComponent(code)}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/icd/${activeTab}/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (activeTab === "icd10") {
        await icd10Api.delete(itemToDelete);
      } else {
        await icd9cmApi.delete(itemToDelete);
      }
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data ICD berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus data.",
      });
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns = useMemo(
    () =>
      createColumns({
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
        canUpdate: hasPermission("icd.update"),
        canDelete: hasPermission("icd.delete"),
      }),
    [hasPermission]
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        {/* Main Table Card */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {activeTab === "icd10" ? "ICD-10 Indonesia Modified" : "ICD-9-CM Indonesia Modified"}
                </CardTitle>
                <CardDescription>
                  {activeTab === "icd10"
                    ? "Kode diagnosis berdasarkan ICD-10 versi Indonesia"
                    : "Kode prosedur/tindakan berdasarkan ICD-9-CM versi Indonesia"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList>
                    <TabsTrigger value="icd10" className="gap-2">
                      <Stethoscope className="h-4 w-4" />
                      ICD-10
                    </TabsTrigger>
                    <TabsTrigger value="icd9cm" className="gap-2">
                      <Syringe className="h-4 w-4" />
                      ICD-9-CM
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {hasPermission("icd.create") && (
                  <Button onClick={() => navigate(`/icd/${activeTab}/create`)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={data}
                searchPlaceholder="Cari kode atau nama..."
                pageSize={15}
                tableId={`icd_${activeTab}`}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Kode ICD"
        description="Apakah Anda yakin ingin menghapus kode ICD ini? Data yang sudah dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
