import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

/**
 * Convert image URL to base64
 */
async function loadImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback: try with Image element
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = url;
    });
  }
}

export interface HospitalInfo {
  hospital_name: string;
  hospital_type: string;
  hospital_address: string;
  hospital_city: string;
  hospital_phone: string;
  hospital_fax: string;
  hospital_email: string;
  hospital_website: string;
  app_logo: string;
  app_logo_base64?: string; // Preloaded base64 logo
}

/**
 * Hook to load hospital settings for print headers.
 * Can be used by any print component.
 * Preloads logo as base64 for PDF generation.
 */
export function useHospitalInfo() {
  const [info, setInfo] = useState<HospitalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const res = await settingsApi.getAll();
        const s = res.data.data;
        const BASE_URL = getBaseUrl();
        
        const hospitalInfo: HospitalInfo = {
          hospital_name: s.hospital_name || "",
          hospital_type: s.hospital_type || "",
          hospital_address: s.hospital_address || "",
          hospital_city: s.hospital_city || "",
          hospital_phone: s.hospital_phone || "",
          hospital_fax: s.hospital_fax || "",
          hospital_email: s.hospital_email || "",
          hospital_website: s.hospital_website || "",
          app_logo: s.app_logo || "",
        };
        
        // Preload logo as base64
        if (hospitalInfo.app_logo) {
          const logoUrl = hospitalInfo.app_logo.startsWith("http") 
            ? hospitalInfo.app_logo 
            : `${BASE_URL}${hospitalInfo.app_logo}`;
          hospitalInfo.app_logo_base64 = await loadImageAsBase64(logoUrl);
        }
        
        setInfo(hospitalInfo);
      } catch {
        setInfo(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadInfo();
  }, []);

  return { info, loading };
}

interface PrintHeaderProps {
  /** Override hospital info (skip API call) */
  hospitalInfo?: HospitalInfo;
  /** Document title shown below the header line */
  title?: string;
  /** Document subtitle / number */
  subtitle?: string;
  /** Size variant */
  size?: "normal" | "compact";
}

/**
 * Reusable print header (kop surat) component.
 * Designed for @media print. Uses inline styles for print compatibility.
 */
export function PrintHeader({ hospitalInfo, title, subtitle, size = "normal" }: PrintHeaderProps) {
  const { info: loadedInfo } = useHospitalInfo();
  const info = hospitalInfo || loadedInfo;

  if (!info) return null;

  const BASE_URL = getBaseUrl();
  const isCompact = size === "compact";

  const contactParts = [
    info.hospital_phone ? `Telp: ${info.hospital_phone}` : "",
    info.hospital_fax ? `Fax: ${info.hospital_fax}` : "",
    info.hospital_email || "",
  ].filter(Boolean);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", marginBottom: isCompact ? 8 : 16 }}>
      {/* Kop Surat */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Logo */}
        {info.app_logo && (
          <div style={{ width: isCompact ? 48 : 64, height: isCompact ? 48 : 64, flexShrink: 0 }}>
            <img
              src={info.app_logo.startsWith("http") ? info.app_logo : `${BASE_URL}${info.app_logo}`}
              alt="Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        )}

        {/* Center text */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: isCompact ? 14 : 18,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {info.hospital_name}
          </div>
          <div style={{ fontSize: isCompact ? 9 : 10, color: "#444", marginTop: 2 }}>
            {info.hospital_address}
            {info.hospital_city ? `, ${info.hospital_city}` : ""}
          </div>
          {contactParts.length > 0 && (
            <div style={{ fontSize: isCompact ? 8 : 9, color: "#555" }}>
              {contactParts.join("  |  ")}
            </div>
          )}
          {info.hospital_website && (
            <div style={{ fontSize: isCompact ? 8 : 9, color: "#555" }}>{info.hospital_website}</div>
          )}
        </div>

        {/* Spacer for balance */}
        {info.app_logo && <div style={{ width: isCompact ? 48 : 64, flexShrink: 0 }} />}
      </div>

      {/* Double line */}
      <div
        style={{
          marginTop: isCompact ? 4 : 8,
          borderTop: "3px double #000",
        }}
      />

      {/* Document title */}
      {title && (
        <div style={{ textAlign: "center", marginTop: isCompact ? 8 : 12 }}>
          <div
            style={{
              fontSize: isCompact ? 13 : 15,
              fontWeight: "bold",
              textTransform: "uppercase",
              textDecoration: "underline",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: isCompact ? 10 : 11, color: "#444", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Generate HTML string for print header (for window.open print flows).
 * Use this when printing via a new window/popup instead of React rendering.
 * Uses preloaded base64 logo for PDF generation.
 */
export function generatePrintHeaderHTML(info: HospitalInfo, title?: string, subtitle?: string): string {
  // Use base64 logo if available (preloaded), otherwise fallback to URL
  const BASE_URL = getBaseUrl();
  const logoSrc = info.app_logo_base64 
    ? info.app_logo_base64
    : info.app_logo
      ? info.app_logo.startsWith("http")
        ? info.app_logo
        : `${BASE_URL}${info.app_logo}`
      : "";

  const contactParts = [
    info.hospital_phone ? `Telp: ${info.hospital_phone}` : "",
    info.hospital_fax ? `Fax: ${info.hospital_fax}` : "",
    info.hospital_email || "",
  ].filter(Boolean);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${logoSrc ? `<div style="width: 64px; height: 64px; flex-shrink: 0;"><img src="${logoSrc}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" /></div>` : ""}
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${info.hospital_name}</div>
          <div style="font-size: 10px; color: #444; margin-top: 2px;">${info.hospital_address}${info.hospital_city ? `, ${info.hospital_city}` : ""}</div>
          ${contactParts.length > 0 ? `<div style="font-size: 9px; color: #555;">${contactParts.join("  |  ")}</div>` : ""}
          ${info.hospital_website ? `<div style="font-size: 9px; color: #555;">${info.hospital_website}</div>` : ""}
        </div>
        ${logoSrc ? `<div style="width: 64px; flex-shrink: 0;"></div>` : ""}
      </div>
      <div style="margin-top: 8px; border-top: 3px double #000;"></div>
      ${title ? `
        <div style="text-align: center; margin-top: 12px;">
          <div style="font-size: 15px; font-weight: bold; text-transform: uppercase; text-decoration: underline;">${title}</div>
          ${subtitle ? `<div style="font-size: 11px; color: #444; margin-top: 2px;">${subtitle}</div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Full print page CSS for @media print.
 * Include in <style> tag for print pages.
 */
export const PRINT_STYLES = `
  @media print {
    body { margin: 0; padding: 0; }
    @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
  }
  @media screen {
    .print-page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #000;
  }
  table.print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.print-table th,
  table.print-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }
  table.print-table th {
    background: #f0f0f0;
    font-weight: bold;
  }
  table.info-table {
    width: 100%;
    font-size: 11px;
  }
  table.info-table td {
    padding: 2px 0;
    vertical-align: top;
  }
  table.info-table td:first-child {
    width: 35%;
    color: #555;
  }
  .signature-area {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    page-break-inside: avoid;
  }
  .signature-box {
    text-align: center;
    width: 200px;
  }
  .signature-line {
    border-bottom: 1px solid #000;
    margin-top: 60px;
    margin-bottom: 4px;
  }
`;
