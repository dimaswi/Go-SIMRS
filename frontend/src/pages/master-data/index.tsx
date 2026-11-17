import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { masterDataApi, type MasterDataCategory } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ChevronRight, Plus, Database, Search } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { PageShell, PageHeader, PageToolbar, PageContent } from '@/components/layout/page-shell';

export default function MasterDataPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [categories, setCategories] = useState<MasterDataCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const totalRecords = categories.reduce((sum, c) => sum + (c.count || 0), 0);
  const filteredCategories = categories.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.description || ''} ${c.code}`.toLowerCase().includes(q);
  });

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
        icon={Database}
        title="Referensi Data"
        description="Kelola data referensi untuk aplikasi SIMRS"
        actions={
          hasPermission('master_data.create') ? (
            <Button onClick={() => navigate('/master-data/create')} size="sm" className="h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tambah Data
            </Button>
          ) : undefined
        }
      />
      <PageToolbar className="justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kategori referensi..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{filteredCategories.length}</span> Kategori
          </span>
          <span className="h-3 w-px bg-border" />
          <span>
            <span className="font-bold text-foreground">{totalRecords.toLocaleString('id-ID')}</span> Data
          </span>
        </div>
      </PageToolbar>
      <PageContent noPadding>
        {filteredCategories.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
            <Database className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {categories.length === 0 ? 'Belum ada kategori master data.' : 'Tidak ada kategori yang sesuai pencarian.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
            {filteredCategories.map((category) => {
              const { color } = getCategoryIcon(category.code);
              return (
                <button
                  type="button"
                  key={category.code}
                  onClick={() => navigate(`/master-data/category/${category.code}`)}
                  className="group relative flex items-center gap-3 bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
                >
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-primary" />
                  <div className={`flex size-9 shrink-0 items-center justify-center ${color}`}>
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold leading-tight">{category.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{category.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex h-5 min-w-[28px] items-center justify-center border border-border bg-muted/50 px-1.5 font-mono text-[11px] font-bold tabular-nums">
                      {category.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
