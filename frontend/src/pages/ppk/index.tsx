import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/usePermission';
import { ppkApi, type PPKMaster, type PPKMasterRequest } from '@/lib/api/ppk';

export default function PPKIndexPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PPKMaster[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PPKMaster | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState<PPKMasterRequest>({
    kode_bpjs: '',
    kode_kemenkes: '',
    nama: '',
    jenis: '',
    kelas: '',
    alamat: '',
    telepon: '',
    wilayah: '',
    des_wilayah: '',
    is_active: true,
  });

  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');
  const canDelete = hasPermission('master_data.delete');

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await ppkApi.getAll({
        active: showInactive ? undefined : true,
        limit: 1000,
      });
      setRows(response.data.data || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data master PPK.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageTitle('Master PPK');
  }, []);

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      kode_bpjs: '',
      kode_kemenkes: '',
      nama: '',
      jenis: '',
      kelas: '',
      alamat: '',
      telepon: '',
      wilayah: '',
      des_wilayah: '',
      is_active: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (item: PPKMaster) => {
    setEditing(item);
    setForm({
      kode_bpjs: item.kode_bpjs,
      kode_kemenkes: item.kode_kemenkes || '',
      nama: item.nama,
      jenis: item.jenis || '',
      kelas: item.kelas || '',
      alamat: item.alamat || '',
      telepon: item.telepon || '',
      wilayah: item.wilayah || '',
      des_wilayah: item.des_wilayah || '',
      is_active: item.is_active,
    });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.kode_bpjs.trim() || !form.nama.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validasi',
        description: 'Kode BPJS dan nama PPK wajib diisi.',
      });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await ppkApi.update(editing.id, form);
        toast({ title: 'Berhasil', description: 'Data PPK berhasil diperbarui.' });
      } else {
        await ppkApi.create(form);
        toast({ title: 'Berhasil', description: 'Data PPK berhasil ditambahkan.' });
      }
      setFormOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err?.response?.data?.error || 'Gagal menyimpan data PPK.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await ppkApi.delete(deleteId);
      toast({ title: 'Berhasil', description: 'Data PPK berhasil dihapus.' });
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err?.response?.data?.error || 'Gagal menghapus data PPK.',
      });
    } finally {
      setDeleteId(null);
    }
  };

  const columns = useMemo<ColumnDef<PPKMaster>[]>(() => [
    {
      header: 'Kode BPJS',
      accessorKey: 'kode_bpjs',
    },
    {
      header: 'Nama PPK',
      accessorKey: 'nama',
    },
    {
      header: 'Jenis',
      accessorKey: 'jenis',
      cell: ({ row }) => row.original.jenis || '-',
    },
    {
      header: 'Kelas',
      accessorKey: 'kelas',
      cell: ({ row }) => row.original.kelas || '-',
    },
    {
      header: 'Telepon',
      accessorKey: 'telepon',
      cell: ({ row }) => row.original.telepon || '-',
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ], [canDelete, canUpdate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Master PPK</h1>
          <p className="text-sm text-muted-foreground">Kelola data PPK untuk rujukan BPJS</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah PPK
          </Button>
        )}
      </div>

      <DataTable
        tableId="master-ppk"
        columns={columns}
        data={rows}
        searchPlaceholder="Cari kode/nama PPK..."
        searchSlot={
          <div className="flex items-center gap-2 pl-2">
            <Label className="text-xs text-muted-foreground">Tampilkan nonaktif</Label>
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          </div>
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit PPK' : 'Tambah PPK'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Kode BPJS</Label>
              <Input value={form.kode_bpjs} onChange={(e) => setForm((prev) => ({ ...prev, kode_bpjs: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kode Kemenkes</Label>
              <Input value={form.kode_kemenkes || ''} onChange={(e) => setForm((prev) => ({ ...prev, kode_kemenkes: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nama PPK</Label>
              <Input value={form.nama} onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Input value={form.jenis || ''} onChange={(e) => setForm((prev) => ({ ...prev, jenis: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Input value={form.kelas || ''} onChange={(e) => setForm((prev) => ({ ...prev, kelas: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Alamat</Label>
              <Input value={form.alamat || ''} onChange={(e) => setForm((prev) => ({ ...prev, alamat: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input value={form.telepon || ''} onChange={(e) => setForm((prev) => ({ ...prev, telepon: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Wilayah</Label>
              <Input value={form.wilayah || ''} onChange={(e) => setForm((prev) => ({ ...prev, wilayah: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Deskripsi Wilayah</Label>
              <Input value={form.des_wilayah || ''} onChange={(e) => setForm((prev) => ({ ...prev, des_wilayah: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label>Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={saveForm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus PPK"
        description="Apakah Anda yakin ingin menghapus data PPK ini?"
      />
    </div>
  );
}
