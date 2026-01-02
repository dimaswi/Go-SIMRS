# Medical Record Components - Style Guide

## 🎨 Design Philosophy

Semua komponen medical record menggunakan style yang **konsisten, rapi, dan profesional** dengan prinsip:

1. **Card-based Layout** - Setiap section menggunakan Card component
2. **Color-coded Sections** - Warna berbeda untuk membedakan kategori
3. **Gradient Headers** - Header dengan gradient background untuk visual appeal
4. **Icon Integration** - Setiap section memiliki icon representatif
5. **Table-based Forms** - Untuk data terstruktur, gunakan Table dengan checkbox
6. **Collapsible Details** - Detail tambahan dapat di-expand/collapse
7. **Badge Indicators** - Progress dan status ditampilkan dengan badge
8. **Responsive Grid** - Layout adaptif untuk berbagai ukuran layar

## 📋 Standard Color Scheme

```tsx
// Section 1: Anamnesis (Merah/Orange)
border-red-200 dark:border-red-800
bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30
bg-red-100 dark:bg-red-900/50

// Section 2: Physical Exam (Biru/Cyan) 
border-blue-200 dark:border-blue-800
bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30
bg-blue-100 dark:bg-blue-900/50

// Section 3: Diagnosis (Hijau/Emerald)
border-green-200 dark:border-green-800
bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30
bg-green-100 dark:bg-green-900/50

// Section 4: Assessment & Plan (Ungu/Pink)
border-purple-200 dark:border-purple-800
bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30
bg-purple-100 dark:bg-purple-900/50

// Section 5: Supporting Exams (Indigo/Violet)
border-purple-200 dark:border-purple-800
bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30
bg-purple-100 dark:bg-purple-900/50

// Section 6: Notes/General (Amber/Yellow)
border-amber-200 dark:border-amber-800
bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30
bg-amber-100 dark:bg-amber-900/50
```

## 🏗️ Component Structure Template

### Standard Form Component

```tsx
export function ComponentForm({ visitId, onSave, isEmergency = false, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Loading state
  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Component Title</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/50">
        <CardTitle className="text-lg">Component Title</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit}>
          <fieldset disabled={readOnly} className="space-y-6">
            
            {/* Section 1: Color-coded Card */}
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                    <IconComponent className="h-5 w-5 text-red-500" />
                  </div>
                  <CardTitle className="text-base font-semibold">Section Title</CardTitle>
                  {/* Optional: Badge for counter */}
                  <Badge variant="default">Count</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Content here */}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Simpan Data
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Table with Checkboxes Template

```tsx
<Table>
  <TableHeader>
    <TableRow className="bg-muted/50">
      <TableHead className="w-[50px] text-center">✓</TableHead>
      <TableHead className="w-[130px]">Item</TableHead>
      <TableHead>Description</TableHead>
      <TableHead className="w-[50px]"></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item, index) => {
      const isChecked = checkedItems[item.id] || false;
      const isExpanded = expandedRows[item.id] || false;
      
      return (
        <Collapsible key={item.id} open={isExpanded} asChild>
          <>
            <TableRow 
              className={cn(
                isChecked && "bg-green-50/50 dark:bg-green-950/10",
                isChecked && "cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-950/20"
              )}
              onClick={() => isChecked && toggleRow(item.id)}
            >
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleCheck(item.id, checked as boolean)}
                  disabled={readOnly}
                />
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                {isChecked ? (
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {item.value || "-"}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50 italic">
                    Belum diisi
                  </span>
                )}
              </TableCell>
              <TableCell>
                {isChecked && (
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(item.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                )}
              </TableCell>
            </TableRow>
            <CollapsibleContent asChild>
              <tr>
                <td colSpan={4} className="p-0">
                  <div className="px-4 py-3 bg-muted/30 border-t">
                    <Textarea
                      placeholder="Detail..."
                      value={item.detail || ""}
                      onChange={(e) => handleDetailChange(item.id, e.target.value)}
                      className="min-h-[80px] resize-none text-sm"
                      disabled={readOnly}
                    />
                  </div>
                </td>
              </tr>
            </CollapsibleContent>
          </>
        </Collapsible>
      );
    })}
  </TableBody>
</Table>
```

## 📝 Components Update List

### ✅ Completed
1. **physical-exam-form.tsx** - Pemeriksaan Fisik
   - Section 1: Kondisi Umum & Tanda Vital (Red/Orange)
   - Section 2: Pemeriksaan Fisik (Blue/Cyan) - Table with checkboxes
   - Section 3: Pemeriksaan Penunjang (Purple/Pink) - Table for ECG

### 🔄 To Be Updated

2. **anamnesis-form.tsx** - Anamnesis
   - Section 1: Keluhan Utama & Riwayat (Red/Orange)
   - Section 2: Riwayat Medis (Blue/Cyan)
   - Section 3: Alergi & Obat (Amber/Yellow)
   - Add: Notes section

3. **diagnosis-form.tsx** - Diagnosis
   - Section 1: Kesan Klinis (Green/Emerald)
   - Section 2: Diagnosis Primer (Green/Emerald) - Table with ICD-10
   - Section 3: Diagnosis Sekunder (Blue/Cyan) - Table with ICD-10
   - Add: Clinical notes section

4. **assessment-plan-form.tsx** - Assessment & Plan
   - Section 1: Asesmen Klinis (Purple/Pink)
   - Section 2: Rencana Terapi (Blue/Cyan)
   - Section 3: Rencana Detail (Grid layout)
   - Add: Monitoring notes

5. **cppt-form.tsx** - CPPT (Catatan Perkembangan Pasien Terintegrasi)
   - Section 1: Subjective (Red/Orange)
   - Section 2: Objective (Blue/Cyan)
   - Section 3: Assessment (Green/Emerald)
   - Section 4: Plan (Purple/Pink)
   - Add: Professional notes

## 🎯 Implementation Checklist

For each component update:

- [ ] Add color-coded Card sections
- [ ] Add icon with colored background circle
- [ ] Use gradient header backgrounds
- [ ] Implement table with checkbox (if applicable)
- [ ] Add collapsible rows for details
- [ ] Add badge counters for progress tracking
- [ ] Implement responsive grid layout
- [ ] Add "Notes/NB" section at the bottom
- [ ] Add proper loading state with spinner
- [ ] Add form validation and error states
- [ ] Test dark mode appearance
- [ ] Ensure accessibility (keyboard navigation)
- [ ] Add tooltips for complex fields
- [ ] Test with readOnly mode

## 💡 Best Practices

1. **Consistent Spacing**: Use `space-y-4` or `space-y-6` for vertical spacing
2. **Icon Size**: Use `h-5 w-5` for card header icons, `h-4 w-4` for buttons
3. **Font Weights**: `font-semibold` for section titles, `font-medium` for labels
4. **Text Sizes**: `text-lg` for main titles, `text-base` for section titles, `text-sm` for labels
5. **Border Radius**: Use default Tailwind rounded values for consistency
6. **Padding**: `p-4` for card content, `py-3 px-4` for card headers
7. **Required Fields**: Mark with `<span className="text-destructive">*</span>`
8. **Placeholder Text**: Provide helpful examples in Indonesian
9. **Validation**: Use `required` attribute for mandatory fields
10. **Disabled State**: Wrap in `<fieldset disabled={readOnly}>` for easy read-only mode

## 📌 Notes Section Template

Every form should have a notes section at the bottom:

```tsx
{/* Notes Section */}
<Card className="border-amber-200 dark:border-amber-800">
  <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
        <FileText className="h-5 w-5 text-amber-500" />
      </div>
      <CardTitle className="text-base font-semibold">Catatan Tambahan</CardTitle>
    </div>
  </CardHeader>
  <CardContent className="p-4">
    <Textarea
      placeholder="Catatan penting, observasi khusus, atau informasi tambahan..."
      value={formData.notes}
      onChange={(e) => handleChange("notes", e.target.value)}
      className="min-h-[80px] resize-none"
    />
    <p className="text-xs text-muted-foreground mt-2">
      NB: Catatan ini akan muncul di summary rekam medis
    </p>
  </CardContent>
</Card>
```

## 🚀 Implementation Priority

1. **High Priority** (Core forms):
   - anamnesis-form.tsx
   - physical-exam-form.tsx ✅
   - diagnosis-form.tsx
   - assessment-plan-form.tsx

2. **Medium Priority** (Inpatient):
   - cppt-form.tsx
   - fluid-balance-form.tsx

3. **Low Priority** (Orders):
   - medicine-order-form.tsx
   - laboratory-order-form.tsx
   - radiology-order-form.tsx

---

**Last Updated**: December 15, 2025
**Maintained by**: Development Team
**Version**: 1.0.0
