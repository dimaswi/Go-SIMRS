import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  CheckCircle,
  Eye,
  EyeOff,
  Plug,
  AlertCircle,
  RefreshCw,
  Stethoscope,
  Building2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { integrationsApi, vclaimApi, type IntegrationConfigMap, type IntegrationType, type VClaimRefPropinsi, BPJS_SERVICE_TYPES, isBPJSType, getBPJSServiceName } from "@/lib/api";

interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isConfigured: boolean;
  isConnected: boolean | null; // null = not tested yet
  lastTested?: string;
  environment?: string;
  category?: string; // For grouping integrations
}

export default function IntegrationsConfigPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  
  // Integrations list - General table with all integrations as rows
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([
    // BPJS Integrations
    {
      id: "bpjs-antrian",
      name: "Antrian Online",
      description: "Sistem antrian online JKN Mobile",
      icon: <Stethoscope className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "BPJS",
    },
    {
      id: "bpjs-vclaim",
      name: "VClaim",
      description: "Verifikasi klaim & SEP BPJS",
      icon: <Stethoscope className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "BPJS",
    },
    {
      id: "bpjs-icare",
      name: "I-Care",
      description: "Integrasi data primer BPJS",
      icon: <Stethoscope className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "BPJS",
    },
    {
      id: "bpjs-apotek",
      name: "Apotek Online",
      description: "Sistem apotek online BPJS",
      icon: <Stethoscope className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "BPJS",
    },
    {
      id: "bpjs-rme",
      name: "RME BPJS",
      description: "Rekam Medis Elektronik BPJS",
      icon: <Stethoscope className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "BPJS",
    },
    // Kemenkes Integrations
    {
      id: "satusehat",
      name: "SatuSehat",
      description: "Integrasi platform SatuSehat Kemenkes",
      icon: <Building2 className="h-5 w-5" />,
      isConfigured: false,
      isConnected: null,
      category: "Kemenkes",
    },
  ]);
  
  // Config Dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  
  // BPJS Config State - now per service
  const [bpjsConfigs, setBpjsConfigs] = useState<Record<string, IntegrationConfigMap>>({});
  const [consId, setConsId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [userKey, setUserKey] = useState("");
  const [kodePPK, setKodePPK] = useState("");
  const [namaPPK, setNamaPPK] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [baseUrlDev, setBaseUrlDev] = useState("https://apijkn-dev.bpjs-kesehatan.go.id");
  const [baseUrlProd, setBaseUrlProd] = useState("https://apijkn.bpjs-kesehatan.go.id");
  const [syncInterval, setSyncInterval] = useState("5");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  // Webhook config (untuk BPJS Antrian Online)
  const [webhookUsername, setWebhookUsername] = useState("");
  const [webhookPassword, setWebhookPassword] = useState("");
  const [showWebhookPassword, setShowWebhookPassword] = useState(false);
  
  // SatuSehat Config State
  const [ssConfig, setSsConfig] = useState<IntegrationConfigMap>({});
  const [ssClientId, setSsClientId] = useState("");
  const [ssClientSecret, setSsClientSecret] = useState("");
  const [ssOrgId, setSsOrgId] = useState("");
  const [ssEnvironment, setSsEnvironment] = useState("development");
  const [ssBaseUrlDev, setSsBaseUrlDev] = useState("https://api-satusehat-stg.dto.kemkes.go.id");
  const [ssBaseUrlProd, setSsBaseUrlProd] = useState("https://api-satusehat.kemkes.go.id");
  const [ssAutoSync, setSsAutoSync] = useState(false);
  const [showSsClientSecret, setShowSsClientSecret] = useState(false);

  // VClaim Test State
  const [vclaimTesting, setVclaimTesting] = useState(false);
  const [vclaimTestResult, setVclaimTestResult] = useState<VClaimRefPropinsi[] | null>(null);
  const [vclaimTestError, setVclaimTestError] = useState<string | null>(null);

  // Visibility State for secrets
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showUserKey, setShowUserKey] = useState(false);

  // Set page title
  useEffect(() => {
    const savedAppName = localStorage.getItem("appName") || "SIMRS";
    document.title = `Konfigurasi Integrasi - ${savedAppName}`;
  }, []);

  // Load config on mount
  useEffect(() => {
    loadAllBPJSConfigs();
    loadSatuSehatConfig();
  }, []);

  const loadAllBPJSConfigs = async () => {
    try {
      setFetching(true);
      
      // Load config for each BPJS service
      const configPromises = BPJS_SERVICE_TYPES.map(async (serviceType) => {
        try {
          const response = await integrationsApi.getConfig(serviceType);
          return { type: serviceType, data: response.data.data };
        } catch (error: any) {
          // If 404, initialize config
          if (error.response?.status === 404 || !error.response?.data?.data) {
            try {
              await integrationsApi.initConfig(serviceType);
              const response = await integrationsApi.getConfig(serviceType);
              return { type: serviceType, data: response.data.data };
            } catch {
              return { type: serviceType, data: {} };
            }
          }
          return { type: serviceType, data: {} };
        }
      });

      const results = await Promise.all(configPromises);
      
      // Build configs map
      const newConfigs: Record<string, IntegrationConfigMap> = {};
      results.forEach(result => {
        newConfigs[result.type] = result.data;
      });
      setBpjsConfigs(newConfigs);
      
      // Update integration status for each BPJS service
      setIntegrations(prev => prev.map(i => {
        if (isBPJSType(i.id)) {
          const serviceConfig = newConfigs[i.id] || {};
          const isConfigured = !!(serviceConfig.cons_id?.has_value && serviceConfig.secret_key?.has_value && serviceConfig.user_key?.has_value);
          return { ...i, isConfigured, environment: serviceConfig.environment?.value };
        }
        return i;
      }));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat konfigurasi BPJS",
      });
    } finally {
      setFetching(false);
    }
  };

  // Get current editing config
  const getCurrentBPJSConfig = (): IntegrationConfigMap => {
    if (editingIntegration && isBPJSType(editingIntegration)) {
      return bpjsConfigs[editingIntegration] || {};
    }
    return {};
  };

  const loadSatuSehatConfig = async () => {
    try {
      const response = await integrationsApi.getConfig("satusehat");
      const data = response.data.data;
      setSsConfig(data);
      
      // Set values from config
      if (data.client_id?.value) setSsClientId(data.client_id.value);
      if (data.organization_id?.value) setSsOrgId(data.organization_id.value);
      if (data.environment?.value) setSsEnvironment(data.environment.value);
      if (data.base_url_dev?.value) setSsBaseUrlDev(data.base_url_dev.value);
      if (data.base_url_prod?.value) setSsBaseUrlProd(data.base_url_prod.value);
      if (data.auto_sync_enabled?.value) setSsAutoSync(data.auto_sync_enabled.value === "true");
      
      // Update SatuSehat integration status
      const isConfigured = !!(data.client_id?.has_value && data.client_secret?.has_value);
      setIntegrations(prev => prev.map(i => {
        if (i.id === "satusehat") {
          return { ...i, isConfigured, environment: data.environment?.value };
        }
        return i;
      }));
    } catch (error: any) {
      // If 404, initialize config
      if (error.response?.status === 404 || !error.response?.data?.data) {
        try {
          await integrationsApi.initConfig("satusehat");
          await loadSatuSehatConfig();
        } catch {
          // Silent fail for SatuSehat init
        }
      }
    }
  };

  const handleOpenConfig = (integrationId: string) => {
    setEditingIntegration(integrationId);
    
    // Reset secrets visibility
    setShowSecretKey(false);
    setShowUserKey(false);
    setShowSsClientSecret(false);
    setShowWebhookPassword(false);
    
    if (isBPJSType(integrationId)) {
      // Load data from config for this specific BPJS service
      const config = bpjsConfigs[integrationId] || {};
      setConsId(config.cons_id?.value || "");
      setSecretKey(config.secret_key?.value || "");
      setUserKey(config.user_key?.value || "");
      setKodePPK(config.kode_ppk?.value || "");
      setNamaPPK(config.nama_ppk?.value || "");
      setEnvironment(config.environment?.value || "development");
      setBaseUrlDev(config.base_url_dev?.value || "https://apijkn-dev.bpjs-kesehatan.go.id");
      setBaseUrlProd(config.base_url_prod?.value || "https://apijkn.bpjs-kesehatan.go.id");
      setSyncInterval(config.sync_interval_minutes?.value || "5");
      setAutoSyncEnabled(config.auto_sync_enabled?.value === "true");
      // Webhook config (only for bpjs-antrian)
      if (integrationId === "bpjs-antrian") {
        setWebhookUsername(config.webhook_username?.value || "");
        setWebhookPassword(config.webhook_password?.value || "");
      }
    } else if (integrationId === "satusehat") {
      // Load SatuSehat config values
      setSsClientSecret(ssConfig.client_secret?.value || "");
    }
    
    setConfigDialogOpen(true);
  };

  const handleSave = async () => {
    // Handle BPJS related integrations (each has its own config now)
    if (editingIntegration && isBPJSType(editingIntegration)) {
      await handleSaveBPJS();
    } else if (editingIntegration === "satusehat") {
      await handleSaveSatuSehat();
    }
  };

  const handleSaveBPJS = async () => {
    if (!editingIntegration) return;
    
    setLoading(true);
    try {
      const updateData: Record<string, string> = {
        cons_id: consId,
        secret_key: secretKey,
        user_key: userKey,
        kode_ppk: kodePPK,
        nama_ppk: namaPPK,
        environment: environment,
        base_url_dev: baseUrlDev,
        base_url_prod: baseUrlProd,
        sync_interval_minutes: syncInterval,
        auto_sync_enabled: autoSyncEnabled ? "true" : "false",
      };
      
      // Add webhook config for bpjs-antrian
      if (editingIntegration === "bpjs-antrian") {
        updateData.webhook_username = webhookUsername;
        updateData.webhook_password = webhookPassword;
      }
      
      // Update config for specific BPJS service
      await integrationsApi.updateConfig(editingIntegration as IntegrationType, updateData);
      
      const serviceName = getBPJSServiceName(editingIntegration);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `Konfigurasi ${serviceName} berhasil disimpan.`,
      });
      
      setConfigDialogOpen(false);
      await loadAllBPJSConfigs();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyimpan konfigurasi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSatuSehat = async () => {
    setLoading(true);
    try {
      const updateData: Record<string, string> = {
        client_id: ssClientId,
        client_secret: ssClientSecret,
        organization_id: ssOrgId,
        environment: ssEnvironment,
        base_url_dev: ssBaseUrlDev,
        base_url_prod: ssBaseUrlProd,
        auto_sync_enabled: ssAutoSync ? "true" : "false",
      };
      
      await integrationsApi.updateConfig("satusehat", updateData);
      
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Konfigurasi SatuSehat berhasil disimpan.",
      });
      
      setConfigDialogOpen(false);
      await loadSatuSehatConfig();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyimpan konfigurasi SatuSehat",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    // Check if integration type is valid
    if (!isBPJSType(integrationId) && integrationId !== "satusehat") {
      toast({
        variant: "destructive",
        title: "Belum Tersedia",
        description: "Integrasi ini belum tersedia.",
      });
      return;
    }
    
    setTesting(integrationId);
    
    try {
      const response = await integrationsApi.testConnection(integrationId as IntegrationType);
      const result = response.data;
      
      // Update specific integration status
      setIntegrations(prev => prev.map(i => {
        if (i.id === integrationId) {
          return { 
            ...i, 
            isConnected: result.success, 
            lastTested: new Date().toLocaleString("id-ID") 
          };
        }
        return i;
      }));
      
      if (result.success) {
        toast({
          variant: "success",
          title: "Koneksi Berhasil!",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Koneksi Gagal",
          description: result.error,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Gagal menguji koneksi";
      
      setIntegrations(prev => prev.map(i => 
        i.id === integrationId 
          ? { ...i, isConnected: false, lastTested: new Date().toLocaleString("id-ID") } 
          : i
      ));
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
    } finally {
      setTesting(null);
    }
  };

  const handleTestVClaim = async () => {
    setVclaimTesting(true);
    setVclaimTestResult(null);
    setVclaimTestError(null);

    try {
      const response = await vclaimApi.getPropinsi();
      const data = response.data.data;
      setVclaimTestResult(data);
      toast({
        variant: "success",
        title: "VClaim Berhasil!",
        description: `Endpoint /referensi/propinsi berhasil. Ditemukan ${data?.length || 0} propinsi.`,
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || "Gagal menghubungi VClaim";
      setVclaimTestError(errorMsg);
      toast({
        variant: "destructive",
        title: "VClaim Gagal",
        description: errorMsg,
      });
    } finally {
      setVclaimTesting(false);
    }
  };

  const getStatusBadge = (integration: IntegrationItem) => {
    if (!integration.isConfigured) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Belum Dikonfigurasi
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
        <CheckCircle className="h-3 w-3" />
        Terkonfigurasi
      </Badge>
    );
  };

  const getConnectionBadge = (integration: IntegrationItem) => {
    if (!integration.isConfigured) {
      return <span className="text-muted-foreground text-sm">-</span>;
    }
    
    if (integration.isConnected === null) {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Belum Diuji
        </Badge>
      );
    }
    
    if (integration.isConnected) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
          <Wifi className="h-3 w-3" />
          Terhubung
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" />
        Tidak Terhubung
      </Badge>
    );
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <div className="rounded-lg border">
          <div className="flex items-center gap-4 p-6">
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold">
                  Konfigurasi Integrasi
                </h1>
                <p className="text-sm text-muted-foreground">
                  Kelola integrasi dengan sistem eksternal
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadAllBPJSConfigs(); loadSatuSehatConfig(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
          </div>
          <div className="rounded-lg border p-6 mx-4 mb-4">
            <div className="rounded-md border">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Integrasi</TableHead>
                  <TableHead className="w-[100px]">Kategori</TableHead>
                  <TableHead>Status Konfigurasi</TableHead>
                  <TableHead>Status Koneksi</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Terakhir Diuji</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...integrations].sort((a, b) => a.name.localeCompare(b.name)).map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          {integration.icon}
                        </div>
                        <div>
                          <p className="font-medium">{integration.name}</p>
                          <p className="text-xs text-muted-foreground">{integration.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{integration.category || "-"}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(integration)}</TableCell>
                    <TableCell>{getConnectionBadge(integration)}</TableCell>
                    <TableCell>
                      {integration.isConfigured && integration.environment ? (
                        <Badge variant={integration.environment === "production" ? "default" : "secondary"}>
                          {integration.environment === "production" ? "Production" : "Development"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {integration.lastTested ? (
                        <span className="text-sm text-muted-foreground">{integration.lastTested}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(integration.id)}
                          disabled={!integration.isConfigured || testing === integration.id}
                        >
                          {testing === integration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plug className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Test</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenConfig(integration.id)}
                        >
                          <Settings className="h-4 w-4" />
                          <span className="ml-2 hidden sm:inline">Konfigurasi</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* BPJS Config Dialog (each BPJS service has its own config) */}
      <Dialog open={configDialogOpen && isBPJSType(editingIntegration || "")} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Konfigurasi BPJS {editingIntegration ? getBPJSServiceName(editingIntegration) : ""}
            </DialogTitle>
            <DialogDescription>
              Kredensial untuk layanan BPJS {editingIntegration ? getBPJSServiceName(editingIntegration) : ""}. Setiap layanan BPJS memiliki kredensial yang terpisah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Kredensial */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Kredensial BPJS {editingIntegration ? getBPJSServiceName(editingIntegration) : ""}</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="consId" className="text-xs font-medium">
                    Consumer ID
                  </Label>
                  <Input
                    id="consId"
                    value={consId}
                    onChange={(e) => setConsId(e.target.value)}
                    placeholder="Masukkan Consumer ID"
                  />
                  {getCurrentBPJSConfig().cons_id?.has_value && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Sudah dikonfigurasi
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secretKey" className="text-xs font-medium">
                    Secret Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="secretKey"
                      type={showSecretKey ? "text" : "password"}
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder={getCurrentBPJSConfig().secret_key?.has_value ? "••••••••" : "Masukkan Secret Key"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                    >
                      {showSecretKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="userKey" className="text-xs font-medium">
                    User Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="userKey"
                      type={showUserKey ? "text" : "password"}
                      value={userKey}
                      onChange={(e) => setUserKey(e.target.value)}
                      placeholder={getCurrentBPJSConfig().user_key?.has_value ? "••••••••" : "Masukkan User Key"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowUserKey(!showUserKey)}
                    >
                      {showUserKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <hr />

            {/* Info Faskes */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Informasi Fasilitas Kesehatan</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kodePPK" className="text-xs font-medium">
                    Kode PPK
                  </Label>
                  <Input
                    id="kodePPK"
                    value={kodePPK}
                    onChange={(e) => setKodePPK(e.target.value)}
                    placeholder="Contoh: 0301R001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="namaPPK" className="text-xs font-medium">
                    Nama Faskes
                  </Label>
                  <Input
                    id="namaPPK"
                    value={namaPPK}
                    onChange={(e) => setNamaPPK(e.target.value)}
                    placeholder="Nama Rumah Sakit"
                  />
                </div>
              </div>
            </div>

            <hr />

            {/* Environment */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Environment</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="environment" className="text-xs font-medium">
                    Environment
                  </Label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrlDev" className="text-xs font-medium">
                    URL Development
                  </Label>
                  <Input
                    id="baseUrlDev"
                    value={baseUrlDev}
                    onChange={(e) => setBaseUrlDev(e.target.value)}
                    placeholder="https://apijkn-dev.bpjs-kesehatan.go.id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrlProd" className="text-xs font-medium">
                    URL Production
                  </Label>
                  <Input
                    id="baseUrlProd"
                    value={baseUrlProd}
                    onChange={(e) => setBaseUrlProd(e.target.value)}
                    placeholder="https://apijkn.bpjs-kesehatan.go.id"
                  />
                </div>
              </div>
            </div>

            <hr />

            {/* Sinkronisasi */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Pengaturan Sinkronisasi</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="syncInterval" className="text-xs font-medium">
                    Interval Sinkronisasi (menit)
                  </Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    min="1"
                    max="60"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Auto Sync</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={autoSyncEnabled}
                      onCheckedChange={setAutoSyncEnabled}
                    />
                    <Label className="text-sm text-muted-foreground">
                      {autoSyncEnabled ? "Aktif" : "Nonaktif"}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook Config - Only for BPJS Antrian */}
            {editingIntegration === "bpjs-antrian" && (
              <>
                <hr />
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Konfigurasi Webhook RS</h4>
                  <p className="text-xs text-muted-foreground">
                    Kredensial untuk BPJS mengakses endpoint webhook RS. Jika dikosongkan, akan menggunakan akun user SIMRS.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhookUsername" className="text-xs font-medium">
                        Webhook Username (Opsional)
                      </Label>
                      <Input
                        id="webhookUsername"
                        placeholder="Kosongkan untuk pakai user SIMRS"
                        value={webhookUsername}
                        onChange={(e) => setWebhookUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhookPassword" className="text-xs font-medium">
                        Webhook Password (Opsional)
                      </Label>
                      <div className="relative">
                        <Input
                          id="webhookPassword"
                          type={showWebhookPassword ? "text" : "password"}
                          placeholder="Kosongkan untuk pakai user SIMRS"
                          value={webhookPassword}
                          onChange={(e) => setWebhookPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowWebhookPassword(!showWebhookPassword)}
                        >
                          {showWebhookPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Test VClaim - Only for bpjs-vclaim */}
            {editingIntegration === "bpjs-vclaim" && (
              <>
                <hr />
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Test VClaim API</h4>
                  <p className="text-xs text-muted-foreground">
                    Uji koneksi VClaim dengan mengambil data referensi propinsi dari endpoint <code>/referensi/propinsi</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestVClaim}
                    disabled={vclaimTesting}
                  >
                    {vclaimTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plug className="h-4 w-4 mr-2" />
                    )}
                    Test VClaim - Referensi Propinsi
                  </Button>

                  {vclaimTestError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Gagal</span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">{vclaimTestError}</p>
                    </div>
                  )}

                  {vclaimTestResult && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center gap-2 text-green-800 mb-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Berhasil - {vclaimTestResult.length} propinsi ditemukan
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-green-200">
                              <th className="text-left py-1 px-2 font-medium text-green-800">Kode</th>
                              <th className="text-left py-1 px-2 font-medium text-green-800">Nama Propinsi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vclaimTestResult.map((item, idx) => (
                              <tr key={idx} className="border-b border-green-100 last:border-0">
                                <td className="py-1 px-2 text-green-700">{item.kode}</td>
                                <td className="py-1 px-2 text-green-700">{item.nama}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <hr />

            {/* Mapping Poli & Dokter */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Mapping Data</h4>
              <p className="text-xs text-muted-foreground">
                Petakan ruangan poliklinik dan dokter SIMRS dengan kode BPJS untuk antrian online
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setConfigDialogOpen(false);
                    navigate("/bpjs/mapping");
                  }}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Kelola Mapping
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SatuSehat Config Dialog */}
      <Dialog open={configDialogOpen && editingIntegration === "satusehat"} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Konfigurasi SatuSehat
            </DialogTitle>
            <DialogDescription>
              Integrasi dengan platform SatuSehat Kemenkes (FHIR R4)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Kredensial */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Kredensial OAuth2</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ssClientId" className="text-xs font-medium">
                    Client ID
                  </Label>
                  <Input
                    id="ssClientId"
                    value={ssClientId}
                    onChange={(e) => setSsClientId(e.target.value)}
                    placeholder="Masukkan Client ID"
                  />
                  {ssConfig.client_id?.has_value && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Sudah dikonfigurasi
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssClientSecret" className="text-xs font-medium">
                    Client Secret
                  </Label>
                  <div className="relative">
                    <Input
                      id="ssClientSecret"
                      type={showSsClientSecret ? "text" : "password"}
                      value={ssClientSecret}
                      onChange={(e) => setSsClientSecret(e.target.value)}
                      placeholder={ssConfig.client_secret?.has_value ? "••••••••" : "Masukkan Client Secret"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSsClientSecret(!showSsClientSecret)}
                    >
                      {showSsClientSecret ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {ssConfig.client_secret?.has_value && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Terenkripsi
                    </p>
                  )}
                </div>
              </div>
            </div>

            <hr />

            {/* Organization Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Informasi Organisasi</h4>
              <div className="space-y-2">
                <Label htmlFor="ssOrgId" className="text-xs font-medium">
                  Organization ID (IHS Number)
                </Label>
                <Input
                  id="ssOrgId"
                  value={ssOrgId}
                  onChange={(e) => setSsOrgId(e.target.value)}
                  placeholder="Contoh: 10000001"
                />
                <p className="text-xs text-muted-foreground">
                  ID Organisasi dari SatuSehat, digunakan untuk mengambil data encounter yang sudah dikirim sebelumnya
                </p>
              </div>
            </div>

            <hr />

            {/* Environment */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Environment</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ssEnvironment" className="text-xs font-medium">
                    Environment
                  </Label>
                  <Select value={ssEnvironment} onValueChange={setSsEnvironment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Staging/Development</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssBaseUrlDev" className="text-xs font-medium">
                    URL Staging
                  </Label>
                  <Input
                    id="ssBaseUrlDev"
                    value={ssBaseUrlDev}
                    onChange={(e) => setSsBaseUrlDev(e.target.value)}
                    placeholder="https://api-satusehat-stg.dto.kemkes.go.id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssBaseUrlProd" className="text-xs font-medium">
                    URL Production
                  </Label>
                  <Input
                    id="ssBaseUrlProd"
                    value={ssBaseUrlProd}
                    onChange={(e) => setSsBaseUrlProd(e.target.value)}
                    placeholder="https://api-satusehat.kemkes.go.id"
                  />
                </div>
              </div>
            </div>

            <hr />

            {/* Auto Sync */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Pengaturan Sinkronisasi</h4>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Auto Sync ke SatuSehat</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    checked={ssAutoSync}
                    onCheckedChange={setSsAutoSync}
                  />
                  <Label className="text-sm text-muted-foreground">
                    {ssAutoSync ? "Aktif - Data akan otomatis dikirim ke SatuSehat" : "Nonaktif"}
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
