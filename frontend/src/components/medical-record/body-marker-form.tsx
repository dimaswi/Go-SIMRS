import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Save, Trash2, X, Eye, ChevronDown, ChevronRight, ImageIcon, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "./tab-indicator";
import { masterDataApi, medicalRecordsApi, type BodyMarkerData, type BodyMarkerItem, type BodyMarkerPoint, type MasterData } from "@/lib/api";
import { resolveBackendFileUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BodyMarkerFormProps {
  visitId: number;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
  externalData?: BodyMarkerData | BodyMarkerItem[];
  useExternalData?: boolean;
  footerSaveOnly?: boolean;
}

interface MarkerImageOption {
  masterId: number;
  code: string;
  name: string;
  imageUrl: string;
  parentId?: number;
  categoryCode?: string;
  categoryName?: string;
}

interface MarkerCategoryOption {
  id: number;
  code: string;
  name: string;
}

const parseImageMetadata = (metadata?: string): { imageUrl?: string; categoryCode?: string; categoryName?: string } => {
  const raw = (metadata || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const imageUrl =
      (typeof parsed.image_url === "string" && parsed.image_url) ||
      (typeof parsed.url === "string" && parsed.url) ||
      (typeof parsed.imageUrl === "string" && parsed.imageUrl) ||
      "";

    const categoryCode = typeof parsed.category_code === "string" ? parsed.category_code : "";
    const categoryName = typeof parsed.category_name === "string" ? parsed.category_name : "";

    return {
      imageUrl,
      categoryCode,
      categoryName,
    };
  } catch {
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/uploads/")) {
      return { imageUrl: raw };
    }
    return {};
  }
};

const asPercent = (value: number) => Math.max(0, Math.min(100, value));

const toMarkerNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;

  const match = (value || "").match(/\d+/);
  if (match) return Number(match[0]);

  return fallback;
};

const toMarkerLabel = (value: string | undefined, fallback: number) => String(toMarkerNumber(value, fallback));

const mapBodyMarkerItems = (items: BodyMarkerItem[] | undefined): BodyMarkerItem[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item, itemIndex) => ({
    id: item.id || `item-${itemIndex + 1}`,
    image_master_id: Number(item.image_master_id || 0),
    image_code: item.image_code || "",
    image_name: item.image_name || "",
    image_url: item.image_url || "",
    category_code: item.category_code || "",
    category_name: item.category_name || "",
    markers: Array.isArray(item.markers)
      ? item.markers.map((marker, markerIndex) => ({
          id: marker.id || `marker-${itemIndex + 1}-${markerIndex + 1}`,
          x: asPercent(Number(marker.x || 0)),
          y: asPercent(Number(marker.y || 0)),
          label: toMarkerLabel(marker.label, markerIndex + 1),
          note: marker.note || "",
        }))
      : [],
  }));
};

const getExternalMarkerItems = (externalData?: BodyMarkerData | BodyMarkerItem[]) => {
  if (Array.isArray(externalData)) return externalData;
  return externalData?.items;
};

export function BodyMarkerForm({
  visitId,
  readOnly = false,
  isPatientDischarged = false,
  externalData,
  useExternalData = false,
  footerSaveOnly = false,
}: BodyMarkerFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<MarkerCategoryOption[]>([]);
  const [images, setImages] = useState<MarkerImageOption[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedImageMasterId, setSelectedImageMasterId] = useState<string>("");

  const [items, setItems] = useState<BodyMarkerItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string>("");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>("");
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalStep, setEditModalStep] = useState<"pick" | "canvas">("pick");
  const [viewItemId, setViewItemId] = useState<string>("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);

  const isFormDisabled = readOnly || isPatientDischarged || useExternalData;

  const totalMarkers = useMemo(
    () => items.reduce((acc, item) => acc + (Array.isArray(item.markers) ? item.markers.length : 0), 0),
    [items],
  );

  const filteredImages = useMemo(() => {
    if (selectedCategoryId === "all") return images;
    return images.filter((image) => String(image.parentId || "") === selectedCategoryId);
  }, [images, selectedCategoryId]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Semua kategori" },
      ...categories.map((category) => ({ value: String(category.id), label: category.name })),
    ],
    [categories],
  );

  const bodyPartOptions = useMemo(
    () => filteredImages.map((image) => ({ value: String(image.masterId), label: image.name })),
    [filteredImages],
  );

  useEffect(() => {
    if (!selectedImageMasterId) return;
    const stillExists = filteredImages.some((image) => String(image.masterId) === selectedImageMasterId);
    if (!stillExists) {
      setSelectedImageMasterId("");
    }
  }, [filteredImages, selectedImageMasterId]);

  const activeItem = useMemo(
    () => items.find((item) => String(item.id || "") === activeItemId) || null,
    [items, activeItemId],
  );

  const activeItemImageUrl = useMemo(
    () => resolveBackendFileUrl(activeItem?.image_url || ""),
    [activeItem?.image_url],
  );

  useEffect(() => {
    emitMedicalRecordTabIndicator("body-marker", String(totalMarkers));
    emitMedicalRecordTabSaved("body-marker", useExternalData ? false : items.length > 0 || totalMarkers > 0);
  }, [items, totalMarkers, useExternalData]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [categoryRes, imageRes] = await Promise.all([
          masterDataApi.getByCategory("body_marker_category", { include_inactive: true }),
          masterDataApi.getByCategory("body_marker_image", { include_inactive: true }),
        ]);
        if (!active) return;
        setCategories((categoryRes.data?.data || []).map((cat) => ({ id: cat.id, code: cat.code, name: cat.name })));
        const imageData = (imageRes.data?.data || [])
          .map((img: MasterData) => {
            const metadata = parseImageMetadata(img.metadata);
            return { masterId: img.id, code: img.code, name: img.name, imageUrl: metadata.imageUrl || "", parentId: img.parent_id, categoryCode: metadata.categoryCode || "", categoryName: metadata.categoryName || "" };
          })
          .filter((img) => Boolean(img.imageUrl));
        setImages(imageData);

        const markerItems = useExternalData
          ? getExternalMarkerItems(externalData)
          : (await medicalRecordsApi.getBodyMarkers(visitId)).data?.items;
        if (!active) return;
        const savedItems = mapBodyMarkerItems(markerItems);
        setItems(savedItems);
        if (savedItems.length > 0) setActiveItemId(String(savedItems[0].id || ""));
      } catch {
        if (!active) return;
        toast({ title: "Gagal", description: "Data marker bagian tubuh tidak dapat dimuat.", variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [externalData, useExternalData, visitId, toast]);

  const addImageToItems = () => {
    if (!selectedImageMasterId) return;
    const image = images.find((img) => img.masterId === Number(selectedImageMasterId));
    if (!image) return;
    const alreadyExists = items.some((item) => item.image_master_id === image.masterId);
    if (alreadyExists) {
      const existingId = String(items.find((item) => item.image_master_id === image.masterId)?.id || "");
      setActiveItemId(existingId);
      setEditModalStep("canvas");
      return;
    }
    const categoryFromParent = categories.find((cat) => cat.id === image.parentId);
    const newItem: BodyMarkerItem = {
      id: `item-${Date.now()}`, image_master_id: image.masterId, image_code: image.code, image_name: image.name,
      image_url: image.imageUrl, category_code: image.categoryCode || categoryFromParent?.code || "",
      category_name: image.categoryName || categoryFromParent?.name || "", markers: [],
    };
    setItems((prev) => [...prev, newItem]);
    setActiveItemId(String(newItem.id || ""));
    setSelectedMarkerId("");
    setEditModalStep("canvas");
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const removeImageFromItems = (itemId: string) => {
    setItems((prev) => prev.filter((item) => String(item.id || "") !== itemId));
    if (activeItemId === itemId) {
      const next = items.find((item) => String(item.id || "") !== itemId);
      setActiveItemId(String(next?.id || ""));
      setSelectedMarkerId("");
    }
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (isFormDisabled || !activeItem || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = asPercent(((event.clientX - rect.left) / rect.width) * 100);
    const y = asPercent(((event.clientY - rect.top) / rect.height) * 100);
    const markerCount = activeItem.markers.length;
    const nextMarker: BodyMarkerPoint = { id: `marker-${Date.now()}-${markerCount + 1}`, x, y, label: String(markerCount + 1), note: "" };
    setItems((prev) => prev.map((item) => {
      if (String(item.id || "") !== String(activeItem.id || "")) return item;
      return { ...item, markers: [...item.markers, nextMarker] };
    }));
    setSelectedMarkerId(String(nextMarker.id || ""));
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const removeMarker = (markerId: string) => {
    if (!activeItem) return;
    setItems((prev) => prev.map((item) => {
      if (String(item.id || "") !== String(activeItem.id || "")) return item;
      const markers = item.markers.filter((m) => String(m.id || "") !== markerId).map((m, i) => ({ ...m, label: String(i + 1) }));
      return { ...item, markers };
    }));
    if (selectedMarkerId === markerId) setSelectedMarkerId("");
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const updateMarkerNote = (markerId: string, note: string) => {
    if (!activeItem) return;
    setItems((prev) => prev.map((item) => {
      if (String(item.id || "") !== String(activeItem.id || "")) return item;
      return { ...item, markers: item.markers.map((m) => String(m.id || "") === markerId ? { ...m, note } : m) };
    }));
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BodyMarkerItem[] = items.map((item) => ({
        id: item.id, image_master_id: item.image_master_id, image_code: item.image_code,
        image_name: item.image_name, image_url: item.image_url, category_code: item.category_code,
        category_name: item.category_name,
        markers: item.markers.map((marker, index) => ({ id: marker.id, x: asPercent(marker.x), y: asPercent(marker.y), label: String(index + 1), note: marker.note || "" })),
      }));
      await medicalRecordsApi.saveBodyMarkers(visitId, { items: payload });
      emitMedicalRecordTabSaved("body-marker", true);
      toast({ title: "Berhasil", description: "Marker bagian tubuh berhasil disimpan." });
      setIsEditModalOpen(false);
    } catch {
      toast({ title: "Gagal", description: "Marker bagian tubuh gagal disimpan.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const openEditModal = () => {
    setSelectedCategoryId("all");
    setSelectedImageMasterId("");
    setEditModalStep("pick");
    setSelectedMarkerId("");
    setIsEditModalOpen(true);
  };

  const openViewModal = (itemId: string) => {
    setViewItemId(itemId);
    setSelectedMarkerId("");
    setIsViewModalOpen(true);
  };

  const viewItem = useMemo(
    () => items.find((item) => String(item.id || "") === viewItemId) || null,
    [items, viewItemId],
  );

  const viewItemImageUrl = useMemo(
    () => resolveBackendFileUrl(viewItem?.image_url || ""),
    [viewItem?.image_url],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderCanvas = (item: BodyMarkerItem, imgUrl: string, interactive: boolean) => (
    <div className="h-full w-full flex items-center justify-center bg-muted/10 overflow-hidden">
      <div className="relative inline-block max-w-full max-h-full">
        <img ref={interactive ? imageRef : undefined} src={imgUrl} alt={item.image_name}
          className={cn("block w-auto h-auto max-w-full max-h-[calc(100vh-200px)]", interactive && !isFormDisabled ? "cursor-crosshair" : "cursor-default")}
          onClick={interactive ? handleImageClick : undefined}
          onLoad={() => setImageLoadErrors((p) => ({ ...p, [String(item.id || "")]: false }))}
          onError={() => setImageLoadErrors((p) => ({ ...p, [String(item.id || "")]: true }))}
        />
        {imageLoadErrors[String(item.id || "")] && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90"><p className="text-xs text-muted-foreground">Gambar tidak dapat ditampilkan.</p></div>
        )}
        {item.markers.map((marker, index) => {
          const mid = String(marker.id || "");
          return (
            <button key={mid} type="button"
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-rose-600 text-[10px] font-semibold text-white shadow", selectedMarkerId === mid && "ring-2 ring-rose-200")}
              style={{ left: `${asPercent(marker.x)}%`, top: `${asPercent(marker.y)}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedMarkerId(mid); }}
            >{toMarkerLabel(marker.label, index + 1)}</button>
          );
        })}
      </div>
    </div>
  );

  const renderMarkerTable = (item: BodyMarkerItem, editable: boolean) => (
    <div className="rounded-md border">
      <table className="w-full table-fixed text-xs">
        <colgroup><col className="w-[60px]" /><col />{editable && <col className="w-[48px]" />}</colgroup>
        <thead className="bg-muted/30"><tr className="border-b"><th className="px-2 py-2 text-left font-semibold">No</th><th className="px-2 py-2 text-left font-semibold">Catatan</th>{editable && <th className="px-2 py-2 text-center font-semibold">Aksi</th>}</tr></thead>
        <tbody>
          {item.markers.map((marker, index) => {
            const mid = String(marker.id || "");
            return (
              <tr key={mid} className={cn("border-b last:border-0", selectedMarkerId === mid ? "bg-primary/5" : "bg-background")}>
                <td className="px-2 py-2"><button type="button" className="font-semibold" onClick={() => setSelectedMarkerId(mid)}>{toMarkerLabel(marker.label, index + 1)}</button></td>
                <td className="px-2 py-2 min-w-0">{editable ? <Input value={marker.note || ""} onChange={(e) => updateMarkerNote(mid, e.target.value)} placeholder="Catatan (opsional)" className="h-8 w-full text-xs" /> : <span className="text-xs text-muted-foreground">{marker.note || "-"}</span>}</td>
                {editable && <td className="px-2 py-2 text-center"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMarker(mid)}><Trash2 className="h-3.5 w-3.5" /></Button></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Marker Bagian Tubuh</span>
              {!isFormDisabled && <Button type="button" onClick={openEditModal} size="sm" className="h-6 px-2 py-0 text-[10px]"><Plus className="h-3.5 w-3.5 mr-1" />Tambah</Button>}
            </div>
          </div>
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-1"></div><div className="col-span-4">Gambar</div><div className="col-span-2">Kategori</div><div className="col-span-2">Marker</div><div className="col-span-3 text-right">Aksi</div>
              </div>
              <div className="divide-y">
                {items.map((item) => {
                  const iid = String(item.id || "");
                  return (
                    <Collapsible key={iid} className="group">
                      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors">
                        <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-none shrink-0"><ChevronRight className="h-4 w-4 group-data-[state=open]:hidden" /><ChevronDown className="h-4 w-4 hidden group-data-[state=open]:block" /></Button></CollapsibleTrigger>
                        <div className="flex-1 grid grid-cols-12 gap-2 items-center text-sm">
                          <div className="col-span-4 text-xs font-medium truncate">{item.image_name}</div>
                          <div className="col-span-2 text-xs text-muted-foreground truncate">{item.category_name || "-"}</div>
                          <div className="col-span-2"><Badge variant="secondary" className="text-[10px]">{item.markers.length}</Badge></div>
                          <div className="col-span-4 flex items-center justify-end gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => openViewModal(iid)}><Eye className="h-3.5 w-3.5" /></Button>
                            {!isFormDisabled && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-none" onClick={() => removeImageFromItems(iid)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                          </div>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="px-12 py-3 bg-muted/10 border-t border-border/50">
                          {item.markers.length > 0 ? renderMarkerTable(item, false) : <p className="text-xs text-muted-foreground">Belum ada marker.</p>}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-sm">Belum ada marker tubuh</p>
              <p className="text-xs mt-1">{useExternalData ? "Tidak ada data marker tubuh pada RM asli." : 'Klik "Tambah" untuk memulai.'}</p>
            </div>
          )}
        </div>
      </form>

      {/* EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <ImageIcon className="h-4 w-4" />{editModalStep === "pick" ? "Pilih Gambar Tubuh" : activeItem?.image_name || "Marker"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {editModalStep === "canvas" && <Button type="button" variant="outline" size="sm" className="rounded-none h-7 text-[10px]" onClick={() => setEditModalStep("pick")}><ArrowLeft className="h-3 w-3 mr-1" />Ganti Gambar</Button>}
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)} className="h-6 w-6 rounded-none"><X className="h-4 w-4" /></Button>
            </div>
          </DialogHeader>
          {editModalStep === "pick" ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg space-y-6">
                <div className="space-y-2"><Label className="text-xs uppercase text-muted-foreground font-semibold">Kategori</Label><Combobox options={categoryOptions} value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v || "all")} placeholder="Semua kategori" searchPlaceholder="Cari..." emptyText="Tidak ditemukan" className="h-11" /></div>
                <div className="space-y-2"><Label className="text-xs uppercase text-muted-foreground font-semibold">Gambar Tubuh</Label><Combobox options={bodyPartOptions} value={selectedImageMasterId} onValueChange={(v) => setSelectedImageMasterId(v || "")} placeholder="Pilih bagian tubuh" searchPlaceholder="Cari..." emptyText="Tidak ditemukan" disabled={filteredImages.length === 0} className="h-11" /></div>
                <Button type="button" className="w-full h-11" onClick={addImageToItems} disabled={!selectedImageMasterId}><Plus className="mr-2 h-4 w-4" />Pilih & Lanjutkan</Button>
              </div>
            </div>
          ) : activeItem ? (
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 min-h-0 flex flex-col border-r border-border/70">
                <div className="px-3 py-2 border-b border-border/70 bg-muted/20 text-xs text-muted-foreground shrink-0">Klik gambar untuk menambahkan marker. Total: <span className="font-semibold text-foreground">{activeItem.markers.length}</span></div>
                <div className="flex-1 min-h-0 p-2">{renderCanvas(activeItem, activeItemImageUrl, true)}</div>
              </div>
              <div className="w-[400px] flex flex-col min-h-0 shrink-0">
                <div className="px-3 py-2 border-b border-border/70 bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Daftar Marker</div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3">{activeItem.markers.length === 0 ? <p className="text-xs text-muted-foreground">Klik gambar di sebelah kiri.</p> : renderMarkerTable(activeItem, !isFormDisabled)}</div>
              </div>
            </div>
          ) : null}
          <div className="shrink-0 border-t bg-background p-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none w-28 text-xs h-9" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            {footerSaveOnly ? (
              <Button type="button" className="rounded-none w-28 text-xs h-9" onClick={() => setIsEditModalOpen(false)}>Selesai</Button>
            ) : (
              <Button type="button" className="rounded-none w-28 text-xs h-9" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground"><Eye className="h-4 w-4" />{viewItem?.image_name || "Detail"}</DialogTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => setIsViewModalOpen(false)} className="h-6 w-6 rounded-none"><X className="h-4 w-4" /></Button>
          </DialogHeader>
          {viewItem && (
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 min-h-0 p-2 border-r border-border/70">{renderCanvas(viewItem, viewItemImageUrl, false)}</div>
              <div className="w-[400px] flex flex-col min-h-0 shrink-0">
                <div className="px-3 py-2 border-b border-border/70 bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Daftar Marker ({viewItem.markers.length})</div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3">{viewItem.markers.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada marker.</p> : renderMarkerTable(viewItem, false)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

