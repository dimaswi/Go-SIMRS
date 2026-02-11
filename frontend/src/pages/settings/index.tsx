import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Save, Loader2, Upload, Image, FileImage, Hospital, Phone, Mail, Globe, ShieldCheck, FileEdit, ExternalLink } from "lucide-react";
import { settingsApi } from "@/lib/api";

// Get base URL without /api suffix
const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};
const BASE_URL = getBaseUrl();

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [appName, setAppName] = useState("StarterKits");
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
      // Load from API
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
      // Hospital info
      if (settings.hospital_name) setHospitalName(settings.hospital_name);
      if (settings.hospital_address) setHospitalAddress(settings.hospital_address);
      if (settings.hospital_city) setHospitalCity(settings.hospital_city);
      if (settings.hospital_phone) setHospitalPhone(settings.hospital_phone);
      if (settings.hospital_fax) setHospitalFax(settings.hospital_fax);
      if (settings.hospital_email) setHospitalEmail(settings.hospital_email);
      if (settings.hospital_website) setHospitalWebsite(settings.hospital_website);
      // Digital Signature settings
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
      // Save to API
      await settingsApi.update({
        app_name: appName,
        app_subtitle: appSubtitle,
      });

      // Save to localStorage
      localStorage.setItem("appName", appName);
      localStorage.setItem("appSubtitle", appSubtitle);

      // Trigger storage event to update sidebar immediately
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
      // Revert on error
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
    <div className="flex flex-1 flex-col gap-4 p-6 max-w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage application preferences
          </p>
        </div>
      </div>

      <div className="space-y-4 max-w-full">
        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Application Settings */}
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 px-6 py-4">
                <h3 className="text-sm font-medium">
                  Application
                </h3>
                <p className="text-sm text-muted-foreground">
                  Customize application name and branding
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="appName"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Application Name
                    </Label>
                    <Input
                      id="appName"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="StarterKits"
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will appear in the sidebar and page titles
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="appSubtitle"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Application Subtitle
                    </Label>
                    <Input
                      id="appSubtitle"
                      value={appSubtitle}
                      onChange={(e) => setAppSubtitle(e.target.value)}
                      placeholder="Hospital System"
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      Subtitle text shown below the application name
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveAppSettings}
                    className="mt-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Branding Settings */}
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 px-6 py-4">
                <h3 className="text-sm font-medium">
                  Branding
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload application logo and favicon
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Logo Upload */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      Application Logo
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                        {appLogo ? (
                          <img 
                            src={`${BASE_URL}${appLogo}`} 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                          onChange={handleUploadLogo}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Logo
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, or SVG. Max 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                      Favicon
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                        {appFavicon ? (
                          <img 
                            src={`${BASE_URL}${appFavicon}`} 
                            alt="Favicon" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <FileImage className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={faviconInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/x-icon,image/ico"
                          onChange={handleUploadFavicon}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => faviconInputRef.current?.click()}
                          disabled={uploadingFavicon}
                        >
                          {uploadingFavicon ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Favicon
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          ICO, PNG, or JPG. 32x32 or 64x64 recommended.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BPJS Logo Upload */}
                  <div className="space-y-3 pt-4">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      Logo BPJS
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                        {bpjsLogo ? (
                          <img 
                            src={`${BASE_URL}${bpjsLogo}`} 
                            alt="Logo BPJS" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={bpjsLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleUploadBpjsLogo}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => bpjsLogoInputRef.current?.click()}
                          disabled={uploadingBpjsLogo}
                        >
                          {uploadingBpjsLogo ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Mengunggah...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Logo BPJS
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Logo BPJS untuk cetakan SEP. PNG atau JPG. Max 2MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Hospital Info Settings (Kop Cetakan) */}
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 px-6 py-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Hospital className="h-4 w-4" />
                  Data Rumah Sakit
                </h3>
                <p className="text-sm text-muted-foreground">
                  Informasi rumah sakit yang akan tampil pada kop cetakan / header dokumen
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  {/* Preview Kop - A4 Paper (scaled 60%) */}
                  <div className="flex justify-center bg-muted/30 rounded-lg py-4 px-2 overflow-auto">
                    <div
                      className="bg-white shadow-lg border origin-top"
                      style={{
                        width: "210mm",
                        minHeight: "297mm",
                        padding: "10mm 12mm",
                        fontFamily: "Arial, Helvetica, sans-serif",
                        transform: "scale(0.6)",
                        transformOrigin: "top center",
                        marginBottom: "-118mm",
                      }}
                    >
                      {/* Kop Surat */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {appLogo && (
                          <div style={{ width: "56px", height: "56px", flexShrink: 0 }}>
                            <img
                              src={`${BASE_URL}${appLogo}`}
                              alt="Logo"
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          </div>
                        )}
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", color: "#000" }}>
                            {hospitalName || "Nama Rumah Sakit"}
                          </div>
                          <div style={{ fontSize: "9px", color: "#444", marginTop: "1px" }}>
                            {hospitalAddress || "Jl. Contoh No. 123"}{hospitalCity ? `, ${hospitalCity}` : ""}
                          </div>
                          <div style={{ fontSize: "8px", color: "#555" }}>
                            {[
                              hospitalPhone ? `Telp: ${hospitalPhone}` : "",
                              hospitalFax ? `Fax: ${hospitalFax}` : "",
                              hospitalEmail || "",
                            ].filter(Boolean).join("  |  ")}
                          </div>
                          {(hospitalWebsite || "www.rscontoh.co.id") && (
                            <div style={{ fontSize: "8px", color: "#555" }}>
                              {hospitalWebsite || "www.rscontoh.co.id"}
                            </div>
                          )}
                        </div>
                        {appLogo && <div style={{ width: "56px", flexShrink: 0 }} />}
                      </div>
                      <div style={{ marginTop: "4px", borderTop: "3px double #000" }} />

                      {/* Placeholder document content */}
                      <div style={{ textAlign: "center", marginTop: "10px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", textDecoration: "underline" }}>
                          Judul Dokumen
                        </div>
                        <div style={{ fontSize: "10px", color: "#444", marginTop: "1px" }}>
                          No. Dokumen: XXX/XX/2026
                        </div>
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        {[...Array(10)].map((_, i) => (
                          <div key={i} style={{ height: "1px", background: "#e5e5e5", margin: "8px 0" }} />
                        ))}
                      </div>

                      {/* Placeholder signature */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
                        <div style={{ textAlign: "center", width: "160px" }}>
                          <div style={{ fontSize: "9px", color: "#999" }}>Mengetahui,</div>
                          <div style={{ borderBottom: "1px solid #ccc", marginTop: "40px", marginBottom: "3px" }} />
                          <div style={{ fontSize: "9px", color: "#999" }}>NIP. _______________</div>
                        </div>
                        <div style={{ textAlign: "center", width: "160px" }}>
                          <div style={{ fontSize: "9px", color: "#999" }}>Penanggung Jawab,</div>
                          <div style={{ borderBottom: "1px solid #ccc", marginTop: "40px", marginBottom: "3px" }} />
                          <div style={{ fontSize: "9px", color: "#999" }}>NIP. _______________</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center italic">Preview kop cetakan (skala kertas A4)</p>

                  <Separator />

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="hospitalName" className="text-xs font-medium flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Nama Rumah Sakit
                      </Label>
                      <Input
                        id="hospitalName"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="RS Contoh Sejahtera"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospitalPhone" className="text-xs font-medium flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        Telepon
                      </Label>
                      <Input
                        id="hospitalPhone"
                        value={hospitalPhone}
                        onChange={(e) => setHospitalPhone(e.target.value)}
                        placeholder="(021) 1234567"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="hospitalAddress" className="text-xs font-medium">
                        Alamat
                      </Label>
                      <Input
                        id="hospitalAddress"
                        value={hospitalAddress}
                        onChange={(e) => setHospitalAddress(e.target.value)}
                        placeholder="Jl. Kesehatan No. 123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospitalCity" className="text-xs font-medium">
                        Kota / Kode Pos
                      </Label>
                      <Input
                        id="hospitalCity"
                        value={hospitalCity}
                        onChange={(e) => setHospitalCity(e.target.value)}
                        placeholder="Kota Contoh, Jawa Tengah 12345"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospitalFax" className="text-xs font-medium">
                        Fax
                      </Label>
                      <Input
                        id="hospitalFax"
                        value={hospitalFax}
                        onChange={(e) => setHospitalFax(e.target.value)}
                        placeholder="(021) 1234568"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospitalEmail" className="text-xs font-medium flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        Email
                      </Label>
                      <Input
                        id="hospitalEmail"
                        value={hospitalEmail}
                        onChange={(e) => setHospitalEmail(e.target.value)}
                        placeholder="info@rscontoh.co.id"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospitalWebsite" className="text-xs font-medium flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        Website
                      </Label>
                      <Input
                        id="hospitalWebsite"
                        value={hospitalWebsite}
                        onChange={(e) => setHospitalWebsite(e.target.value)}
                        placeholder="www.rscontoh.co.id"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveHospitalSettings}
                    disabled={savingHospital}
                  >
                    {savingHospital ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Simpan Data Rumah Sakit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Digital Signature Settings */}
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 px-6 py-4">
                <h3 className="text-sm font-medium">
                  Tanda Tangan Digital
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pengaturan tanda tangan digital dan audit log
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-6">
                  {/* PIN Required Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Wajib PIN Tanda Tangan</Label>
                        {signaturePinRequired ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Jika diaktifkan, user harus memasukkan PIN 6 digit untuk menandatangani dokumen
                      </p>
                    </div>
                    <Switch
                      checked={signaturePinRequired}
                      onCheckedChange={handleSaveSignatureSettings}
                      disabled={savingSignature}
                    />
                  </div>

                  <Separator />

                  {/* Links */}
                  <div className="space-y-3">
                    <Link 
                      to="/settings/audit-log"
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileEdit className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Audit Log</p>
                          <p className="text-xs text-muted-foreground">
                            Pantau aktivitas tanda tangan dan perubahan rekam medis
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
