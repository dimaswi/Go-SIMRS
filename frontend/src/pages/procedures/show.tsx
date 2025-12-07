import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { setPageTitle } from "@/lib/page-title";
import {
  proceduresApi,
  formatCurrency,
  getProcedureGroupLabel,
  getSpecialtyLabel,
  getAnesthesiaTypeLabel,
  getServiceTypeLabel,
  getPatientClassLabel,
  getProcedureTypeLabel,
  PATIENT_CLASSES,
  TARIFF_COMPONENTS,
  calculateTotalTariff,
  getTariffByClass,
} from "@/lib/api/procedures";
import type { Procedure, PatientClass } from "@/lib/api/procedures";
import { ParameterManagement } from "./components/parameter-management";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowLeft, Pencil, Trash2, Clock, Syringe, AlertTriangle } from "lucide-react";

export default function ProcedureShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    setPageTitle(procedure ? procedure.name : "Detail Tindakan");
  }, [procedure]);

  useEffect(() => {
    loadProcedure();
  }, [id]);

  const loadProcedure = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const res = await proceduresApi.getById(Number(id));
      setProcedure(res.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data tindakan.",
      });
      navigate("/procedures");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await proceduresApi.delete(Number(id));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil dihapus.",
      });
      navigate("/procedures");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus tindakan.",
      });
    }
  };

  const getTariffValue = (patientClass: PatientClass, component: string): number => {
    const tariff = getTariffByClass(procedure?.tariffs, patientClass);
    if (!tariff) return 0;
    return (tariff as any)[component] || 0;
  };

  const getRowTotal = (patientClass: PatientClass): number => {
    const tariff = getTariffByClass(procedure?.tariffs, patientClass);
    if (!tariff) return 0;
    return calculateTotalTariff(tariff);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-9" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!procedure) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild className="h-9 w-9">
                <Link to="/procedures">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">{procedure.name}</CardTitle>
                  <Badge variant={procedure.is_active ? "default" : "secondary"}>
                    {procedure.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <CardDescription className="font-mono">Kode: {procedure.code}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/procedures/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {procedure.procedure_type && (
                <Badge variant="default">{getProcedureTypeLabel(procedure.procedure_type)}</Badge>
              )}
              {procedure.is_surgical && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Syringe className="h-3 w-3" />
                  Tindakan Bedah
                </Badge>
              )}
              {procedure.is_emergency && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Tindakan Darurat
                </Badge>
              )}
              {procedure.duration > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {procedure.duration} menit
                </Badge>
              )}
              {procedure.procedure_group && (
                <Badge variant="secondary">{getProcedureGroupLabel(procedure.procedure_group)}</Badge>
              )}
              {procedure.specialty && (
                <Badge variant="secondary">{getSpecialtyLabel(procedure.specialty)}</Badge>
              )}
              {procedure.service_type && (
                <Badge variant="secondary">{getServiceTypeLabel(procedure.service_type)}</Badge>
              )}
            </div>

            {/* Description */}
            {procedure.description && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Deskripsi</h3>
                  <p className="text-sm">{procedure.description}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Classification Codes */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Klasifikasi INA-CBG</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {procedure.inacbg_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Kode INA-CBG</p>
                    <p className="text-sm font-medium font-mono">{procedure.inacbg_code}</p>
                  </div>
                )}
                {procedure.inacbg_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Nama INA-CBG</p>
                    <p className="text-sm font-medium">{procedure.inacbg_name}</p>
                  </div>
                )}
                {procedure.icd9cm_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Kode ICD-9-CM</p>
                    <p className="text-sm font-medium font-mono">{procedure.icd9cm_code}</p>
                  </div>
                )}
                {procedure.icd10pcs_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Kode ICD-10-PCS</p>
                    <p className="text-sm font-medium font-mono">{procedure.icd10pcs_code}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Tariff Table */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Tarif Per Kelas Pasien</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[120px] sticky left-0 bg-muted/50">Kelas Pasien</TableHead>
                      {TARIFF_COMPONENTS.map((comp) => (
                        <TableHead key={comp.key} className="text-right min-w-[110px]">
                          {comp.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[130px] font-semibold bg-muted/50">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PATIENT_CLASSES.map((patientClass) => (
                      <TableRow key={patientClass}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          {getPatientClassLabel(patientClass)}
                        </TableCell>
                        {TARIFF_COMPONENTS.map((comp) => (
                          <TableCell key={comp.key} className="text-right text-sm">
                            {formatCurrency(getTariffValue(patientClass, comp.key))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold bg-muted/30">
                          {formatCurrency(getRowTotal(patientClass))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Anesthesia Info */}
            {procedure.requires_anesthesia && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Informasi Anestesi</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Memerlukan Anestesi</p>
                      <p className="text-sm font-medium">Ya</p>
                    </div>
                    {procedure.anesthesia_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">Jenis Anestesi</p>
                        <p className="text-sm font-medium">{getAnesthesiaTypeLabel(procedure.anesthesia_type)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parameter Management */}
      <ParameterManagement
        procedureId={procedure.id}
        procedureType={procedure.procedure_type}
        procedureName={procedure.name}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Hapus Tindakan"
        description={`Apakah Anda yakin ingin menghapus tindakan "${procedure.name}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </div>
  );
}
