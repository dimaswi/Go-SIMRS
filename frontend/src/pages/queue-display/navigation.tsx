import { useEffect, useState, useRef } from "react";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import { parseDisplayAds, type DisplayAdItem } from "@/components/queue-display/display-media-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor,
  ArrowRight,
  Loader2,
  Volume2,
  VolumeX,
  Building2,
  ClipboardList,
  Check,
  Receipt,
  Film,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function QueueDisplayNavigation() {
  const { toast } = useToast();
  const [counters, setCounters] = useState<Counter[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState("RUMAH SAKIT");
  const [appSubtitle, setAppSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<number[]>([]);

  // Media Video & Ads configuration modal
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [displayVideoUrl, setDisplayVideoUrl] = useState("");
  const [displayAds, setDisplayAds] = useState<DisplayAdItem[]>([]);
  const [displayRunningText, setDisplayRunningText] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAd, setUploadingAd] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [newAdUrl, setNewAdUrl] = useState("");
  const [newAdTitle, setNewAdTitle] = useState("");
  const [newAdSubtitle, setNewAdSubtitle] = useState("");
  const videoFileRef = useRef<HTMLInputElement>(null);
  const adFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_subtitle) setAppSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
        if (settings.display_video_url) setDisplayVideoUrl(settings.display_video_url);
        if (settings.display_ads) setDisplayAds(parseDisplayAds(settings.display_ads));
        if (settings.display_running_text) setDisplayRunningText(settings.display_running_text);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
        setSelectedCounters(data.map((c) => c.id));
      } catch (error) {
        console.error("Failed to load counters:", error);
      }
    };

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({ is_active: "true", limit: 100 });
        const roomsData = response.data.data || [];
        setRooms(roomsData);
        setSelectedRooms(roomsData.map((r: Room) => r.id));
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };

    void loadSettings();
    Promise.all([loadCounters(), loadRooms()]).finally(() => setLoading(false));
  }, []);

  const toggleRoom = (roomId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const toggleCounter = (counterId: number) => {
    setSelectedCounters((prev) =>
      prev.includes(counterId)
        ? prev.filter((id) => id !== counterId)
        : [...prev, counterId]
    );
  };

  const toggleAllRooms = () => {
    setSelectedRooms((prev) => (prev.length === rooms.length ? [] : rooms.map((r) => r.id)));
  };

  const toggleAllCounters = () => {
    setSelectedCounters((prev) =>
      prev.length === counters.length ? [] : counters.map((c) => c.id)
    );
  };

  const openMainDisplay = () => {
    localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify(selectedRooms));
    localStorage.setItem(
      "queueDisplay_selectedCounters",
      JSON.stringify(selectedCounters)
    );
    window.open("/queue-display/main", "_blank");
  };

  const openCounterDisplay = (counterId: number) => {
    window.open(`/queue-display/counter/${counterId}`, "_blank");
  };

  const openCashierDisplay = () => {
    window.open("/queue-display/cashier", "_blank");
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const res = await settingsApi.uploadLogo(file, "display_video");
      const url = res.data?.url || "";
      if (url) {
        setDisplayVideoUrl(url);
        toast({ title: "Video Diunggah", description: "Video berhasil diunggah dan tersimpan." });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Unggah Video",
        description: error?.response?.data?.error || "Pastikan format MP4, WebM, atau MOV.",
      });
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const handleUploadAdImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAd(true);
    try {
      const res = await settingsApi.uploadLogo(file, "display_ad");
      const url = res.data?.url || "";
      if (url) {
        setDisplayAds((prev) => [
          ...prev,
          {
            url,
            title: newAdTitle.trim() || undefined,
            subtitle: newAdSubtitle.trim() || undefined,
          },
        ]);
        setNewAdTitle("");
        setNewAdSubtitle("");
        toast({ title: "Gambar Iklan Diunggah", description: "Klik Simpan Media agar tampil di Display." });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Unggah Iklan",
        description: error?.response?.data?.error || "Pastikan format PNG, JPG, JPEG, WebP, atau GIF.",
      });
    } finally {
      setUploadingAd(false);
      e.target.value = "";
    }
  };

  const handleAddAdByUrl = () => {
    if (!newAdUrl.trim()) return;
    setDisplayAds((prev) => [
      ...prev,
      {
        url: newAdUrl.trim(),
        title: newAdTitle.trim() || undefined,
        subtitle: newAdSubtitle.trim() || undefined,
      },
    ]);
    setNewAdUrl("");
    setNewAdTitle("");
    setNewAdSubtitle("");
  };

  const handleSaveMediaSettings = async () => {
    setSavingMedia(true);
    try {
      await settingsApi.update({
        display_video_url: displayVideoUrl.trim(),
        display_ads: JSON.stringify(displayAds),
        display_running_text: displayRunningText.trim(),
      });
      toast({ title: "Tersimpan", description: "Pengaturan Video, Iklan & Teks Berjalan berhasil disimpan." });
      setMediaDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error?.response?.data?.error || "Pastikan Anda memiliki izin update pengaturan.",
      });
    } finally {
      setSavingMedia(false);
    }
  };

  const allRoomsSelected = rooms.length > 0 && selectedRooms.length === rooms.length;
  const someRoomsSelected = selectedRooms.length > 0 && selectedRooms.length < rooms.length;
  const allCountersSelected = counters.length > 0 && selectedCounters.length === counters.length;
  const someCountersSelected =
    selectedCounters.length > 0 && selectedCounters.length < counters.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 select-none">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          {appLogo && (
            <img
              src={`${BASE_URL}${appLogo}`}
              alt="Logo"
              className="h-12 w-12 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-2xl font-bold text-slate-900">{appName}</div>
            {appSubtitle && (
              <div className="truncate text-sm text-slate-500">{appSubtitle}</div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-slate-900">
            {currentTime.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700">
        <span>Pengaturan Display Antrean</span>
        <button
          type="button"
          onClick={() => setMediaDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 hover:bg-sky-100"
        >
          <Film className="h-3.5 w-3.5" />
          Atur Video &amp; Iklan Display
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <span className="text-slate-500">Memuat data...</span>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
              <div className="flex w-1/2 min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-sky-600" />
                    <span className="text-lg font-bold text-slate-900">Ruangan Poli</span>
                    <span className="text-xs text-slate-500">
                      {selectedRooms.length}/{rooms.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllRooms}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      allRoomsSelected || someRoomsSelected
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-300 text-slate-600"
                    )}
                  >
                    Pilih Semua
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {rooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      return (
                        <button
                          key={room.id}
                          onClick={() => toggleRoom(room.id)}
                          className={cn(
                            "flex min-h-[92px] flex-col justify-between rounded-lg border p-3 text-left transition-colors",
                            isSelected
                              ? "border-sky-500 bg-sky-50/70"
                              : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-bold text-slate-900 line-clamp-2">
                              {room.name}
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex w-1/2 min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-emerald-600" />
                    <span className="text-lg font-bold text-slate-900">Loket Pendaftaran</span>
                    <span className="text-xs text-slate-500">
                      {selectedCounters.length}/{counters.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllCounters}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      allCountersSelected || someCountersSelected
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 text-slate-600"
                    )}
                  >
                    Pilih Semua
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {counters.map((counter) => {
                      const isSelected = selectedCounters.includes(counter.id);
                      return (
                        <button
                          key={counter.id}
                          onClick={() => toggleCounter(counter.id)}
                          className={cn(
                            "flex min-h-[92px] flex-col justify-between rounded-lg border p-3 text-left transition-colors",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/70"
                              : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-bold text-slate-900">{counter.code}</div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                          </div>
                          <div className="text-xs text-slate-600 line-clamp-2">
                            {counter.name}
                            {counter.location ? ` - ${counter.location}` : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div>
                  <div className="text-lg font-bold text-slate-900">Display Utama</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {selectedRooms.length} ruangan, {selectedCounters.length} loket
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <span className="hidden sm:inline-flex items-center gap-2">
                    <VolumeX className="h-4 w-4" />
                    Tanpa Suara
                  </span>
                  <button
                    onClick={openMainDisplay}
                    disabled={selectedRooms.length === 0 && selectedCounters.length === 0}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold",
                      selectedRooms.length === 0 && selectedCounters.length === 0
                        ? "cursor-not-allowed border-slate-200 text-slate-400"
                        : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    Buka Display
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-sky-600" />
                      <span className="font-bold text-sm text-slate-900">Display Ruangan</span>
                    </div>
                    <Volume2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="max-h-28 overflow-auto p-3">
                    <div className="flex flex-wrap gap-2">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => window.open(`/room-queue/display/${room.id}`, "_blank")}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-300"
                        >
                          {room.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Monitor className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-sm text-slate-900">Display Loket</span>
                    </div>
                    <Volume2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="max-h-28 overflow-auto p-3">
                    <div className="flex flex-wrap gap-2">
                      {counters.map((counter) => (
                        <button
                          key={counter.id}
                          onClick={() => openCounterDisplay(counter.id)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300"
                        >
                          {counter.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Receipt className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-sm text-slate-900">Display Kasir</span>
                    </div>
                    <Volume2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-3 p-3">
                    <p className="text-xs text-slate-500">
                      Layar panggilan pembayaran pasien dengan nomor antrean pendaftaran terpadu &amp; suara.
                    </p>
                    <button
                      type="button"
                      onClick={openCashierDisplay}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Buka Display Kasir
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Media Video & Iklan Settings Dialog */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-cyan-600" />
              Pengaturan Video, Iklan &amp; Teks Berjalan Display
            </DialogTitle>
            <DialogDescription>
              Media yang disimpan di sini akan tampil otomatis di seluruh layar panggilan (Loket, Poli/Ruangan, Kasir, dan Display Utama).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Video Section */}
            <div className="space-y-2 rounded-lg border p-3.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Slot Video (YouTube URL / MP4 / Upload)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.youtube.com/watch?v=... atau /uploads/video.mp4"
                  value={displayVideoUrl}
                  onChange={(e) => setDisplayVideoUrl(e.target.value)}
                />
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleUploadVideo}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => videoFileRef.current?.click()}
                  disabled={uploadingVideo}
                >
                  {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="ml-1.5">Unggah MP4</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Kosongkan jika ingin menampilkan kartu info profil klinik standar.
              </p>
            </div>

            {/* Ads Carousel Section */}
            <div className="space-y-3 rounded-lg border p-3.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Slot Iklan / Banner Informasi ({displayAds.length} slide)
                </Label>
                <input
                  ref={adFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleUploadAdImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adFileRef.current?.click()}
                  disabled={uploadingAd}
                >
                  {uploadingAd ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  Unggah Gambar Iklan
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Judul promo / layanan (opsional)"
                  value={newAdTitle}
                  onChange={(e) => setNewAdTitle(e.target.value)}
                />
                <Input
                  placeholder="Subjudul singkat (opsional)"
                  value={newAdSubtitle}
                  onChange={(e) => setNewAdSubtitle(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Atau tempel URL gambar iklan..."
                  value={newAdUrl}
                  onChange={(e) => setNewAdUrl(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={handleAddAdByUrl} disabled={!newAdUrl.trim()}>
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah URL
                </Button>
              </div>

              {displayAds.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                  {displayAds.map((ad, idx) => (
                    <div key={`${ad.url}-${idx}`} className="flex items-center justify-between gap-2 rounded border bg-muted/40 px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{ad.title || ad.url}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{ad.url}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDisplayAds((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Running Text Section */}
            <div className="space-y-2 rounded-lg border p-3.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Teks Berjalan (Running Text)</Label>
              <Textarea
                rows={2}
                placeholder="Selamat datang di klinik kami..."
                value={displayRunningText}
                onChange={(e) => setDisplayRunningText(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMediaDialogOpen(false)}>
                Tutup
              </Button>
              <Button type="button" onClick={handleSaveMediaSettings} disabled={savingMedia}>
                {savingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Media Display
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
