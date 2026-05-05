# Rencana Perombakan Total Semua Index Page

> Dibuat: 5 Mei 2026  
> Scope: Semua halaman daftar/list di seluruh modul frontend  
> Pendekatan: Buat komponen reusable, terapkan ke semua modul

---

## Masalah yang Ada Sekarang

### 1. Layout Terlalu Rapat (No Breathing Room)
```
[Header: title + subtitle]   [Button Tambah]   ← tidak ada padding atas
[Search input]                                  ← langsung menempel
[Table rows]                                    ← terlalu dekat
```
- `px-4` tanpa `py-*` → header menempel ke AppHeader di atas
- Tidak ada pemisah visual antara page header dan area tabel
- `size="sm"` pada semua button → terlalu kecil, tidak mudah diklik

### 2. Header Tidak Konsisten Antar Modul
| Modul | Struktur Header |
|---|---|
| `patients` | `h1.text-lg.font-semibold` + `p.text-sm` + `Button sm` |
| `rooms` | Sama persis |
| `registrations` | Ditambah tabs + filter dropdown + date picker |
| `buildings` | Hanya `h1`, tanpa subtitle |
| Beberapa modul lain | Tidak ada judul sama sekali |

### 3. Tidak Ada Zona yang Jelas
Saat ini semuanya campur aduk:
- Judul, filter, search, tombol, tabel — semua dalam satu `flex flex-col` tanpa zona berbeda
- Search input ada di dalam komponen `DataTable` (susah dikontrol dari luar)
- Button aksi tersembunyi di kolom terakhir tabel (kecil, terlalu dekat antar baris)

### 4. Action Column di Tabel
- Tombol aksi (View/Edit/Delete) menggunakan `size="icon"` sangat kecil
- Tidak ada visual feedback yang jelas
- Tidak konsisten: sebagian pakai dropdown (...), sebagian pakai icon langsung

---

## Anatomi Layout Baru

```
┌──────────────────────────────────────────────────────────────┐
│  PAGE HEADER (px-6 py-4, border-b)                           │
│  [Icon] Judul Modul                [data count badge]        │
│         Deskripsi singkat                    [+ Tambah Data] │
├──────────────────────────────────────────────────────────────┤
│  TOOLBAR (px-6 py-3, bg-muted/30, border-b)                  │
│  [🔍 Search...]  [Filter 1 ▼] [Filter 2 ▼]   [↺ Refresh]   │
├──────────────────────────────────────────────────────────────┤
│  TABLE (px-6, full bordered grid)                            │
│  ┌──────┬────────────┬──────────┬────────┬─────────────┐    │
│  │  No  │  Kolom 1   │ Kolom 2  │ Status │    Aksi     │    │
│  ├──────┼────────────┼──────────┼────────┼─────────────┤    │
│  │   1  │  Data row  │  ...     │ badge  │ [👁][✏️][🗑] │    │
│  │   2  │  Data row  │  ...     │ badge  │ [👁][✏️][🗑] │    │
│  └──────┴────────────┴──────────┴────────┴─────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  PAGINATION (px-6 py-3, border-t)                            │
│  Baris per halaman: [10 ▼]    Total 248 baris    ← 1/25 →   │
└──────────────────────────────────────────────────────────────┘
```

---

## Komponen Baru yang Akan Dibuat

### A. `PageShell` — Wrapper utama setiap halaman
```tsx
// Gantikan <div className="flex flex-1 flex-col px-4">
<PageShell>
  <PageHeader
    title="Master Pasien"
    description="Kelola data pasien rumah sakit"
    count={patients.length}
    actions={
      <Button onClick={() => navigate('/patients/create')}>
        <Plus /> Registrasi Pasien
      </Button>
    }
  />
  <PageToolbar>
    <SearchInput ... />
    <FilterSelect ... />
  </PageToolbar>
  <PageContent>
    <DataTable ... />
  </PageContent>
</PageShell>
```

**Props PageHeader:**
```tsx
interface PageHeaderProps {
  title: string
  description?: string
  count?: number          // badge "248 data"
  icon?: LucideIcon       // ikon di kiri title
  actions?: React.ReactNode  // slot untuk button-button
}
```

**Props PageShell:**
```tsx
interface PageShellProps {
  children: React.ReactNode
  noPadding?: boolean     // untuk halaman dengan konten khusus
}
```

### B. `DataTable` yang Dipisah Toolbar-nya
Search dan filter dikeluarkan dari dalam DataTable ke `PageToolbar`, sehingga DataTable hanya menangani:
- Rendering tabel
- Sorting
- Pagination

```tsx
// Sekarang (search di dalam DataTable):
<DataTable searchPlaceholder="Cari..." ... />

// Setelah (search di luar, DataTable fokus ke tabel):
<PageToolbar>
  <DataTableSearch table={table} placeholder="Cari..." />
  <FilterSelect ... />
</PageToolbar>
<DataTable table={table} />   // atau tetap terima columns+data
```

> Catatan: Untuk tidak break semua existing code, `searchPlaceholder` tetap didukung sebagai prop opsional. Jika tidak diisi, search bar tidak muncul di toolbar internal.

### C. Action Cell yang Lebih Bersih
```tsx
// Gantikan icon buttons kecil dengan row-action dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="h-7 px-2">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => onView(row.id)}>
      <Eye /> Detail
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onEdit(row.id)}>
      <Pencil /> Edit
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.id)}>
      <Trash2 /> Hapus
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Implementasi Per Fase

### Fase A — Komponen Core (Dulu, Tidak Break Apa-apa)
1. Buat `src/components/layout/page-shell.tsx` — `PageShell`, `PageHeader`, `PageToolbar`, `PageContent`
2. Update `table.tsx` — bordered style (SUDAH SELESAI)
3. Update `data-table.tsx` — compact, toolbar terpisah, perbaiki pagination

### Fase B — Migrasi Modul Master Data (Sederhana Dulu)
Prioritas: modul yang paling sering dibuka dan paling "mepet"

| Modul | File | Tingkat Kesulitan |
|---|---|---|
| `patients` | `pages/patients/index.tsx` | Rendah |
| `medicines` | `pages/medicines/index.tsx` | Rendah |
| `inventories` | `pages/inventories/index.tsx` | Rendah |
| `rooms` | `pages/rooms/index.tsx` | Rendah |
| `employees` | `pages/employees/index.tsx` | Rendah |
| `users` | `pages/users/index.tsx` | Rendah |
| `suppliers` | `pages/suppliers/index.tsx` | Rendah |
| `counters` | `pages/counters/index.tsx` | Rendah |
| `clinical-packages` | `pages/clinical-packages/index.tsx` | Rendah |
| `icd` | `pages/icd/index.tsx` | Rendah |
| `procedures` | `pages/procedures/index.tsx` | Rendah |

### Fase C — Migrasi Modul Operasional (Ada Filter Kompleks)
| Modul | File | Catatan |
|---|---|---|
| `registrations` | `pages/registrations/index.tsx` | Ada tabs, date picker, room filter |
| `visits` | `pages/visits/index.tsx` | Ada tabs, status filter |
| `billing` | `pages/billing/payment.tsx` | Ada date range filter |
| `queues` | `pages/queues/index.tsx` | Ada counter filter |
| `eklaim` | `pages/eklaim/index.tsx` | Ada periode filter |
| `eklaim-local` | `pages/eklaim-local/eklaim-list.tsx` | Ada banyak filter |
| `stock-requests` | `pages/stock-requests/index.tsx` | Ada status filter |
| `distributions` | `pages/distributions/index.tsx` | - |

### Fase D — Modul Lain
| Modul | File |
|---|---|
| `buildings` | `pages/buildings/index.tsx` |
| `roles` | `pages/roles/index.tsx` |
| `permissions` | `pages/permissions/index.tsx` |
| `admisi` | `pages/admisi/index.tsx` |
| `bpjs/mapping` | `pages/bpjs/mapping/index.tsx` |
| `ppk` | `pages/ppk/index.tsx` |
| `master-data` | `pages/master-data/category.tsx` |
| `nutrition/menus` | `pages/nutrition/menus/index.tsx` |
| `nutrition/meal-packages` | `pages/nutrition/meal-packages/index.tsx` |

---

## Detail Desain PageHeader

### Tata Letak
```
┌──────────────────────────────────────────────────────────────┐
│ px-6 py-4  border-b bg-background                            │
│                                                              │
│ [icon 20px]  Master Pasien          [• 248 data]  [+ Tambah] │
│              Kelola data pasien ...                          │
└──────────────────────────────────────────────────────────────┘
```

### Spesifikasi
- `title`: `text-base font-semibold text-foreground` (turun dari `text-lg`)
- `description`: `text-xs text-muted-foreground mt-0.5`
- `count badge`: `text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full`
- `icon`: `h-5 w-5 text-muted-foreground`
- Padding header: `px-6 py-4` (konsisten semua halaman)
- Ada `border-b border-border`

### Button Aksi di Header
- Tambah: `<Button size="sm">` — tetap kecil tapi dengan padding lebih baik
- Warna: `default` (primary) untuk aksi utama
- Jika ada lebih dari satu aksi: masukkan ke `ButtonGroup` atau dropdown

---

## Detail Desain PageToolbar

```
┌──────────────────────────────────────────────────────────────┐
│ px-6 py-2.5  bg-muted/30  border-b                          │
│                                                              │
│ [🔍 Cari nama, No.RM...]  [Filter Status ▼]  [↺]  [↓ Export]│
└──────────────────────────────────────────────────────────────┘
```

### Spesifikasi
- Background: `bg-muted/30` — sedikit tinted, bukan putih
- Search input: `max-w-xs` atau `max-w-sm` tergantung modul
- Filter selects: `h-8 text-xs` — lebih compact dari default
- Refresh button: `variant="ghost" size="icon" h-8 w-8`
- Export (opsional): `variant="outline" size="sm"`

---

## Detail Desain Table Body

### Row Height
- Header row: `h-9` (sudah diterapkan di table.tsx baru)
- Data row: `py-2 px-3` (sudah diterapkan)
- Hasilnya: lebih compact, bisa tampilkan lebih banyak data tanpa scroll

### Striped Rows
- Odd rows: `bg-background`  
- Even rows: `bg-muted/20`
(Sudah diterapkan di `TableRow` baru)

### Action Column
- Selalu kolom paling kanan
- Lebar fixed: `w-[80px]` atau `w-[100px]`
- Gunakan `DropdownMenu` untuk 3+ aksi, icon langsung untuk 1-2 aksi
- Tombol aksi: `h-7 w-7 p-0` — lebih kecil dari default tapi masih bisa diklik

### Status Column
- Gunakan `Badge` dengan pola: `variant="outline"` + `className` warna custom
- Standarkan ukuran: `text-xs px-2 py-0.5`

---

## Rencana Implementasi Kode

### Step 1: Buat `page-shell.tsx`
**File baru:** `frontend/src/components/layout/page-shell.tsx`

Exports:
- `PageShell` — wrapper `flex flex-1 flex-col overflow-hidden`
- `PageHeader` — zona title + actions dengan border-b
- `PageToolbar` — zona search + filter dengan bg-muted/30 border-b  
- `PageContent` — zona tabel dengan `flex-1 overflow-auto px-6`

### Step 2: Update `data-table.tsx`
- Hapus wrapper search dari dalam component
- Search tetap ada sebagai `showSearch` prop untuk backward compatibility
- Hilangkan `maxHeight: calc(100vh - 280px)` — biarkan `PageContent` yang handle overflow
- Pagination lebih ringkas: satu baris, `px-0 py-2`

### Step 3: Migrasi satu per satu
Migrasi dimulai dari `patients/index.tsx` sebagai template, lalu copy pattern ke modul lain.

Pattern migrasi:
```tsx
// SEBELUM:
return (
  <div className="flex flex-1 flex-col px-4">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">Judul</h1>
        <p className="text-sm text-muted-foreground">Deskripsi</p>
      </div>
      <Button size="sm"><Plus /> Tambah</Button>
    </div>
    <DataTable columns={columns} data={data} searchPlaceholder="..." />
  </div>
)

// SESUDAH:
return (
  <PageShell>
    <PageHeader
      title="Judul"
      description="Deskripsi"
      count={data.length}
      actions={<Button size="sm"><Plus /> Tambah</Button>}
    />
    <DataTable columns={columns} data={data} searchPlaceholder="..." />
  </PageShell>
)
```

---

## Checklist Konsistensi yang Harus Dijaga

Setelah redesain, semua modul harus memenuhi:

- [ ] Padding: `px-6` horizontal, `py-4` untuk header, `py-2.5` untuk toolbar
- [ ] Title: `text-base font-semibold` (bukan `text-lg`)
- [ ] Description: ada dan deskriptif (bukan dikosongkan)
- [ ] Count badge: tampil jumlah record saat ini
- [ ] Button tambah: `size="sm"` dengan ikon `Plus`
- [ ] Search placeholder: format "Cari [field1], [field2]..."
- [ ] Status label: `"Tidak Aktif"` (bukan `"Nonaktif"`)
- [ ] Action column: gunakan `DropdownMenu` jika ≥3 aksi
- [ ] Empty state: teks deskriptif (bukan hanya "Tidak ada data.")
- [ ] Loading state: `Skeleton` table rows, bukan spinner tunggal di tengah
