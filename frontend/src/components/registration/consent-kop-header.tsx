import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

interface HospitalKopSettings {
  appLogo: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalCity: string;
  hospitalPhone: string;
  hospitalFax: string;
  hospitalEmail: string;
  hospitalWebsite: string;
}

let cachedKopPromise: Promise<HospitalKopSettings> | null = null;

function fetchHospitalKop(): Promise<HospitalKopSettings> {
  if (!cachedKopPromise) {
    cachedKopPromise = settingsApi
      .getAll()
      .then((res) => {
        const s = res.data?.data || {};
        return {
          appLogo: s.app_logo || "",
          hospitalName: s.hospital_name || s.app_name || "KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM",
          hospitalAddress: s.hospital_address || "",
          hospitalCity: s.hospital_city || "",
          hospitalPhone: s.hospital_phone || "",
          hospitalFax: s.hospital_fax || "",
          hospitalEmail: s.hospital_email || "",
          hospitalWebsite: s.hospital_website || "",
        };
      })
      .catch(() => {
        cachedKopPromise = null;
        return {
          appLogo: "",
          hospitalName: "KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM",
          hospitalAddress: "",
          hospitalCity: "",
          hospitalPhone: "",
          hospitalFax: "",
          hospitalEmail: "",
          hospitalWebsite: "",
        };
      });
  }
  return cachedKopPromise;
}

interface ConsentKopHeaderProps {
  title: string;
  documentCode?: string;
}

/**
 * Reusable kop surat header matching the Settings print preview (logo, facility info, double rule, document title).
 */
export function ConsentKopHeader({ title, documentCode }: ConsentKopHeaderProps) {
  const [kop, setKop] = useState<HospitalKopSettings>({
    appLogo: "",
    hospitalName: "KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM",
    hospitalAddress: "",
    hospitalCity: "",
    hospitalPhone: "",
    hospitalFax: "",
    hospitalEmail: "",
    hospitalWebsite: "",
  });

  useEffect(() => {
    let mounted = true;
    void fetchHospitalKop().then((data) => {
      if (mounted) setKop(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const contactLine = [
    kop.hospitalPhone && `Telp: ${kop.hospitalPhone}`,
    kop.hospitalFax && `Fax: ${kop.hospitalFax}`,
    kop.hospitalEmail,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        {kop.appLogo && (
          <div className="h-16 w-16 shrink-0">
            <img
              src={`${BASE_URL}${kop.appLogo}`}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <div className="flex-1 text-center">
          <div className="text-base sm:text-lg font-bold uppercase tracking-wide text-black dark:text-white leading-tight">
            {kop.hospitalName}
          </div>
          {(kop.hospitalAddress || kop.hospitalCity) && (
            <div className="mt-0.5 text-xs text-neutral-700 dark:text-neutral-300">
              {kop.hospitalAddress}
              {kop.hospitalAddress && kop.hospitalCity ? `, ${kop.hospitalCity}` : kop.hospitalCity}
            </div>
          )}
          {contactLine && (
            <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
              {contactLine}
            </div>
          )}
          {kop.hospitalWebsite && (
            <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
              {kop.hospitalWebsite}
            </div>
          )}
        </div>
        {kop.appLogo && <div className="h-16 w-16 shrink-0 hidden sm:block" />}
      </div>

      <div className="mt-3 border-t-2 border-double border-black dark:border-neutral-300" />

      <div className="mt-4 text-center">
        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-neutral-900 dark:text-white underline underline-offset-4 leading-snug">
          {title}
        </h3>
        {documentCode && (
          <div className="mt-1 font-mono text-[11px] text-neutral-500">
            No. Formulir: {documentCode}
          </div>
        )}
      </div>
    </div>
  );
}
