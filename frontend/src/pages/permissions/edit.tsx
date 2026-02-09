import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { setPageTitle } from "@/lib/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { permissionsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Lock, FileText, Package, Tag, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PermissionEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    module: "",
    category: "",
    description: "",
    action: "", // Single action instead of array
  });

  const [openModule, setOpenModule] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);

  // Predefined modules and categories for consistency
  const moduleOptions = [
    "User Management",
    "Role Management", 
    "Permission Management",
    "Dashboard",
    "System Settings",
    "Profile Management"
  ];

  const categoryOptions = [
    "Users",
    "Roles", 
    "Permissions",
    "Analytics",
    "Settings",
    "Account"
  ];

  const actionOptions = [
    { id: 'view', label: 'View', description: 'Melihat/membaca data' },
    { id: 'create', label: 'Create', description: 'Membuat data baru' },
    { id: 'update', label: 'Update', description: 'Mengubah data yang ada' },
    { id: 'delete', label: 'Delete', description: 'Menghapus data' },
    { id: 'assign', label: 'Assign', description: 'Memberikan permission' },
  ];

  // Generate permission name automatically based on module and action
  const generatePermissionName = (module: string, action: string) => {
    if (!module || !action) return "";
    
    const moduleMap: { [key: string]: string } = {
      "User Management": "users",
      "Role Management": "roles", 
      "Permission Management": "permissions",
      "Dashboard": "dashboard",
      "System Settings": "settings",
      "Profile Management": "profile"
    };
    
    const moduleKey = moduleMap[module] || module.toLowerCase().replace(/\s+/g, '_');
    return `${moduleKey}.${action}`;
  };

  // Auto-generate permission name when module or action change
  useEffect(() => {
    if (formData.module && formData.action) {
      const generatedName = generatePermissionName(formData.module, formData.action);
      setFormData(prev => ({ ...prev, name: generatedName }));
    }
  }, [formData.module, formData.action]);

  useEffect(() => {
    setPageTitle("Edit Permission");
    loadPermission();
  }, [id]);

  const loadPermission = async () => {
    try {
      setFetching(true);
      const response = await permissionsApi.getById(Number(id));
      const permission = response.data.data;
      
      // Parse actions array and get first action
      const actions = JSON.parse(permission.actions || '[]');
      const firstAction = actions.length > 0 ? actions[0] : '';
      
      setFormData({
        name: permission.name || "",
        module: permission.module || "",
        category: permission.category || "",
        description: permission.description || "",
        action: firstAction,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to load permission.",
      });
      navigate("/permissions");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        actions: JSON.stringify([formData.action]) // Convert single action to array for backend
      };
      delete (submitData as any).action; // Remove action field, use actions instead
      
      await permissionsApi.update(Number(id), submitData);
      toast({
        variant: "success",
        title: "Success!",
        description: "Permission updated successfully.",
      });
      setTimeout(() => navigate("/permissions"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description:
          error.response?.data?.error || "Failed to update permission.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/permissions")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">
            Informasi Permission
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit detail informasi permission
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Module
                  </Label>
                  <Popover open={openModule} onOpenChange={setOpenModule}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openModule}
                        className="w-full justify-between h-10"
                      >
                        {formData.module || "Pilih atau ketik module..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Cari atau ketik module baru..." 
                          value={formData.module}
                          onValueChange={(value) => setFormData({ ...formData, module: value })}
                        />
                        <CommandList>
                          <CommandEmpty>Tidak ada module ditemukan. Tekan Enter untuk menambah module baru.</CommandEmpty>
                          <CommandGroup>
                            {moduleOptions.map((module) => (
                              <CommandItem
                                key={module}
                                value={module}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, module: currentValue });
                                  setOpenModule(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.module === module ? "opacity-100" : "opacity-0"
                                  )}
                                />
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
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Category
                  </Label>
                  <Popover open={openCategory} onOpenChange={setOpenCategory}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCategory}
                        className="w-full justify-between h-10"
                      >
                        {formData.category || "Pilih atau ketik category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Cari atau ketik category baru..." 
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        />
                        <CommandList>
                          <CommandEmpty>Tidak ada category ditemukan. Tekan Enter untuk menambah category baru.</CommandEmpty>
                          <CommandGroup>
                            {categoryOptions.map((category) => (
                              <CommandItem
                                key={category}
                                value={category}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, category: currentValue });
                                  setOpenCategory(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.category === category ? "opacity-100" : "opacity-0"
                                  )}
                                />
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
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Action
                </Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) => setFormData({ ...formData, action: value })}
                >
                  <SelectTrigger className="h-10">
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

              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Nama Permission (Auto-generated, bisa diedit)
                </Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g., users.view"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-sm font-medium"
                >
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi permission..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/permissions")}
                  className="h-10"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 min-w-24"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update
                </Button>
              </div>
            </form>
          </div>
    </div>
  );
}
