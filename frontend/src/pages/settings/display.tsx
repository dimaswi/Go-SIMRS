import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import { parseDisplayAds, type DisplayAdItem } from "@/components/queue-display/display-media-panel";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Tv,
  Monitor,
  Building2,
  ClipboardList,
  Receipt,
  Film,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  ExternalLink,
  Volume2,
  VolumeX,
  BedDouble,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function DisplaySettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [counters, setCounters] = useState<Counter[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<number[]>([]);

  // Media Video, Ads & Running Text configuration
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
    setPageTitle("Pengaturan Display");
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
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
        const saved = localStorage.getItem("queueDisplay_selectedCounters");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedCounters(parsed);
              return;
            }
          } catch {
            // ignore invalid localStorage
          }
        }
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
        const saved = localStorage.getItem("queueDisplay_selectedRooms");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedRooms(parsed);
              return;
            }
          } catch {
            // ignore invalid localStorage
          }
        }
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
      prev.includes(counterId) ? prev.filter((id) => id !== counterId) : [...prev, counterId]
    );
  };

  const toggleAllRooms = () => {
    setSelectedRooms((prev) => (prev.length === rooms.length ? [] : rooms.map((r) => r.id)));
  };

  const toggleAllCounters = () => {
    setSelectedCounters((prev) => (prev.length === counters.length ? [] : counters.map((c) => c.id)));
  };

  const openMainDisplay = () => {
    localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify(selectedRooms));
    localStorage.setItem("queueDisplay_selectedCounters", JSON.stringify(selectedCounters));
    window.open("/queue-display/main", "_blank");
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
        toast({ title: "Video Diunggah", description: "Klik Simpan Media Display untuk menerapkan ke seluruh display." });
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
        toast({ title: "Gambar Iklan Diunggah", description: "Klik Simpan Media Display agar tampil di TV." });
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
      toast({
        title: "Tersimpan",
        description: "Pengaturan Video, Iklan & Teks Berjalan berhasil disimpan.",
      });
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

  const resolveMediaUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <PageShell>
      <PageHeader
        icon={Tv}
        title="Pengaturan Display Antrean"
        description="Kelola video, iklan banner, teks berjalan, pilihan unit display utama, dan pintasan layar antrean TV"
        onBack={() => navigate(-1)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-none text-xs"
              onClick={() => window.open("/queue-display/cashier", "_blank")}
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Display Kasir
              <ExternalLink className="ml-1.5 h-3 w-3 text-muted-foreground" />
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-none bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
              onClick={openMainDisplay}
              disabled={selectedRooms.length === 0 && selectedCounters.length === 0}
            >
              <Monitor className="mr-1.5 h-3.5 w-3.5" />
              Buka Display Utama
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        }
      />

      <PageContent className="max-w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Memuat pengaturan display...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section 1: Media Video, Iklan & Teks Berjalan */}
            <section className="space-y-4">
              <div className="border-b border-neutral-200 pb-2.5 dark:border-neutral-800">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  <Film className="h-4 w-4 text-neutral-500" />
                  Media Display (Video, Iklan &amp; Teks Berjalan)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Media yang disimpan akan tampil otomatis di seluruh layar panggilan TV (Loket, Ruangan/Poli, Kasir, dan Display Utama).
                </p>
              </div>

              <div className="space-y-5">
                {/* Video Slot */}
                <div className="space-y-2 border border-neutral-200 p-4 dark:border-neutral-800">
                  <Label htmlFor="display-video-url" className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Slot Video (YouTube URL / MP4 / Upload)
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="display-video-url"
                      className="rounded-none"
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
                      size="sm"
                      className="h-9 shrink-0 rounded-none text-xs"
                      onClick={() => videoFileRef.current?.click()}
                      disabled={uploadingVideo}
                    >
                      {uploadingVideo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Unggah Video MP4
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Kosongkan jika ingin menampilkan kartu info layanan klinik standar di panel media.
                  </p>
                </div>

                {/* Ads Carousel Slot */}
                <div className="space-y-3 border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
                      Slot Iklan / Banner Informasi ({displayAds.length} slide)
                    </Label>
                    <div>
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
                        className="h-8 rounded-none text-xs"
                        onClick={() => adFileRef.current?.click()}
                        disabled={uploadingAd}
                      >
                        {uploadingAd ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                        Unggah Gambar Iklan
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Input
                      className="rounded-none"
                      placeholder="Judul promo / informasi layanan (opsional)"
                      value={newAdTitle}
                      onChange={(e) => setNewAdTitle(e.target.value)}
                    />
                    <Input
                      className="rounded-none"
                      placeholder="Subjudul singkat (opsional)"
                      value={newAdSubtitle}
                      onChange={(e) => setNewAdSubtitle(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      className="rounded-none"
                      placeholder="Atau tempel URL gambar iklan..."
                      value={newAdUrl}
                      onChange={(e) => setNewAdUrl(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-none text-xs"
                      onClick={handleAddAdByUrl}
                      disabled={!newAdUrl.trim()}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Tambah URL Iklan
                    </Button>
                  </div>

                  {displayAds.length > 0 && (
                    <div className="grid gap-2 pt-1 md:grid-cols-2">
                      {displayAds.map((ad, idx) => (
                        <div
                          key={`${ad.url}-${idx}`}
                          className="flex items-center justify-between gap-3 border border-neutral-200 bg-neutral-50/60 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/40"
                        >
                          <img
                            src={resolveMediaUrl(ad.url)}
                            alt={ad.title || `Iklan ${idx + 1}`}
                            className="h-11 w-16 shrink-0 border border-neutral-200 bg-white object-cover dark:border-neutral-700"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                              {ad.title || `Banner Informasi #${idx + 1}`}
                            </div>
                            {ad.subtitle && (
                              <div className="truncate text-[11px] text-muted-foreground">{ad.subtitle}</div>
                            )}
                            <div className="truncate font-mono text-[10px] text-muted-foreground">{ad.url}</div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-none text-destructive hover:text-destructive"
                            onClick={() => setDisplayAds((prev) => prev.filter((_, i) => i !== idx))}
                            title="Hapus iklan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Running Text Slot */}
                <div className="space-y-2 border border-neutral-200 p-4 dark:border-neutral-800">
                  <Label htmlFor="display-running-text" className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Teks Berjalan (Running Text)
                  </Label>
                  <Textarea
                    id="display-running-text"
                    rows={2}
                    className="rounded-none"
                    placeholder="Selamat datang di Klinik Rawat Inap Utama Muhammadiyah Kedungadem..."
                    value={displayRunningText}
                    onChange={(e) => setDisplayRunningText(e.target.value)}
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveMediaSettings}
                    disabled={savingMedia}
                    className="h-8 rounded-none bg-neutral-900 px-4 text-xs font-semibold text-white shadow-none hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                  >
                    {savingMedia ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Simpan Media Display
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            {/* Section 2: Display Utama Filter (Rooms & Counters) */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5 dark:border-neutral-800">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    <Monitor className="h-4 w-4 text-neutral-500" />
                    Filter Unit Display Utama
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pilih ruangan poli dan loket pendaftaran yang ingin ditampilkan pada layar Display Utama (tanpa suara).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-mono uppercase">
                    <VolumeX className="h-3.5 w-3.5" />
                    Tanpa Suara ({selectedRooms.length} ruangan, {selectedCounters.length} loket)
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={openMainDisplay}
                    disabled={selectedRooms.length === 0 && selectedCounters.length === 0}
                    className="h-8 rounded-none bg-neutral-900 px-3 text-xs font-semibold text-white shadow-none hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                  >
                    Buka Display Utama
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Ruangan Poli */}
                <div className="flex flex-col border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5 text-neutral-500" />
                      Ruangan Poli
                      <span className="font-mono font-normal text-muted-foreground">
                        ({selectedRooms.length}/{rooms.length})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none px-2.5 text-[11px]"
                      onClick={toggleAllRooms}
                    >
                      {selectedRooms.length === rooms.length ? "Hapus Semua" : "Pilih Semua"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                    {rooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => toggleRoom(room.id)}
                          className={cn(
                            "flex min-h-[56px] items-start justify-between gap-2 border p-2.5 text-left transition-colors",
                            isSelected
                              ? "border-neutral-900 bg-neutral-100/80 text-neutral-900 dark:border-neutral-200 dark:bg-neutral-800/80 dark:text-white"
                              : "border-neutral-200 bg-white text-muted-foreground hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                          )}
                        >
                          <span className="line-clamp-2 text-xs font-semibold leading-snug">{room.name}</span>
                          {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-900 dark:text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Loket Pendaftaran */}
                <div className="flex flex-col border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                      Loket Pendaftaran
                      <span className="font-mono font-normal text-muted-foreground">
                        ({selectedCounters.length}/{counters.length})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none px-2.5 text-[11px]"
                      onClick={toggleAllCounters}
                    >
                      {selectedCounters.length === counters.length ? "Hapus Semua" : "Pilih Semua"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                    {counters.map((counter) => {
                      const isSelected = selectedCounters.includes(counter.id);
                      return (
                        <button
                          key={counter.id}
                          type="button"
                          onClick={() => toggleCounter(counter.id)}
                          className={cn(
                            "flex min-h-[56px] items-start justify-between gap-2 border p-2.5 text-left transition-colors",
                            isSelected
                              ? "border-neutral-900 bg-neutral-100/80 text-neutral-900 dark:border-neutral-200 dark:bg-neutral-800/80 dark:text-white"
                              : "border-neutral-200 bg-white text-muted-foreground hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">{counter.name}</div>
                            {counter.location && (
                              <div className="truncate text-[10px] text-muted-foreground">{counter.location}</div>
                            )}
                          </div>
                          {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-900 dark:text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Section 3: Pintasan Display Per Unit (Dengan Suara) */}
            <section className="space-y-4">
              <div className="border-b border-neutral-200 pb-2.5 dark:border-neutral-800">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  <Volume2 className="h-4 w-4 text-neutral-500" />
                  Pintasan Layar Display TV (Dengan Suara Panggilan)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Buka layar antrean individual di tab baru untuk monitor ruang tunggu poli, loket pendaftaran, atau kasir.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Display Ruangan */}
                <div className="flex flex-col border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5 text-neutral-500" />
                      Display Ruangan
                    </span>
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {rooms.map((room) => (
                      <Button
                        key={room.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-none px-2.5 text-xs"
                        onClick={() => window.open(`/room-queue/display/${room.id}`, "_blank")}
                      >
                        {room.name}
                        <ExternalLink className="ml-1.5 h-2.5 w-2.5 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Display Loket */}
                <div className="flex flex-col border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                      Display Loket
                    </span>
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {counters.map((counter) => (
                      <Button
                        key={counter.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-none px-2.5 text-xs"
                        onClick={() => window.open(`/queue-display/counter/${counter.id}`, "_blank")}
                      >
                        {counter.name}
                        <ExternalLink className="ml-1.5 h-2.5 w-2.5 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Display Kasir */}
                <div className="flex flex-col justify-between border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Receipt className="h-3.5 w-3.5 text-neutral-500" />
                      Display Kasir
                    </span>
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Layar panggilan pembayaran pasien dengan nomor antrean pendaftaran terpadu, pengumuman suara, video, dan iklan.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-full rounded-none bg-neutral-900 text-xs font-semibold text-white shadow-none hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                      onClick={() => window.open("/queue-display/cashier", "_blank")}
                    >
                      Buka Display Kasir
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Display Bed */}
                <div className="flex flex-col justify-between border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <BedDouble className="h-3.5 w-3.5 text-neutral-500" />
                      Display Bed Publik
                    </span>
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Layar informasi ketersediaan tempat tidur per ruangan dan kamar secara real-time untuk publik.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-full rounded-none bg-neutral-900 text-xs font-semibold text-white shadow-none hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                      onClick={() => window.open("/display/bed-monitoring", "_blank")}
                    >
                      Buka Display Bed
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
