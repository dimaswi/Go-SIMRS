import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Save, Trash2, X, Eye, ChevronDown, ChevronRight, ImageIcon, ArrowLeft, Pencil } from "lucide-react";
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

  const openEditItemModal = (itemId: string) => {
    setActiveItemId(itemId);
    setSelectedMarkerId("");
    setEditModalStep("canvas");
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
    <div className="h-full w-full flex items-center justify-center bg-neutral-50/50 dark:bg-neutral-900/30 overflow-hidden">
      <div className="relative inline-block max-w-full max-h-full">
        <img
          ref={interactive ? imageRef : undefined}
          src={imgUrl}
          alt={item.image_name}
          className={cn(
            "block w-auto h-auto max-w-full max-h-[calc(100vh-200px)]",
            interactive && !isFormDisabled ? "cursor-crosshair" : "cursor-default",
          )}
          onClick={interactive ? handleImageClick : undefined}
          onLoad={() => setImageLoadErrors((p) => ({ ...p, [String(item.id || "")]: false }))}
          onError={() => setImageLoadErrors((p) => ({ ...p, [String(item.id || "")]: true }))}
        />
        {imageLoadErrors[String(item.id || "")] && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90">
            <p className="text-xs text-muted-foreground">Gambar tidak dapat ditampilkan.</p>
          </div>
        )}
        {item.markers.map((marker, index) => {
          const mid = String(marker.id || "");
          return (
            <button
              key={mid}
              type="button"
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-rose-600 text-[10px] font-bold text-white shadow",
                selectedMarkerId === mid && "ring-2 ring-rose-200",
              )}
              style={{ left: `${asPercent(marker.x)}%`, top: `${asPercent(marker.y)}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMarkerId(mid);
              }}
            >
              {toMarkerLabel(marker.label, index + 1)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMarkerTable = (item: BodyMarkerItem, editable: boolean) => (
    <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[52px]" />
          <col />
          {editable && <col className="w-[44px]" />}
        </colgroup>
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="h-8 px-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
              No
            </th>
            <th className="h-8 px-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">
              Catatan Temuan
            </th>
            {editable && (
              <th className="h-8 px-2 text-center font-bold uppercase tracking-wider text-muted-foreground">
                Aksi
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {item.markers.map((marker, index) => {
            const mid = String(marker.id || "");
            return (
              <tr
                key={mid}
                className={cn(
                  selectedMarkerId === mid
                    ? "bg-neutral-100/70 dark:bg-neutral-900/60"
                    : "bg-white dark:bg-neutral-950",
                )}
              >
                <td className="px-2.5 py-2 align-middle">
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white"
                    onClick={() => setSelectedMarkerId(mid)}
                  >
                    {toMarkerLabel(marker.label, index + 1)}
                  </button>
                </td>
                <td className="px-2.5 py-2 min-w-0 align-middle">
                  {editable ? (
                    <Input
                      value={marker.note || ""}
                      onChange={(e) => updateMarkerNote(mid, e.target.value)}
                      placeholder="Tulis keterangan lokasi / lesi / nyeri..."
                      className="h-8 w-full text-xs rounded-none"
                    />
                  ) : (
                    <span className="text-xs text-foreground">{marker.note || "-"}</span>
                  )}
                </td>
                {editable && (
                  <td className="px-2 py-2 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                      onClick={() => removeMarker(mid)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Marker Bagian Tubuh
                  </div>
                  <Badge
                    variant={items.length > 0 ? "default" : "secondary"}
                    className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                  >
                    {items.length} Gambar • {totalMarkers} Titik
                  </Badge>
                </div>

                {!isFormDisabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditModal}
                    className="h-8 rounded-none px-3 text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Marker Tubuh
                  </Button>
                )}
              </div>

              {items.length > 0 ? (
                <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800">
                  <div className="grid grid-cols-12 gap-2 px-3.5 h-9 items-center bg-neutral-50 dark:bg-neutral-900 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                    <div className="col-span-1"></div>
                    <div className="col-span-4">Bagian / Gambar Anatomi</div>
                    <div className="col-span-3">Kategori</div>
                    <div className="col-span-2">Jumlah Titik</div>
                    <div className="col-span-2 text-right">Aksi</div>
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {items.map((item) => {
                      const iid = String(item.id || "");
                      return (
                        <Collapsible key={iid} className="group">
                          <div className="flex items-center gap-2 px-3.5 py-2.5 hover:bg-muted/30 transition-colors">
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 rounded-none shrink-0"
                                title="Tampilkan Daftar Titik Marker"
                              >
                                <ChevronRight className="h-3.5 w-3.5 group-data-[state=open]:hidden" />
                                <ChevronDown className="h-3.5 w-3.5 hidden group-data-[state=open]:block" />
                              </Button>
                            </CollapsibleTrigger>
                            <div className="flex-1 grid grid-cols-12 gap-2 items-center text-xs">
                              <div className="col-span-5 font-semibold text-foreground truncate">
                                {item.image_name}
                              </div>
                              <div className="col-span-3 text-muted-foreground truncate">
                                {item.category_name || "-"}
                              </div>
                              <div className="col-span-2">
                                <Badge
                                  variant={item.markers.length > 0 ? "default" : "secondary"}
                                  className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                                >
                                  {item.markers.length} Titik
                                </Badge>
                              </div>
                              <div className="col-span-2 flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none"
                                  onClick={() => openViewModal(iid)}
                                  title="Lihat Gambar & Marker"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {!isFormDisabled && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-none"
                                      onClick={() => openEditItemModal(iid)}
                                      title="Edit Titik Marker"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                                      onClick={() => removeImageFromItems(iid)}
                                      title="Hapus Gambar Marker"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="px-4 py-3 bg-neutral-50/50 dark:bg-neutral-900/30 border-t border-neutral-200 dark:border-neutral-800">
                              {item.markers.length > 0 ? (
                                renderMarkerTable(item, false)
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Belum ada titik marker yang ditandai pada gambar ini.
                                </p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  {useExternalData
                    ? "Tidak ada data marker tubuh yang tercatat pada rekam medis ini."
                    : "Belum ada marker bagian tubuh yang tercatat."}
                </div>
              )}
            </section>
          </div>
        </form>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-white dark:bg-neutral-950 overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {editModalStep === "pick"
                    ? "Pilih Gambar Anatomi Tubuh"
                    : activeItem?.image_name || "Penandaan Marker Tubuh"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {editModalStep === "pick"
                    ? "Pilih kategori dan gambar bagian tubuh yang akan diberikan penanda klinis."
                    : "Klik pada area gambar untuk menambahkan titik marker dan isi keterangannya di panel kanan."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editModalStep === "canvas" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none h-8 px-3 text-xs"
                  onClick={() => setEditModalStep("pick")}
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Ganti Gambar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsEditModalOpen(false)}
                className="h-8 w-8 rounded-none"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {editModalStep === "pick" ? (
            <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50/40 dark:bg-neutral-900/20">
              <div className="w-full max-w-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
                <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Pilih Gambar Bagian Tubuh
                </div>

                <div className="space-y-3 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Kategori Anatomi</Label>
                    <Combobox
                      allowCustomValue
                      options={categoryOptions}
                      value={selectedCategoryId}
                      onValueChange={(v) => setSelectedCategoryId(v || "all")}
                      placeholder="Semua kategori"
                      searchPlaceholder="Cari kategori..."
                      emptyText="Tidak ditemukan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Gambar Bagian Tubuh</Label>
                    <Combobox
                      allowCustomValue
                      options={bodyPartOptions}
                      value={selectedImageMasterId}
                      onValueChange={(v) => setSelectedImageMasterId(v || "")}
                      placeholder="Pilih bagian tubuh"
                      searchPlaceholder="Cari gambar bagian tubuh..."
                      emptyText="Tidak ditemukan"
                      disabled={filteredImages.length === 0}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full h-9 rounded-none text-xs"
                  onClick={addImageToItems}
                  disabled={!selectedImageMasterId}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Pilih &amp; Lanjutkan ke Kanvas Marker
                </Button>
              </div>
            </div>
          ) : activeItem ? (
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 min-h-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800">
                <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 text-xs text-muted-foreground shrink-0 flex items-center justify-between">
                  <span>Klik pada gambar untuk menambahkan titik marker baru.</span>
                  <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px] font-mono">
                    Total Titik: {activeItem.markers.length}
                  </Badge>
                </div>
                <div className="flex-1 min-h-0 p-2">
                  {renderCanvas(activeItem, activeItemImageUrl, true)}
                </div>
              </div>
              <div className="w-[420px] flex flex-col min-h-0 shrink-0 bg-white dark:bg-neutral-950">
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 shrink-0">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Daftar Titik Marker ({activeItem.markers.length})
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
                  {activeItem.markers.length === 0 ? (
                    <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                      Klik area pada gambar di sebelah kiri untuk menambahkan titik marker.
                    </div>
                  ) : (
                    renderMarkerTable(activeItem, !isFormDisabled)
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none px-4 text-xs h-8"
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </Button>
            {footerSaveOnly ? (
              <Button
                type="button"
                className="rounded-none px-4 text-xs h-8"
                onClick={() => setIsEditModalOpen(false)}
              >
                Selesai
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-none px-4 text-xs h-8"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Simpan Marker
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-white dark:bg-neutral-950 overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Eye className="h-4 w-4" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {viewItem?.image_name || "Detail Marker Tubuh"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {viewItem?.category_name ? `Kategori: ${viewItem.category_name}` : "Pratinjau gambar dan daftar catatan titik marker"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsViewModalOpen(false)}
              className="h-8 w-8 rounded-none"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          {viewItem && (
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 min-h-0 p-2 border-r border-neutral-200 dark:border-neutral-800">
                {renderCanvas(viewItem, viewItemImageUrl, false)}
              </div>
              <div className="w-[420px] flex flex-col min-h-0 shrink-0 bg-white dark:bg-neutral-950">
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 shrink-0">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Daftar Titik Marker ({viewItem.markers.length})
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
                  {viewItem.markers.length === 0 ? (
                    <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                      Belum ada titik marker pada gambar ini.
                    </div>
                  ) : (
                    renderMarkerTable(viewItem, false)
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


