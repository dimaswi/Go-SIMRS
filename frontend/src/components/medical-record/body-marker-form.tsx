import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, Plus, Save, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "./tab-indicator";
import { masterDataApi, medicalRecordsApi, type BodyMarkerItem, type BodyMarkerPoint, type MasterData } from "@/lib/api";
import { resolveBackendFileUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BodyMarkerFormProps {
  visitId: number;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
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

const MIN_ZOOM_LEVEL = 50;
const MAX_ZOOM_LEVEL = 200;
const ZOOM_STEP = 10;

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

export function BodyMarkerForm({ visitId, readOnly = false, isPatientDischarged = false }: BodyMarkerFormProps) {
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
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasPanelRef = useRef<HTMLDivElement | null>(null);

  const isFormDisabled = readOnly || isPatientDischarged;

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
    emitMedicalRecordTabSaved("body-marker", items.length > 0 || totalMarkers > 0);
  }, [items, totalMarkers]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsCanvasFullscreen(document.fullscreenElement === canvasPanelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setZoomLevel(100);
  }, [activeItemId]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [categoryRes, imageRes, markerRes] = await Promise.all([
          masterDataApi.getByCategory("body_marker_category", { include_inactive: true }),
          masterDataApi.getByCategory("body_marker_image", { include_inactive: true }),
          medicalRecordsApi.getBodyMarkers(visitId),
        ]);

        if (!active) return;

        const categoryData = (categoryRes.data?.data || []).map((cat) => ({
          id: cat.id,
          code: cat.code,
          name: cat.name,
        }));
        setCategories(categoryData);

        const imageData = (imageRes.data?.data || [])
          .map((img: MasterData) => {
            const metadata = parseImageMetadata(img.metadata);
            return {
              masterId: img.id,
              code: img.code,
              name: img.name,
              imageUrl: metadata.imageUrl || "",
              parentId: img.parent_id,
              categoryCode: metadata.categoryCode || "",
              categoryName: metadata.categoryName || "",
            };
          })
          .filter((img) => Boolean(img.imageUrl));

        setImages(imageData);

        const savedItems = mapBodyMarkerItems(markerRes.data?.items);
        setItems(savedItems);

        if (savedItems.length > 0) {
          setActiveItemId(String(savedItems[0].id || ""));
        }
      } catch {
        if (!active) return;
        toast({
          title: "Gagal",
          description: "Data marker bagian tubuh tidak dapat dimuat.",
          variant: "destructive",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [visitId, toast]);

  const addImageToItems = () => {
    if (!selectedImageMasterId) return;

    const image = images.find((img) => img.masterId === Number(selectedImageMasterId));
    if (!image) return;

    const alreadyExists = items.some((item) => item.image_master_id === image.masterId);
    if (alreadyExists) {
      setActiveItemId(String(items.find((item) => item.image_master_id === image.masterId)?.id || ""));
      return;
    }

    const categoryFromParent = categories.find((cat) => cat.id === image.parentId);

    const newItem: BodyMarkerItem = {
      id: `item-${Date.now()}`,
      image_master_id: image.masterId,
      image_code: image.code,
      image_name: image.name,
      image_url: image.imageUrl,
      category_code: image.categoryCode || categoryFromParent?.code || "",
      category_name: image.categoryName || categoryFromParent?.name || "",
      markers: [],
    };

    setItems((prev) => [...prev, newItem]);
    setActiveItemId(String(newItem.id || ""));
    setSelectedMarkerId("");
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
    const nextMarker: BodyMarkerPoint = {
      id: `marker-${Date.now()}-${markerCount + 1}`,
      x,
      y,
      label: String(markerCount + 1),
      note: "",
    };

    setItems((prev) =>
      prev.map((item) => {
        if (String(item.id || "") !== String(activeItem.id || "")) return item;
        return {
          ...item,
          markers: [...item.markers, nextMarker],
        };
      }),
    );

    setSelectedMarkerId(String(nextMarker.id || ""));
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const removeMarker = (markerId: string) => {
    if (!activeItem) return;

    setItems((prev) =>
      prev.map((item) => {
        if (String(item.id || "") !== String(activeItem.id || "")) return item;
        const markers = item.markers
          .filter((marker) => String(marker.id || "") !== markerId)
          .map((marker, index) => ({
            ...marker,
            label: String(index + 1),
          }));

        return {
          ...item,
          markers,
        };
      }),
    );

    if (selectedMarkerId === markerId) {
      setSelectedMarkerId("");
    }
    emitMedicalRecordTabSaved("body-marker", false);
  };

  const updateMarkerNote = (markerId: string, note: string) => {
    if (!activeItem) return;

    setItems((prev) =>
      prev.map((item) => {
        if (String(item.id || "") !== String(activeItem.id || "")) return item;
        return {
          ...item,
          markers: item.markers.map((marker) =>
            String(marker.id || "") === markerId
              ? {
                  ...marker,
                  note,
                }
              : marker,
          ),
        };
      }),
    );

    emitMedicalRecordTabSaved("body-marker", false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BodyMarkerItem[] = items.map((item) => ({
        id: item.id,
        image_master_id: item.image_master_id,
        image_code: item.image_code,
        image_name: item.image_name,
        image_url: item.image_url,
        category_code: item.category_code,
        category_name: item.category_name,
        markers: item.markers.map((marker, index) => ({
          id: marker.id,
          x: asPercent(marker.x),
          y: asPercent(marker.y),
          label: String(index + 1),
          note: marker.note || "",
        })),
      }));

      await medicalRecordsApi.saveBodyMarkers(visitId, { items: payload });

      emitMedicalRecordTabSaved("body-marker", true);
      toast({
        title: "Berhasil",
        description: "Marker bagian tubuh berhasil disimpan.",
      });
    } catch {
      toast({
        title: "Gagal",
        description: "Marker bagian tubuh gagal disimpan.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCanvasFullscreen = async () => {
    const panel = canvasPanelRef.current;
    if (!panel) return;

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch {
      toast({
        title: "Gagal",
        description: "Mode layar penuh tidak dapat dibuka pada browser ini.",
        variant: "destructive",
      });
    }
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM_LEVEL, prev - ZOOM_STEP));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM_LEVEL, prev + ZOOM_STEP));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Marker Bagian Tubuh
        </div>
        <div className="space-y-5 p-3 sm:p-4 [&_label]:tracking-[0.01em]">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <div className="space-y-2">
              <Label className="text-sm">Kategori Gambar</Label>
              <Combobox
                options={categoryOptions}
                value={selectedCategoryId}
                onValueChange={(value) => setSelectedCategoryId(value || "all")}
                placeholder="Pilih kategori gambar"
                searchPlaceholder="Cari kategori gambar..."
                emptyText="Kategori tidak ditemukan"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Pilih Gambar</Label>
              <Combobox
                options={bodyPartOptions}
                value={selectedImageMasterId}
                onValueChange={(value) => setSelectedImageMasterId(value || "")}
                placeholder="Pilih bagian tubuh"
                searchPlaceholder="Cari bagian tubuh..."
                emptyText="Bagian tubuh tidak ditemukan"
                disabled={filteredImages.length === 0}
                className="h-11"
              />
            </div>

            <div className="flex items-end">
              <Button type="button" className="h-11" onClick={addImageToItems} disabled={isFormDisabled || !selectedImageMasterId}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah
              </Button>
            </div>
        </div>

        {images.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Master gambar marker belum tersedia. Tambahkan data pada kategori body_marker_image di Master Data.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const active = String(item.id || "") === activeItemId;
              return (
                <button
                  key={String(item.id || "")}
                  type="button"
                  onClick={() => {
                    setActiveItemId(String(item.id || ""));
                    setSelectedMarkerId("");
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
                    active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <span>{item.image_name}</span>
                  <Badge variant="secondary">{item.markers.length}</Badge>
                  {!isFormDisabled && (
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        removeImageFromItems(String(item.id || ""));
                      }}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
        </div>
      </div>

      {activeItem ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(320px,360px)]">
          <div
            ref={canvasPanelRef}
            className={cn("border border-border/70 bg-background", isCanvasFullscreen && "h-full w-full")}
          >
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kanvas Marker</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= MIN_ZOOM_LEVEL}
                    title="Zoom out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>

                  <span className="min-w-[48px] text-center text-xs font-semibold text-foreground">{zoomLevel}%</span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= MAX_ZOOM_LEVEL}
                    title="Zoom in"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={toggleCanvasFullscreen}
                    title={isCanvasFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
                  >
                    {isCanvasFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="px-3 pt-3">
              <p className="text-sm font-semibold">{activeItem.image_name}</p>
              <p className="text-xs text-muted-foreground">
                Klik area gambar untuk menambahkan marker. Total marker: {activeItem.markers.length}
              </p>
            </div>
            <div className="p-3 sm:p-4">
              <div className="rounded-md border bg-muted/20">
                <div className={cn("min-h-[220px] overflow-auto p-2", isCanvasFullscreen ? "h-[calc(100vh-210px)]" : "max-h-[520px]")}>
                  <div className="relative mx-auto min-w-[280px]" style={{ width: `${zoomLevel}%` }}>
                    <img
                      ref={imageRef}
                      src={activeItemImageUrl}
                      alt={activeItem.image_name}
                      className={cn("block h-auto w-full object-contain", isFormDisabled ? "cursor-default" : "cursor-crosshair")}
                      onClick={handleImageClick}
                      onLoad={() => {
                        const key = String(activeItem.id || "");
                        setImageLoadErrors((prev) => ({
                          ...prev,
                          [key]: false,
                        }));
                      }}
                      onError={() => {
                        const key = String(activeItem.id || "");
                        setImageLoadErrors((prev) => ({
                          ...prev,
                          [key]: true,
                        }));
                      }}
                    />

                    {imageLoadErrors[String(activeItem.id || "")] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          Gambar tidak dapat ditampilkan. Periksa URL gambar pada master data atau koneksi ke server backend.
                        </p>
                      </div>
                    )}

                    {activeItem.markers.map((marker, index) => {
                      const markerId = String(marker.id || "");
                      const selected = selectedMarkerId === markerId;
                      const markerNumber = toMarkerLabel(marker.label, index + 1);
                      return (
                        <button
                          key={markerId}
                          type="button"
                          className={cn(
                            "absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-rose-600 text-[10px] font-semibold text-white shadow",
                            selected && "ring-2 ring-rose-200",
                          )}
                          style={{ left: `${asPercent(marker.x)}%`, top: `${asPercent(marker.y)}%` }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMarkerId(markerId);
                          }}
                          title={marker.note || `Marker ${markerNumber}`}
                        >
                          {markerNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Daftar Marker
            </div>
            <div className="p-3 sm:p-4 space-y-2">
              <ScrollArea className="h-[340px]">
                {activeItem.markers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada marker pada gambar ini.</p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full table-fixed text-xs">
                      <colgroup>
                        <col className="w-[80px]" />
                        <col />
                        {!isFormDisabled && <col className="w-[56px]" />}
                      </colgroup>
                      <thead className="bg-muted/30">
                        <tr className="border-b">
                          <th className="px-2 py-2 text-left font-semibold">Marker</th>
                          <th className="px-2 py-2 text-left font-semibold">Catatan</th>
                          {!isFormDisabled && <th className="px-2 py-2 text-center font-semibold">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {activeItem.markers.map((marker, index) => {
                          const markerId = String(marker.id || "");
                          const selected = markerId === selectedMarkerId;
                          const markerNumber = toMarkerLabel(marker.label, index + 1);

                          return (
                            <tr
                              key={markerId}
                              className={cn("border-b last:border-0", selected ? "bg-primary/5" : "bg-background")}
                            >
                              <td className="px-2 py-2 align-top">
                                <button
                                  type="button"
                                  className="font-semibold"
                                  onClick={() => setSelectedMarkerId(markerId)}
                                >
                                  {markerNumber}
                                </button>
                              </td>
                              <td className="px-2 py-2 min-w-0">
                                <Input
                                  value={marker.note || ""}
                                  onChange={(event) => updateMarkerNote(markerId, event.target.value)}
                                  placeholder="Catatan marker (opsional)"
                                  disabled={isFormDisabled}
                                  className="h-9 w-full min-w-0 text-xs"
                                />
                              </td>
                              {!isFormDisabled && (
                                <td className="px-2 py-2 text-center align-top">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => removeMarker(markerId)}
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
                )}
              </ScrollArea>

              <Button type="button" onClick={handleSave} disabled={saving || isFormDisabled} className="w-full h-11">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Marker
              </Button>
            </div>
          </div>
        </div>
      ) : (
       ""
      )}
    </div>
  );
}
