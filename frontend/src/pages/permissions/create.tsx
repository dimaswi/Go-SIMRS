import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { permissionsApi } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, ChevronsUpDown, FileText, Loader2, Lock, Package, Tag } from "lucide-react";

const moduleOptions = [
  "User Management",
  "Role Management",
  "Permission Management",
  "Dashboard",
  "System Settings",
  "Profile Management",
];

const categoryOptions = [
  "Users",
  "Roles",
  "Permissions",
  "Analytics",
  "Settings",
  "Account",
];

const actionOptions = [
  { id: 'view', label: 'View', description: 'Melihat atau membaca data.' },
  { id: 'create', label: 'Create', description: 'Membuat data baru.' },
  { id: 'update', label: 'Update', description: 'Mengubah data yang ada.' },
  { id: 'delete', label: 'Delete', description: 'Menghapus data.' },
  { id: 'assign', label: 'Assign', description: 'Memberikan atau mengaitkan akses.' },
];

function generatePermissionName(module: string, action: string) {
  if (!module || !action) return "";

  const moduleMap: Record<string, string> = {
    "User Management": "users",
    "Role Management": "roles",
    "Permission Management": "permissions",
    Dashboard: "dashboard",
    "System Settings": "settings",
    "Profile Management": "profile",
  };

  const moduleKey = moduleMap[module] || module.toLowerCase().replace(/\s+/g, "_");
  return `${moduleKey}.${action}`;
}

export default function PermissionCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [openModule, setOpenModule] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    module: "",
    category: "",
    description: "",
    action: "",
  });

  useEffect(() => {
    setPageTitle("Tambah Permission");
  }, []);

  useEffect(() => {
    if (formData.module && formData.action) {
      setFormData((current) => ({ ...current, name: generatePermissionName(current.module, current.action) }));
    }
  }, [formData.module, formData.action]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        actions: JSON.stringify([formData.action]),
      };
      delete (submitData as any).action;

      await permissionsApi.create(submitData);
      toast({
        variant: "success",
        title: "Success!",
        description: "Permission created successfully.",
      });
      setTimeout(() => navigate("/permissions"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to create permission.",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAction = useMemo(
    () => actionOptions.find((action) => action.id === formData.action),
    [formData.action]
  );
  const previewName = generatePermissionName(formData.module, formData.action);

  return (
    <PageShell>
      <PageHeader
        title="Tambah Permission"
        description="Susun konteks modul, kategori, dan aksi agar permission baru langsung konsisten dengan penamaan akses yang berlaku."
        icon={Lock}
        actions={
          <Button type="button" variant="outline" onClick={() => navigate("/permissions")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />

      <PageContent className="flex-none space-y-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <SectionPanel
              icon={Package}
              title="Konteks Permission"
              description="Pilih modul, kategori, dan aksi utama agar nama permission otomatis terbentuk dengan pola yang seragam."
              contentClassName="space-y-5"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Module</Label>
                  <Popover open={openModule} onOpenChange={setOpenModule}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={openModule} className="w-full justify-between">
                        {formData.module || "Pilih atau ketik module..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Cari atau ketik module baru..."
                          value={formData.module}
                          onValueChange={(value) => setFormData((current) => ({ ...current, module: value }))}
                        />
                        <CommandList>
                          <CommandEmpty>Tidak ada module ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {moduleOptions.map((module) => (
                              <CommandItem
                                key={module}
                                value={module}
                                onSelect={(currentValue) => {
                                  setFormData((current) => ({ ...current, module: currentValue }));
                                  setOpenModule(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.module === module ? "opacity-100" : "opacity-0")} />
                                {module}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Category</Label>
                  <Popover open={openCategory} onOpenChange={setOpenCategory}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={openCategory} className="w-full justify-between">
                        {formData.category || "Pilih atau ketik category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Cari atau ketik category baru..."
                          value={formData.category}
                          onValueChange={(value) => setFormData((current) => ({ ...current, category: value }))}
                        />
                        <CommandList>
                          <CommandEmpty>Tidak ada category ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {categoryOptions.map((category) => (
                              <CommandItem
                                key={category}
                                value={category}
                                onSelect={(currentValue) => {
                                  setFormData((current) => ({ ...current, category: currentValue }));
                                  setOpenCategory(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.category === category ? "opacity-100" : "opacity-0")} />
                                {category}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Action</Label>
                <Select value={formData.action} onValueChange={(value) => setFormData((current) => ({ ...current, action: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih action" />
                  </SelectTrigger>
                  <SelectContent>
                    {actionOptions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        <div className="flex flex-col">
                          <div className="font-medium text-left">{action.label}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SectionPanel>

            <SectionPanel
              icon={FileText}
              title="Identitas Dan Preview"
              description="Nama permission tetap bisa diedit manual, tetapi preview ini membantu menjaga pola penamaan tetap rapi."
              contentClassName="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Nama Permission
                </Label>
                <Input
                  id="name"
                  required
                  placeholder="Contoh: users.view"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Deskripsi
                </Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsikan apa yang diizinkan oleh permission ini..."
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-[140px]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-border/70 bg-muted/20 px-4 py-3 sm:col-span-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview Nama Otomatis</div>
                  <p className="mt-2 font-mono text-sm font-medium text-foreground">{previewName || "Menunggu module dan action dipilih"}</p>
                </div>
                <div className="border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" /> Category
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{formData.category || "Belum dipilih"}</p>
                </div>
                <div className="border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Action
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{selectedAction?.label || "Belum dipilih"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedAction?.description || 'Pilih aksi utama yang diizinkan oleh permission ini.'}</p>
                </div>
              </div>
            </SectionPanel>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate("/permissions")}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-28">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan Permission
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
