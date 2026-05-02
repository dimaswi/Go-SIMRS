import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { masterDataApi, type MasterDataCategory } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ChevronRight, Plus, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/hooks/usePermission';

export default function MasterDataPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [categories, setCategories] = useState<MasterDataCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('Master Data');
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await masterDataApi.getCategories();
      setCategories(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat kategori master data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (code: string) => {
    // Map categories to icons/colors
    const iconMap: Record<string, { color: string }> = {
      gender: { color: 'bg-blue-100 text-blue-700' },
      religion: { color: 'bg-purple-100 text-purple-700' },
      marital_status: { color: 'bg-pink-100 text-pink-700' },
      education_level: { color: 'bg-green-100 text-green-700' },
      employee_type: { color: 'bg-orange-100 text-orange-700' },
      employment_status: { color: 'bg-cyan-100 text-cyan-700' },
      blood_type: { color: 'bg-red-100 text-red-700' },
      relationship: { color: 'bg-yellow-100 text-yellow-700' },
      bank: { color: 'bg-emerald-100 text-emerald-700' },
      department: { color: 'bg-indigo-100 text-indigo-700' },
      position: { color: 'bg-violet-100 text-violet-700' },
      specialization: { color: 'bg-teal-100 text-teal-700' },
      body_marker_category: { color: 'bg-amber-100 text-amber-700' },
      body_marker_image: { color: 'bg-rose-100 text-rose-700' },
      o2_type: { color: 'bg-sky-100 text-sky-700' },
    };
    return iconMap[code] || { color: 'bg-gray-100 text-gray-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Referensi Data</h1>
            <p className="text-sm text-muted-foreground">Kelola data referensi untuk aplikasi SIMRS</p>
          </div>
          {hasPermission('master_data.create') && (
            <Button onClick={() => navigate('/master-data/create')} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Data
            </Button>
          )}
        </div>
        <div className="rounded-lg border p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const { color } = getCategoryIcon(category.code);
                return (
                  <Card 
                    key={category.code} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/master-data/category/${category.code}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${color}`}>
                            <Database className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium">{category.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {category.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{category.count}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {categories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada kategori master data.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
