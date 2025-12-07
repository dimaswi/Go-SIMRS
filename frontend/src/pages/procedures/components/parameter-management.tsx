import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  Download,
  Settings,
} from "lucide-react";
import {
  procedureParametersApi,
  INPUT_TYPES,
  getInputTypeLabel,
  formatNormalRange,
} from "@/lib/api/procedures";
import type {
  ProcedureParameter,
  CreateParameterRequest,
  ParameterInputType,
  ProcedureType,
} from "@/lib/api/procedures";

interface ParameterManagementProps {
  procedureId: number;
  procedureType: ProcedureType;
  procedureName: string;
}

export function ParameterManagement({
  procedureId,
  procedureType,
  procedureName,
}: ParameterManagementProps) {
  const { toast } = useToast();
  const [parameters, setParameters] = useState<ProcedureParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingParameter, setEditingParameter] = useState<ProcedureParameter | null>(null);
  const [parameterToDelete, setParameterToDelete] = useState<number | null>(null);
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);

  const [formData, setFormData] = useState<CreateParameterRequest>({
    code: "",
    name: "",
    description: "",
    input_type: "text",
    options: "",
    unit: "",
    normal_min: undefined,
    normal_max: undefined,
    normal_text: "",
    critical_min: undefined,
    critical_max: undefined,
    decimal_places: 0,
    is_required: false,
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadParameters();
  }, [procedureId]);

  const loadParameters = async () => {
    try {
      setLoading(true);
      const res = await procedureParametersApi.getAll(procedureId);
      setParameters(res.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data parameter.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      input_type: "text",
      options: "",
      unit: "",
      normal_min: undefined,
      normal_max: undefined,
      normal_text: "",
      critical_min: undefined,
      critical_max: undefined,
      decimal_places: 0,
      is_required: false,
      sort_order: parameters.length + 1,
      is_active: true,
    });
    setEditingParameter(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (param: ProcedureParameter) => {
    setEditingParameter(param);
    setFormData({
      code: param.code,
      name: param.name,
      description: param.description || "",
      input_type: param.input_type,
      options: param.options || "",
      unit: param.unit || "",
      normal_min: param.normal_min,
      normal_max: param.normal_max,
      normal_text: param.normal_text || "",
      critical_min: param.critical_min,
      critical_max: param.critical_max,
      decimal_places: param.decimal_places || 0,
      is_required: param.is_required,
      sort_order: param.sort_order,
      is_active: param.is_active,
    });
    setShowAddDialog(true);
  };

  const handleDelete = (id: number) => {
    setParameterToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!parameterToDelete) return;

    try {
      await procedureParametersApi.delete(procedureId, parameterToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Parameter berhasil dihapus.",
      });
      loadParameters();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus parameter.",
      });
    } finally {
      setShowDeleteDialog(false);
      setParameterToDelete(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode dan nama parameter wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingParameter) {
        await procedureParametersApi.update(procedureId, editingParameter.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Parameter berhasil diperbarui.",
        });
      } else {
        await procedureParametersApi.create(procedureId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Parameter berhasil ditambahkan.",
        });
      }
      setShowAddDialog(false);
      loadParameters();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan parameter.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (templateName: string) => {
    try {
      setSaving(true);
      const res = await procedureParametersApi.applyDefaults(procedureId, templateName);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: res.data.message || "Template berhasil diterapkan.",
      });
      setShowApplyTemplateDialog(false);
      loadParameters();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menerapkan template.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CreateParameterRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Get template options based on procedure type
  const getTemplateOptions = () => {
    switch (procedureType) {
      case "medical":
        return [{ code: "medical", label: "Parameter Tindakan Medis" }];
      case "radiology":
        return [{ code: "radiology", label: "Parameter Radiologi" }];
      case "laboratory":
        return [
          { code: "lab_dl", label: "Darah Lengkap (DL)" },
          { code: "lab_kimia_darah", label: "Kimia Darah" },
        ];
      default:
        return [];
    }
  };

  const showLabFields = procedureType === "laboratory" || formData.input_type === "number";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Parameter Tindakan</CardTitle>
            <CardDescription>
              Kelola parameter hasil untuk tindakan {procedureName}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowApplyTemplateDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Gunakan Template
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Parameter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : parameters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Belum ada parameter untuk tindakan ini.</p>
            <p className="text-sm">Klik tombol "Tambah Parameter" atau "Gunakan Template" untuk memulai.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Parameter</TableHead>
                <TableHead>Tipe Input</TableHead>
                {procedureType === "laboratory" && (
                  <>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Nilai Normal</TableHead>
                  </>
                )}
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parameters.map((param, index) => (
                <TableRow key={param.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      {index + 1}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{param.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{param.name}</div>
                      {param.description && (
                        <div className="text-xs text-muted-foreground">{param.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getInputTypeLabel(param.input_type)}</Badge>
                  </TableCell>
                  {procedureType === "laboratory" && (
                    <>
                      <TableCell>{param.unit || "-"}</TableCell>
                      <TableCell>{formatNormalRange(param)}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Badge variant={param.is_active ? "default" : "secondary"}>
                      {param.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(param)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(param.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingParameter ? "Edit Parameter" : "Tambah Parameter"}
            </DialogTitle>
            <DialogDescription>
              {editingParameter
                ? "Edit data parameter tindakan"
                : "Tambah parameter baru untuk tindakan ini"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode Parameter *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  placeholder="Contoh: hemoglobin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Parameter *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Contoh: Hemoglobin (Hb)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Deskripsi parameter..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="input_type">Tipe Input *</Label>
                <Select
                  value={formData.input_type}
                  onValueChange={(v) => updateField("input_type", v as ParameterInputType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe input" />
                  </SelectTrigger>
                  <SelectContent>
                    {INPUT_TYPES.map((type) => (
                      <SelectItem key={type.code} value={type.code}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Urutan</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => updateField("sort_order", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {formData.input_type === "select" && (
              <div className="space-y-2">
                <Label htmlFor="options">Pilihan (pisahkan dengan koma)</Label>
                <Textarea
                  id="options"
                  value={formData.options}
                  onChange={(e) => updateField("options", e.target.value)}
                  placeholder="Contoh: Positif, Negatif, Tidak Diperiksa"
                  rows={2}
                />
              </div>
            )}

            {/* Lab-specific fields */}
            {showLabFields && (
              <>
                <Separator />
                <h4 className="text-sm font-medium">Pengaturan Nilai (Laboratorium)</h4>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">Satuan</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => updateField("unit", e.target.value)}
                      placeholder="g/dL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decimal_places">Desimal</Label>
                    <Input
                      id="decimal_places"
                      type="number"
                      min={0}
                      max={4}
                      value={formData.decimal_places}
                      onChange={(e) => updateField("decimal_places", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="normal_min">Nilai Normal Min</Label>
                    <Input
                      id="normal_min"
                      type="number"
                      step="0.01"
                      value={formData.normal_min ?? ""}
                      onChange={(e) =>
                        updateField("normal_min", e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      placeholder="12.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="normal_max">Nilai Normal Max</Label>
                    <Input
                      id="normal_max"
                      type="number"
                      step="0.01"
                      value={formData.normal_max ?? ""}
                      onChange={(e) =>
                        updateField("normal_max", e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      placeholder="16.0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="normal_text">Nilai Normal (Teks)</Label>
                  <Input
                    id="normal_text"
                    value={formData.normal_text}
                    onChange={(e) => updateField("normal_text", e.target.value)}
                    placeholder="Contoh: Negatif, atau 12-16 g/dL"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="critical_min">Nilai Kritis Min</Label>
                    <Input
                      id="critical_min"
                      type="number"
                      step="0.01"
                      value={formData.critical_min ?? ""}
                      onChange={(e) =>
                        updateField("critical_min", e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      placeholder="7.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="critical_max">Nilai Kritis Max</Label>
                    <Input
                      id="critical_max"
                      type="number"
                      step="0.01"
                      value={formData.critical_max ?? ""}
                      onChange={(e) =>
                        updateField("critical_max", e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      placeholder="20.0"
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Flags */}
            <div className="flex items-center gap-8">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_required"
                  checked={formData.is_required}
                  onCheckedChange={(v) => updateField("is_required", v)}
                />
                <Label htmlFor="is_required">Wajib Diisi</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => updateField("is_active", v)}
                />
                <Label htmlFor="is_active">Aktif</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingParameter ? "Simpan Perubahan" : "Tambah Parameter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyTemplateDialog} onOpenChange={setShowApplyTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gunakan Template Parameter</DialogTitle>
            <DialogDescription>
              Pilih template parameter sesuai jenis tindakan. Parameter yang sudah ada akan tetap dipertahankan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {getTemplateOptions().map((template) => (
              <Button
                key={template.code}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleApplyTemplate(template.code)}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <div className="text-left">
                  <div className="font-medium">{template.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Terapkan parameter standar untuk {template.label.toLowerCase()}
                  </div>
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyTemplateDialog(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Hapus Parameter"
        description="Apakah Anda yakin ingin menghapus parameter ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </Card>
  );
}
