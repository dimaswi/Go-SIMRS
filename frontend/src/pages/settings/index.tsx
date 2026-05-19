import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import {
  Building2,
  Save,
  Loader2,
  Upload,
  Image,
  FileImage,
  Hospital,
  ShieldCheck,
  FileEdit,
  ExternalLink,
  QrCode,
  ArrowLeft
} from "lucide-react";
import { settingsApi } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";

// Get base URL without /api suffix
const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};
const BASE_URL = getBaseUrl();

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [appName, setAppName] = useState("SIMRS");
  const [appSubtitle, setAppSubtitle] = useState("Hospital System");
  const [appLogo, setAppLogo] = useState("");
  const [appFavicon, setAppFavicon] = useState("");
  const [bpjsLogo, setBpjsLogo] = useState("");

  // Hospital info for print header (kop surat)
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [hospitalPhone, setHospitalPhone] = useState("");
  const [hospitalFax, setHospitalFax] = useState("");
  const [hospitalEmail, setHospitalEmail] = useState("");
  const [hospitalWebsite, setHospitalWebsite] = useState("");
  const [savingHospital, setSavingHospital] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingBpjsLogo, setUploadingBpjsLogo] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Digital Signature settings
  const [signaturePinRequired, setSignaturePinRequired] = useState(true);
  const [savingSignature, setSavingSignature] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const bpjsLogoInputRef = useRef<HTMLInputElement>(null);

  // Set page title
  useEffect(() => {
    const savedAppName = localStorage.getItem("appName") || "StarterKits";
    document.title = `Settings - ${savedAppName}`;
  }, []);

  // Load settings from API and localStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.getAll();
      const settings = response.data.data;

      if (settings.app_name) {
        setAppName(settings.app_name);
        localStorage.setItem("appName", settings.app_name);
      }
      if (settings.app_subtitle) {
        setAppSubtitle(settings.app_subtitle);
        localStorage.setItem("appSubtitle", settings.app_subtitle);
      }
      if (settings.app_logo) {
        setAppLogo(settings.app_logo);
        localStorage.setItem("appLogo", settings.app_logo);
      }
      if (settings.app_favicon) {
        setAppFavicon(settings.app_favicon);
        localStorage.setItem("appFavicon", settings.app_favicon);
        updateFavicon(settings.app_favicon);
      }
      if (settings.bpjs_logo) {
        setBpjsLogo(settings.bpjs_logo);
      }
      if (settings.hospital_name) setHospitalName(settings.hospital_name);
      if (settings.hospital_address) setHospitalAddress(settings.hospital_address);
      if (settings.hospital_city) setHospitalCity(settings.hospital_city);
      if (settings.hospital_phone) setHospitalPhone(settings.hospital_phone);
      if (settings.hospital_fax) setHospitalFax(settings.hospital_fax);
      if (settings.hospital_email) setHospitalEmail(settings.hospital_email);
      if (settings.hospital_website) setHospitalWebsite(settings.hospital_website);
      if (settings.signature_pin_required !== undefined) {
        setSignaturePinRequired(settings.signature_pin_required === "true" || settings.signature_pin_required === true);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setFetching(false);
    }
  };

  const updateFavicon = (faviconUrl: string) => {
    const fullUrl = faviconUrl.startsWith('http') ? faviconUrl : `${BASE_URL}${faviconUrl}`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = fullUrl;
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const response = await settingsApi.uploadLogo(file, 'logo');
      const url = response.data.url;
      setAppLogo(url);
      localStorage.setItem("appLogo", url);
      window.dispatchEvent(new Event("storage"));

      toast({
        variant: "success",
        title: "Success!",
        description: "Logo uploaded successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Failed to upload logo.",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFavicon(true);
    try {
      const response = await settingsApi.uploadLogo(file, 'favicon');
      const url = response.data.url;
      setAppFavicon(url);
      localStorage.setItem("appFavicon", url);
      updateFavicon(url);

      toast({
        variant: "success",
        title: "Success!",
        description: "Favicon uploaded successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Failed to upload favicon.",
      });
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleUploadBpjsLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBpjsLogo(true);
    try {
      const response = await settingsApi.uploadLogo(file, 'bpjs_logo');
      const url = response.data.url;
      setBpjsLogo(url);

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Logo BPJS berhasil diunggah.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal mengunggah logo BPJS.",
      });
    } finally {
      setUploadingBpjsLogo(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setLoading(true);
    try {
      await settingsApi.update({
        app_name: appName,
        app_subtitle: appSubtitle,
      });

      localStorage.setItem("appName", appName);
      localStorage.setItem("appSubtitle", appSubtitle);
      window.dispatchEvent(new Event("storage"));

      toast({
        variant: "success",
        title: "Success!",
        description: "Application settings saved successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Failed to save settings. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHospitalSettings = async () => {
    setSavingHospital(true);
    try {
      await settingsApi.update({
        hospital_name: hospitalName,
        hospital_address: hospitalAddress,
        hospital_city: hospitalCity,
        hospital_phone: hospitalPhone,
        hospital_fax: hospitalFax,
        hospital_email: hospitalEmail,
        hospital_website: hospitalWebsite,
      });
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Data rumah sakit berhasil disimpan.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyimpan data rumah sakit.",
      });
    } finally {
      setSavingHospital(false);
    }
  };

  const handleSaveSignatureSettings = async (value: boolean) => {
    setSignaturePinRequired(value);
    setSavingSignature(true);
    try {
      await settingsApi.update({
        signature_pin_required: value ? "true" : "false",
      });
      toast({
        variant: value ? "success" : "default",
        title: value ? "Diaktifkan" : "Dinonaktifkan",
        description: value
          ? "PIN tanda tangan sekarang wajib untuk menandatangani dokumen"
          : "PIN tanda tangan tidak lagi diwajibkan",
      });
    } catch {
      setSignaturePinRequired(!value);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyimpan pengaturan tanda tangan.",
      });
    } finally {
      setSavingSignature(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Pengaturan Sistem"
        description="Kelola preferensi aplikasi, branding, dan informasi rumah sakit"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Kembali
          </Button>
        }
      />

      <PageContent className="max-w-full">
        <div className="space-y-6">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Memuat pengaturan...</p>
            </div>
          ) : (
            <>
              {/* Application Settings Card */}
              <div className=" border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Identitas Aplikasi
                  </h3>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="appName" className="text-xs font-medium">Nama Aplikasi</Label>
                      <Input
                        id="appName"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="SIMRS"
                      />
                      <p className="text-[10px] text-muted-foreground">Muncul di sidebar dan judul halaman</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appSubtitle" className="text-xs font-medium">Sub-judul Aplikasi</Label>
                      <Input
                        id="appSubtitle"
                        value={appSubtitle}
                        onChange={(e) => setAppSubtitle(e.target.value)}
                        placeholder="Hospital System"
                      />
                      <p className="text-[10px] text-muted-foreground">Teks kecil di bawah nama aplikasi</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveAppSettings}
                    disabled={loading}
                    size="sm"
                    className="h-8"
                  >
                    {loading ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Menyimpan...</>
                    ) : (
                      <><Save className="h-3.5 w-3.5 mr-2" />Simpan Perubahan</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Branding Settings Card */}
              <div className=" border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Visual & Branding
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid gap-8 md:grid-cols-2">
                    {/* Logo Upload */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium">Logo Aplikasi</Label>
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                          {appLogo ? (
                            <img src={`${BASE_URL}${appLogo}`} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <Image className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                          <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="h-8 w-full justify-start px-3">
                            {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                            Ganti Logo
                          </Button>
                          <p className="text-[10px] text-muted-foreground">PNG, JPG, atau SVG. Max 2MB.</p>
                        </div>
                      </div>
                    </div>

                    {/* Favicon Upload */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium">Favicon</Label>
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                          {appFavicon ? (
                            <img src={`${BASE_URL}${appFavicon}`} alt="Favicon" className="w-full h-full object-contain" />
                          ) : (
                            <FileImage className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          <input ref={faviconInputRef} type="file" accept="image/*" onChange={handleUploadFavicon} className="hidden" />
                          <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon} className="h-8 w-full justify-start px-3">
                            {uploadingFavicon ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                            Ganti Favicon
                          </Button>
                          <p className="text-[10px] text-muted-foreground">ICO, PNG, atau JPG. Disarankan 32x32.</p>
                        </div>
                      </div>
                    </div>

                    {/* BPJS Logo Upload */}
                    <div className="space-y-3 md:col-span-2 pt-2 border-t">
                      <Label className="text-xs font-medium">Logo BPJS (Untuk SEP)</Label>
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-14 border rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                          {bpjsLogo ? (
                            <img src={`${BASE_URL}${bpjsLogo}`} alt="Logo BPJS" className="w-full h-full object-contain" />
                          ) : (
                            <Image className="h-6 w-6 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          <input ref={bpjsLogoInputRef} type="file" accept="image/*" onChange={handleUploadBpjsLogo} className="hidden" />
                          <Button variant="outline" size="sm" onClick={() => bpjsLogoInputRef.current?.click()} disabled={uploadingBpjsLogo} className="h-8 px-3">
                            {uploadingBpjsLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                            Upload Logo BPJS
                          </Button>
                          <p className="text-[10px] text-muted-foreground">Digunakan pada header cetakan SEP BPJS.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hospital Info Card */}
              <div className=" border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Hospital className="h-4 w-4 text-primary" />
                    Profil Rumah Sakit & Kop Cetakan
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {/* Kop Preview Box */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview Header Dokumen</Label>
                    <div className="bg-muted/30  p-4 border border-dashed flex justify-center overflow-hidden">
                      <div className="bg-white shadow-md border w-full max-w-[600px] p-6 origin-top" style={{ transform: "scale(0.85)", transformOrigin: "top", marginBottom: "-40px" }}>
                        <div className="flex items-center gap-3">
                          {appLogo && (
                            <div className="w-14 h-14 shrink-0">
                              <img src={`${BASE_URL}${appLogo}`} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                          )}
                          <div className="flex-1 text-center">
                            <div className="text-base font-bold uppercase tracking-wide text-black leading-tight">
                              {hospitalName || "NAMA RUMAH SAKIT"}
                            </div>
                            <div className="text-[9px] text-gray-700 mt-0.5">
                              {hospitalAddress || "Alamat Rumah Sakit No. 123"}{hospitalCity ? `, ${hospitalCity}` : ""}
                            </div>
                            <div className="text-[8px] text-gray-600">
                              {[hospitalPhone && `Telp: ${hospitalPhone}`, hospitalFax && `Fax: ${hospitalFax}`, hospitalEmail].filter(Boolean).join(" | ")}
                            </div>
                            {hospitalWebsite && <div className="text-[8px] text-gray-600">{hospitalWebsite}</div>}
                          </div>
                          {appLogo && <div className="w-14 shrink-0" />}
                        </div>
                        <div className="mt-2 border-t-2 border-double border-black" />
                        <div className="mt-2 text-center">
                          <div className="text-[11px] font-bold underline uppercase">Judul Dokumen</div>
                          <div className="text-[9px] text-gray-500 mt-0.5">No. Dokumen: 000/XXX/2026</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="h-name" className="text-xs font-medium">Nama Rumah Sakit</Label>
                      <Input id="h-name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="RS Contoh Sejahtera" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="h-address" className="text-xs font-medium">Alamat</Label>
                      <Input id="h-address" value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} placeholder="Jl. Raya No. 123" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="h-city" className="text-xs font-medium">Kota / Kode Pos</Label>
                      <Input id="h-city" value={hospitalCity} onChange={(e) => setHospitalCity(e.target.value)} placeholder="Kota, Provinsi, 12345" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="h-phone" className="text-xs font-medium">Telepon</Label>
                      <Input id="h-phone" value={hospitalPhone} onChange={(e) => setHospitalPhone(e.target.value)} placeholder="(021) 1234567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="h-email" className="text-xs font-medium">Email</Label>
                      <Input id="h-email" value={hospitalEmail} onChange={(e) => setHospitalEmail(e.target.value)} placeholder="info@rs.co.id" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="h-web" className="text-xs font-medium">Website</Label>
                      <Input id="h-web" value={hospitalWebsite} onChange={(e) => setHospitalWebsite(e.target.value)} placeholder="www.rs.co.id" />
                    </div>
                  </div>

                  <Button onClick={handleSaveHospitalSettings} disabled={savingHospital} size="sm" className="h-8 px-6">
                    {savingHospital ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
                    Simpan Data Rumah Sakit
                  </Button>
                </div>
              </div>

              {/* Security & Features Card */}
              <div className=" border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Keamanan & Tanda Tangan Digital
                  </h3>
                </div>
                <div className="p-6 space-y-8">
                  {/* Signature Toggle */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        Wajib PIN Tanda Tangan
                        <Badge variant={signaturePinRequired ? "default" : "secondary"} className="h-4 text-[9px] px-1.5 uppercase tracking-wider">
                          {signaturePinRequired ? "Aktif" : "Off"}
                        </Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">User wajib memasukkan 6 digit PIN untuk menandatangani dokumen secara digital.</p>
                    </div>
                    <Switch checked={signaturePinRequired} onCheckedChange={handleSaveSignatureSettings} disabled={savingSignature} />
                  </div>

                  <Separator />

                  {/* QR Preview */}
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0 bg-white p-3  border-2 border-primary/10 shadow-sm">
                      <QRCodeSVG
                        value={`${window.location.origin}/verify/example-hash`}
                        size={110}
                        level="M"
                        imageSettings={appLogo ? {
                          src: `${BASE_URL}${appLogo}`,
                          height: 22,
                          width: 22,
                          excavate: true,
                        } : undefined}
                      />
                    </div>
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <QrCode className="h-4 w-4 text-primary" />
                        Preview QR Verifikasi
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        QR code verifikasi akan muncul otomatis pada dokumen yang sudah ditandatangani. Logo RS akan disematkan di tengah QR code.
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-primary" />Logo dari Identitas Aplikasi</li>
                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-primary" />Level redundansi medium (M)</li>
                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-primary" />Link ke halaman verifikasi</li>
                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-primary" />Excavate logo mode</li>
                      </ul>
                    </div>
                  </div>

                  <Separator />

                  {/* Links/Audit Log */}
                  <Link
                    to="/settings/audit-log"
                    className="flex items-center justify-between p-4  border bg-muted/20 hover:bg-muted/40 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <FileEdit className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Audit Log Aktivitas</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Pantau riwayat tanda tangan digital dan perubahan dokumen rekam medis.</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}
