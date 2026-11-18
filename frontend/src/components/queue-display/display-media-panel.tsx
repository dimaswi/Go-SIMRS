import { useEffect, useMemo, useState } from "react";
import { Film, Sparkles, MonitorPlay, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisplayAdItem {
  url: string;
  title?: string;
  subtitle?: string;
}

const INDONESIAN_SPEECH_MAP: Record<string, string> = {
  A: "a",
  B: "be",
  C: "ce",
  D: "de",
  E: "e",
  F: "ef",
  G: "ge",
  H: "ha",
  I: "i",
  J: "je",
  K: "ka",
  L: "el",
  M: "em",
  N: "en",
  O: "o",
  P: "pe",
  Q: "kiu",
  R: "er",
  S: "es",
  T: "te",
  U: "u",
  V: "ve",
  W: "we",
  X: "eks",
  Y: "ye",
  Z: "zet",
  "0": "nol",
  "1": "satu",
  "2": "dua",
  "3": "tiga",
  "4": "empat",
  "5": "lima",
  "6": "enam",
  "7": "tujuh",
  "8": "delapan",
  "9": "sembilan",
};

export function spellQueueNumberForSpeech(value: string): string {
  return value
    .trim()
    .split("")
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || "")
    .filter(Boolean)
    .join(" ");
}

export function resolveDisplayMediaUrl(url: string, baseUrl: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `${baseUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function parseYouTubeEmbedUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    let videoId = "";

    if (host === "youtu.be") {
      videoId = u.pathname.replace(/^\//, "").split("/")[0];
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        videoId = u.searchParams.get("v") || "";
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/embed/")[1]?.split("/")[0] || "";
      } else if (u.pathname.startsWith("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      }
    }

    if (!videoId) return null;
    const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cleanId) return null;
    return `https://www.youtube.com/embed/${cleanId}?autoplay=1&mute=1&loop=1&playlist=${cleanId}&controls=0&modestbranding=1&rel=0`;
  } catch {
    return null;
  }
}

export function parseDisplayAds(raw?: string): DisplayAdItem[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return { url: item.trim() };
          }
          if (item && typeof item === "object" && typeof item.url === "string") {
            return {
              url: item.url.trim(),
              title: typeof item.title === "string" ? item.title : undefined,
              subtitle: typeof item.subtitle === "string" ? item.subtitle : undefined,
            };
          }
          return null;
        })
        .filter((item): item is DisplayAdItem => Boolean(item && item.url));
    }
  } catch {
    // Fallback to newline or comma separated URLs
    return trimmed
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
  }

  return [];
}

const DEFAULT_CLINIC_SLIDES = [
  {
    badge: "1 TIKET TERPADU",
    title: "Satu Nomor Antrean Untuk Semua Layanan",
    subtitle: "Gunakan nomor tiket pendaftaran Anda untuk layanan Poliklinik, Laboratorium, Radiologi, Farmasi, hingga Kasir.",
    accent: "from-emerald-50 via-white to-teal-50",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    badge: "CHECK-IN MANDIRI",
    title: "Peserta BPJS & Surat Kontrol Lebih Cepat",
    subtitle: "Pindai QR Code Mobile JKN atau Surat Kontrol langsung di Anjungan Check-In Mandiri sebelum menuju ruangan.",
    accent: "from-sky-50 via-white to-cyan-50",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    badge: "KENYAMANAN PASIEN",
    title: "Tetap Menunggu di Ruang Tunggu yang Nyaman",
    subtitle: "Pantau nomor antrean Anda pada layar dan dengarkan pengumuman suara sebelum menuju loket, poli, atau kasir.",
    accent: "from-indigo-50 via-white to-blue-50",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
];

interface DisplayMediaPanelProps {
  videoUrl?: string;
  adsRaw?: string;
  hospitalName: string;
  hospitalSubtitle?: string;
  appLogo?: string;
  baseUrl: string;
  compact?: boolean;
  className?: string;
}

export function DisplayMediaPanel({
  videoUrl,
  adsRaw,
  hospitalName,
  hospitalSubtitle,
  appLogo,
  baseUrl,
  compact = false,
  className,
}: DisplayMediaPanelProps) {
  const ads = useMemo(() => parseDisplayAds(adsRaw), [adsRaw]);
  const slideCount = ads.length > 0 ? ads.length : DEFAULT_CLINIC_SLIDES.length;
  const [adIndex, setAdIndex] = useState(0);

  useEffect(() => {
    setAdIndex(0);
  }, [slideCount]);

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = window.setInterval(() => {
      setAdIndex((prev) => (prev + 1) % slideCount);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slideCount]);

  const youtubeEmbed = useMemo(() => parseYouTubeEmbedUrl(videoUrl || ""), [videoUrl]);
  const directVideoUrl = useMemo(() => {
    if (!videoUrl || youtubeEmbed) return "";
    return resolveDisplayMediaUrl(videoUrl, baseUrl);
  }, [videoUrl, youtubeEmbed, baseUrl]);

  const currentAd = ads.length > 0 ? ads[adIndex % ads.length] : null;
  const currentDefaultSlide = DEFAULT_CLINIC_SLIDES[adIndex % DEFAULT_CLINIC_SLIDES.length];

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* Slot Video */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3.5 py-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            <Film className="h-3.5 w-3.5 text-sky-600" />
            <span>Tayangan Video</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {youtubeEmbed || directVideoUrl ? "Aktif" : "Info Klinik"}
          </span>
        </div>

        <div className={cn("relative w-full overflow-hidden bg-slate-100", compact ? "aspect-video" : "aspect-video")}>
          {youtubeEmbed ? (
            <iframe
              src={youtubeEmbed}
              title="Video Layanan Klinik"
              allow="autoplay; encrypted-media"
              className="h-full w-full border-0 pointer-events-none"
            />
          ) : directVideoUrl ? (
            <video
              key={directVideoUrl}
              src={directVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 text-center">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
              <div className="relative flex flex-col items-center gap-2.5">
                {appLogo ? (
                  <img
                    src={resolveDisplayMediaUrl(appLogo, baseUrl)}
                    alt="Logo"
                    className="h-12 w-12 object-contain drop-shadow-sm"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200 bg-sky-50">
                    <MonitorPlay className="h-6 w-6 text-sky-600" />
                  </div>
                )}
                <div className="text-base font-bold tracking-tight text-slate-900">{hospitalName}</div>
                {hospitalSubtitle && (
                  <div className="max-w-xs text-xs text-slate-600 line-clamp-2">{hospitalSubtitle}</div>
                )}
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Slot Video Edukasi &amp; Profil Klinik
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slot Iklan / Banner Promosi */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3.5 py-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Iklan &amp; Informasi</span>
          </div>
          {slideCount > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: slideCount }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAdIndex(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    idx === adIndex ? "w-5 bg-amber-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative flex min-h-[150px] flex-1 overflow-hidden bg-slate-50">
          {currentAd ? (
            <div className="relative h-full w-full">
              <img
                key={currentAd.url}
                src={resolveDisplayMediaUrl(currentAd.url, baseUrl)}
                alt={currentAd.title || "Informasi Layanan"}
                className="h-full w-full object-cover"
              />
              {(currentAd.title || currentAd.subtitle) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/85 via-slate-900/55 to-transparent px-4 py-3">
                  {currentAd.title && (
                    <div className="text-sm font-bold text-white">{currentAd.title}</div>
                  )}
                  {currentAd.subtitle && (
                    <div className="mt-0.5 text-xs text-slate-100 line-clamp-2">{currentAd.subtitle}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex h-full w-full flex-col justify-between bg-gradient-to-br p-4 transition-all duration-500",
                currentDefaultSlide.accent
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]",
                    currentDefaultSlide.badgeClass
                  )}
                >
                  {currentDefaultSlide.badge}
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {adIndex + 1}/{slideCount}
                </span>
              </div>
              <div className="my-auto py-2">
                <div className="text-base font-bold leading-snug text-slate-900">
                  {currentDefaultSlide.title}
                </div>
                <div className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {currentDefaultSlide.subtitle}
                </div>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">
                {hospitalName}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DisplayRunningTextTicker({
  text,
  hospitalName,
}: {
  text?: string;
  hospitalName: string;
}) {
  const message =
    (text || "").trim() ||
    `Selamat datang di ${hospitalName} • Gunakan 1 nomor antrean terpadu untuk layanan Pendaftaran, Poliklinik, Laboratorium, Radiologi, Farmasi, hingga Kasir • Mohon perhatikan panggilan suara & nomor antrean di layar.`;

  return (
    <div className="relative flex h-10 shrink-0 items-center overflow-hidden border-t border-slate-200 bg-white text-slate-700">
      <style>{`
        @keyframes simrsDisplayTicker {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .simrs-ticker-track {
          display: flex;
          width: max-content;
          animation: simrsDisplayTicker 36s linear infinite;
        }
      `}</style>
      <div className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-emerald-700 bg-emerald-600 px-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
        <Megaphone className="h-3.5 w-3.5" />
        <span>Info</span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="simrs-ticker-track whitespace-nowrap text-sm font-medium tracking-wide text-slate-800">
          <span className="px-8">{message}</span>
          <span className="px-8">{message}</span>
        </div>
      </div>
    </div>
  );
}
