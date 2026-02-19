import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { patientPortalApi, patientPortalAuth } from '@/lib/api/patient-portal';
import { settingsApi } from '@/lib/api';
import { Building2, FileText, Loader2, AlertCircle, Heart, Calendar, CreditCard } from 'lucide-react';

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};

export default function PatientPortalLogin() {
  const navigate = useNavigate();
  const [noRM, setNoRM] = useState('');
  const [nik, setNik] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [appName, setAppName] = useState('Portal Pasien');
  const [appLogo, setAppLogo] = useState('');

  useEffect(() => {
    document.title = 'Portal Pasien - Rekam Medis Online';
    loadSettings();

    // Check if already authenticated
    if (patientPortalAuth.isAuthenticated()) {
      navigate('/portal/dashboard');
    }
  }, [navigate]);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.getAll();
      const settings = response.data.data;

      if (settings.app_name) {
        setAppName(settings.app_name);
      }
      if (settings.app_logo) {
        setAppLogo(settings.app_logo);
      }
    } catch {
      // Use default
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!noRM || !nik || !tanggalLahir) {
      setError('Semua field harus diisi');
      return;
    }

    setLoading(true);

    try {
      const response = await patientPortalApi.login({
        no_rm: noRM,
        nik: nik,
        tanggal_lahir: tanggalLahir,
      });

      patientPortalAuth.setToken(response.data.token);
      patientPortalAuth.setPatient(response.data.patient);
      navigate('/portal/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Gagal masuk. Periksa kembali data Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground overflow-hidden">
              {appLogo ? (
                <img
                  src={appLogo.startsWith('http') ? appLogo : `${getBaseUrl()}${appLogo}`}
                  alt="Logo"
                  className="size-10 object-contain"
                />
              ) : (
                <Building2 className="size-5" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{appName}</h1>
              <p className="text-xs text-muted-foreground">Portal Pasien</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Side - Info */}
          <div className="space-y-6 lg:pr-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                Akses Rekam Medis Anda
                <span className="text-primary"> Kapan Saja</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Lihat riwayat kunjungan, resume medis, dan informasi kesehatan Anda secara online dengan aman dan mudah.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border">
                <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">Riwayat Kunjungan</h3>
                  <p className="text-sm text-muted-foreground">Lihat semua kunjungan ke rumah sakit</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border">
                <div className="p-2 rounded-md bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                  <Heart className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">Resume Medis</h3>
                  <p className="text-sm text-muted-foreground">Diagnosa, obat, dan tindakan</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border">
                <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">Jadwal Kontrol</h3>
                  <p className="text-sm text-muted-foreground">Pantau jadwal kontrol berikutnya</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border">
                <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">Data BPJS</h3>
                  <p className="text-sm text-muted-foreground">Informasi kepesertaan BPJS</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
              <CardHeader className="space-y-1 text-center pb-4">
                <CardTitle className="text-2xl">Masuk ke Portal Pasien</CardTitle>
                <CardDescription>
                  Masukkan data Anda untuk mengakses rekam medis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="noRM">Nomor Rekam Medis (No. RM)</Label>
                    <Input
                      id="noRM"
                      type="text"
                      placeholder="Contoh: 000001"
                      value={noRM}
                      onChange={(e) => setNoRM(e.target.value)}
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK (Nomor Induk Kependudukan)</Label>
                    <Input
                      id="nik"
                      type="text"
                      placeholder="Masukkan 16 digit NIK"
                      value={nik}
                      onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      disabled={loading}
                      maxLength={16}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tanggalLahir">Tanggal Lahir</Label>
                    <Input
                      id="tanggalLahir"
                      type="date"
                      value={tanggalLahir}
                      onChange={(e) => setTanggalLahir(e.target.value)}
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memverifikasi...
                      </>
                    ) : (
                      'Masuk'
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground pt-2">
                    Dengan masuk, Anda menyetujui{' '}
                    <a href="#" className="text-primary hover:underline">Syarat & Ketentuan</a>
                    {' '}dan{' '}
                    <a href="#" className="text-primary hover:underline">Kebijakan Privasi</a>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
        <div className="container mx-auto py-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {appName}. Semua hak dilindungi.</p>
          <p className="mt-1">Data rekam medis Anda dilindungi sesuai UU Kesehatan dan GDPR.</p>
        </div>
      </footer>
    </div>
  );
}
