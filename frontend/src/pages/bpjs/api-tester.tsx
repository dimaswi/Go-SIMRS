import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
  Loader2,
  Send,
  Copy,
  CheckCircle,
  XCircle,
  Stethoscope,
  RefreshCw,
  Eye,
  Database,
  Key,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BPJSConfig {
  cons_id: string;
  secret_key: string;
  user_key: string;
  environment: string;
  base_url_dev: string;
  base_url_prod: string;
}

interface APITestResult {
  success: boolean;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  response: {
    status_code: number;
    headers: Record<string, string[]>;
    body: string;
    duration_ms: number;
  };
  error?: string;
  config: {
    environment: string;
    base_url: string;
    cons_id: string;
  };
}

const PRESET_ENDPOINTS = [
  { label: "Referensi Poli", method: "GET", endpoint: "/ref/poli", body: "" },
  { label: "Referensi Dokter", method: "GET", endpoint: "/ref/dokter", body: "" },
  { label: "Jadwal Dokter (contoh)", method: "GET", endpoint: "/jadwaldokter/kodepoli/ANA/tanggal/2026-01-21", body: "" },
  { label: "Antrean Aktif", method: "GET", endpoint: "/antrean/pendaftaran/aktif", body: "" },
  { label: "Antrean Per Tanggal", method: "GET", endpoint: "/antrean/pendaftaran/tanggal/2026-01-21", body: "" },
  { label: "Dashboard Hari Ini", method: "GET", endpoint: "/dashboard/waktutunggu/tanggal/2026-01-21/waktu/rs", body: "" },
  { 
    label: "Tambah Antrean (contoh)", 
    method: "POST", 
    endpoint: "/antrean/add", 
    body: JSON.stringify({
      kodebooking: "TEST001",
      jenispasien: "JKN",
      nomorkartu: "0001234567890",
      nik: "3201234567890001",
      nohp: "081234567890",
      kodepoli: "ANA",
      namapoli: "ANAK",
      pasienbaru: 0,
      norm: "123456",
      tanggalperiksa: "2026-01-21",
      kodedokter: 12345,
      namadokter: "dr. Test",
      jampraktek: "08:00-12:00",
      jeniskunjungan: 1,
      nomorreferensi: "0001R0010121K000001",
      nomorantrean: "ANA-001",
      angkaantrean: 1,
      estimasidilayani: Date.now() + 3600000,
      sisakuotajkn: 10,
      kuotajkn: 20,
      sisakuotanonjkn: 5,
      kuotanonjkn: 10,
      keterangan: "Test antrean"
    }, null, 2)
  },
  {
    label: "Update Waktu Task",
    method: "POST",
    endpoint: "/antrean/updatewaktu",
    body: JSON.stringify({
      kodebooking: "TEST001",
      taskid: 1,
      waktu: Date.now()
    }, null, 2)
  },
  {
    label: "Batal Antrean",
    method: "POST",
    endpoint: "/antrean/batal",
    body: JSON.stringify({
      kodebooking: "TEST001",
      keterangan: "Dibatalkan untuk test"
    }, null, 2)
  },
];

export default function BPJSAPITesterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("/ref/poli");
  const [requestBody, setRequestBody] = useState("");
  const [result, setResult] = useState<APITestResult | null>(null);
  const [config, setConfig] = useState<BPJSConfig | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string>("development");

  // Timestamp dan signature yang akan dipakai (preview)
  const [previewTimestamp, setPreviewTimestamp] = useState<string>("");

  useEffect(() => {
    setPageTitle("API Tester BPJS");
    loadConfig();
    updateTimestamp();
    
    // Update timestamp setiap detik
    const interval = setInterval(updateTimestamp, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateTimestamp = () => {
    setPreviewTimestamp(Math.floor(Date.now() / 1000).toString());
  };

  const loadConfig = async () => {
    try {
      setLoadingConfig(true);
      const response = await api.get('/bpjs/config');
      const data = response.data.data;
      
      // Extract values from config response
      const extractValue = (key: string) => {
        const item = data[`bpjs_${key}`];
        if (item && typeof item === 'object') {
          return item.value || '';
        }
        return item || '';
      };

      const env = extractValue('environment') || 'development';
      setConfig({
        cons_id: extractValue('cons_id'),
        secret_key: extractValue('secret_key'),
        user_key: extractValue('user_key'),
        environment: env,
        base_url_dev: extractValue('base_url_dev'),
        base_url_prod: extractValue('base_url_prod'),
      });
      setSelectedEnv(env);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mengambil konfigurasi BPJS: " + (error.response?.data?.error || error.message),
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  // Computed values based on selected environment (not from config)
  const baseURL = useMemo(() => {
    if (!config) return '';
    let url = selectedEnv === 'production' ? config.base_url_prod : config.base_url_dev;
    
    // Append service name jika belum ada
    if (url && !url.includes('/antreanrs')) {
      url = url + (selectedEnv === 'production' ? '/antreanrs' : '/antreanrs_dev');
    }
    return url;
  }, [config, selectedEnv]);

  const fullURL = useMemo(() => {
    return baseURL + endpoint;
  }, [baseURL, endpoint]);

  const previewHeaders = useMemo(() => {
    if (!config) return {};
    return {
      'X-cons-id': config.cons_id || '(belum diisi)',
      'X-timestamp': previewTimestamp,
      'X-signature': '(akan di-generate saat kirim)',
      'user_key': config.user_key ? config.user_key.substring(0, 8) + '...' : '(belum diisi)',
      'Content-Type': 'application/json',
    };
  }, [config, previewTimestamp]);

  const sendRequest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await api.post<APITestResult>('/bpjs/api-test', {
        method,
        endpoint,
        body: requestBody || undefined,
        environment: selectedEnv,
      });
      setResult(response.data);
      toast({
        title: "Request terkirim",
        description: `Status: ${response.data.response.status_code}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengirim request",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin ke clipboard" });
  };

  const selectPreset = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setMethod(preset.method);
    setEndpoint(preset.endpoint);
    setRequestBody(preset.body);
  };

  const formatJSON = (str: string) => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  if (loadingConfig) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/bpjs/logs")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">
                API Tester BPJS
              </CardTitle>
              <CardDescription>
                Test request ke BPJS Antrian Online seperti Postman
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadConfig}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Config
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Config Info dari Database */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Konfigurasi dari Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Environment:</span>
                  <Badge variant={config?.environment === 'production' ? 'destructive' : 'secondary'}>
                    {config?.environment || 'development'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cons ID:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                    {config?.cons_id || '(belum diisi)'}
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">User Key:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                    {config?.user_key ? config.user_key.substring(0, 8) + '...' : '(belum diisi)'}
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Secret Key:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                    {config?.secret_key ? '********' : '(belum diisi)'}
                  </code>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Base URL Dev:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs max-w-[200px] truncate">
                    {config?.base_url_dev || '(belum diisi)'}
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Base URL Prod:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs max-w-[200px] truncate">
                    {config?.base_url_prod || '(belum diisi)'}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950 border-dashed border-blue-200 dark:border-blue-800">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Request (Real-time)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Full URL:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-slate-950 text-slate-50 px-2 py-1 rounded text-xs break-all">
                      <Badge className={cn("mr-2", method === "GET" ? "bg-blue-600" : "bg-green-600")}>
                        {method}
                      </Badge>
                      {fullURL || '(URL belum lengkap)'}
                    </code>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(fullURL)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3" />
                  <span className="text-muted-foreground">Timestamp:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {previewTimestamp}
                  </code>
                </div>

                <div>
                  <span className="text-muted-foreground text-xs">Headers yang akan dikirim:</span>
                  <ScrollArea className="h-[100px] rounded border mt-1">
                    <pre className="p-2 text-xs font-mono bg-slate-950 text-slate-50">
                      {JSON.stringify(previewHeaders, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Preset Endpoints */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preset Endpoint</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ENDPOINTS.map((preset, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => selectPreset(preset)}
                  className="text-xs"
                >
                  <Badge variant={preset.method === "GET" ? "secondary" : "default"} className="mr-2 text-[10px]">
                    {preset.method}
                  </Badge>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Request Builder */}
          <div className="grid gap-4 md:grid-cols-[100px_140px_1fr]">
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Environment</Label>
              <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Full URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={fullURL}
                  onChange={(e) => {
                    // Extract endpoint from full URL
                    const url = e.target.value;
                    if (url.includes('/antreanrs_dev')) {
                      const parts = url.split('/antreanrs_dev');
                      setEndpoint(parts[1] || '');
                    } else if (url.includes('/antreanrs')) {
                      const parts = url.split('/antreanrs');
                      setEndpoint(parts[1] || '');
                    } else {
                      setEndpoint(url);
                    }
                  }}
                  placeholder="https://apijkn-dev.bpjs-kesehatan.go.id/antreanrs_dev/ref/poli"
                  className="font-mono text-sm"
                />
                <Button onClick={sendRequest} disabled={loading || !config?.cons_id}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Kirim</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Request Body */}
          {(method === "POST" || method === "PUT") && (
            <div>
              <Label className="text-xs">Request Body (JSON)</Label>
              <Textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder='{"key": "value"}'
                className="font-mono text-sm mt-1 min-h-[150px]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Request Details */}
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="h-4 w-4" />
                Request yang Dikirim
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Config Info */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment:</span>
                  <Badge variant="outline">{result.config.environment}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base URL:</span>
                  <span className="font-mono text-right max-w-[250px] truncate">{result.config.base_url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cons ID:</span>
                  <span className="font-mono">{result.config.cons_id}</span>
                </div>
              </div>

              {/* URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Full URL</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.request.url)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="p-2 bg-slate-950 rounded text-slate-50 font-mono text-xs break-all">
                  <Badge className={cn("mr-2", method === "GET" ? "bg-blue-600" : "bg-green-600")}>
                    {result.request.method}
                  </Badge>
                  {result.request.url}
                </div>
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Headers (dengan Signature)
                  </Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(JSON.stringify(result.request.headers, null, 2))}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="h-[150px] rounded border">
                  <pre className="p-2 text-xs font-mono bg-slate-950 text-slate-50">
                    {JSON.stringify(result.request.headers, null, 2)}
                  </pre>
                </ScrollArea>
              </div>

              {/* Request Body */}
              {result.request.body && (
                <div>
                  <Label className="text-xs">Request Body</Label>
                  <ScrollArea className="h-[100px] rounded border mt-1">
                    <pre className="p-2 text-xs font-mono bg-slate-950 text-slate-50">
                      {formatJSON(result.request.body)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Details */}
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Response dari BPJS
                <Badge variant={result.response.status_code >= 200 && result.response.status_code < 300 ? "outline" : "destructive"} className="ml-auto">
                  {result.response.status_code || 'N/A'}
                </Badge>
                <span className="text-xs text-muted-foreground font-normal">
                  {result.response.duration_ms}ms
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Error */}
              {result.error && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Error:</p>
                  <p className="text-sm text-red-800 dark:text-red-200">{result.error}</p>
                </div>
              )}

              {/* Response Headers */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Response Headers</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(JSON.stringify(result.response.headers, null, 2))}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="h-[200px] rounded border">
                  <pre className="p-2 text-xs font-mono bg-slate-950 text-slate-50 whitespace-pre-wrap">
                    {JSON.stringify(result.response.headers, null, 2)}
                  </pre>
                </ScrollArea>
              </div>

              {/* Response Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Response Body</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.response.body)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="h-[250px] rounded border">
                  <pre className="p-2 text-xs font-mono bg-slate-950 text-slate-50 whitespace-pre-wrap">
                    {formatJSON(result.response.body)}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
