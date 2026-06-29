import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, FileText, User, Calendar, Hash, Building2, BadgeCheck } from 'lucide-react';
import { settingsApi } from '@/lib/api';

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};

interface SignerDetail {
  name: string;
  role: string;
  date: string;
  hash: string;
}

interface VerifyResult {
  valid: boolean;
  message: string;
  document_type?: string;
  signed_at?: string;
  signer_name?: string;
  signer_nip?: string;
  signer_str?: string;
  signer_role?: string;
  signature_hash?: string;
  patient_name?: string;
  patient_mr?: string;
  signers?: SignerDetail[];
}

const documentTypeLabels: Record<string, string> = {
  visit_resume: 'Resume Kunjungan',
  prescription: 'Resep Obat',
  lab_result: 'Hasil Laboratorium',
  radiology_result: 'Hasil Radiologi',
  sick_letter: 'Surat Sakit',
  death_certificate: 'Surat Kematian',
  referral_letter: 'Surat Rujukan',
  inpatient_cert: 'Surat Keterangan Rawat Inap',
  emergency_summary: 'Ringkasan IGD',
  medical_record: 'Rekam Medis',
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

export default function VerifySignaturePage() {
  const { hash } = useParams<{ hash: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');
  const [appName, setAppName] = useState('');
  const [appSubtitle, setAppSubtitle] = useState('');
  const [appLogo, setAppLogo] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_subtitle) setAppSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!hash) {
      setError('Hash verifikasi tidak ditemukan');
      setLoading(false);
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8080/api` : 'http://localhost:8080/api');
    fetch(`${apiBase}/signature/verify/${hash}`)
      .then((res) => res.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal menghubungi server verifikasi');
        setLoading(false);
      });
  }, [hash]);

  const logoUrl = appLogo
    ? appLogo.startsWith('http') ? appLogo : `${getBaseUrl()}${appLogo}`
    : '';

  const isValid = result?.valid;

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <Loader2 className="h-16 w-16 animate-spin text-emerald-600" />
            <ShieldCheck className="h-6 w-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-500 font-medium">Memverifikasi tanda tangan digital...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* ─── Top Bar ─── */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 object-contain rounded-lg" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{appName || 'SIMRS'}</h1>
            {appSubtitle && (
              <p className="text-xs text-slate-500 truncate">{appSubtitle}</p>
            )}
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-5">

          {/* ─── Error State ─── */}
          {error && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-red-100">
              <div className="bg-red-50 px-6 py-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-red-900">Verifikasi Gagal</h2>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* ─── Result ─── */}
          {result && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
              {/* Status Banner */}
              <div className={`px-6 py-6 ${isValid ? 'bg-emerald-600' : 'bg-red-600'}`}>
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${isValid ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {isValid ? (
                      <CheckCircle2 className="h-7 w-7 text-white" />
                    ) : (
                      <XCircle className="h-7 w-7 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isValid ? 'Tanda Tangan Valid' : 'Tanda Tangan Tidak Valid'}
                    </h2>
                    <p className="text-sm text-white/80">{result.message}</p>
                  </div>
                </div>
              </div>

              {isValid && (
                <div className="divide-y divide-slate-100">
                  {/* Section Header */}
                  <div className="px-6 py-3 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wide">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Detail Verifikasi
                    </div>
                  </div>

                  {/* Document Type */}
                  {result.document_type && (
                    <div className="px-6 py-4 flex items-start gap-4">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Jenis Dokumen</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          {documentTypeLabels[result.document_type] || result.document_type}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Signers */}
                  {result.signers && result.signers.length > 0 ? (
                    <div className="px-6 py-4">
                      <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Daftar Penanda Tangan</p>
                      <div className="space-y-3">
                        {result.signers.map((s, idx) => (
                          <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border ${s.hash === result.signature_hash ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200/60'}`}>
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.hash === result.signature_hash ? 'bg-emerald-100 text-emerald-600' : 'bg-white shadow-sm border border-slate-200 text-slate-500'}`}>
                              <User className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                                  {s.role && <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mt-0.5">{s.role}</p>}
                                </div>
                                {s.hash === result.signature_hash && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Scanned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{formatDate(s.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-mono text-slate-400">
                                <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{s.hash.substring(0, 32)}...</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Signer */}
                      {result.signer_name && (
                        <div className="px-6 py-4 flex items-start gap-4">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Ditandatangani Oleh</p>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5">{result.signer_name}</p>
                            {result.signer_role && (
                              <p className="text-xs text-slate-500">{result.signer_role}</p>
                            )}
                            {result.signer_nip && (
                              <p className="text-xs text-slate-400 mt-1">NIP: {result.signer_nip}</p>
                            )}
                            {result.signer_str && (
                              <p className="text-xs text-slate-400">STR: {result.signer_str}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Signed Date */}
                      {result.signed_at && (
                        <div className="px-6 py-4 flex items-start gap-4">
                          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <Calendar className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Tanggal Tanda Tangan</p>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(result.signed_at)}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Patient */}
                  {result.patient_name && (
                    <div className="px-6 py-4 flex items-start gap-4">
                      <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Pasien</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{result.patient_name}</p>
                        {result.patient_mr && (
                          <p className="text-xs text-slate-400">No. RM: {result.patient_mr}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hash */}
                  {result.signature_hash && (
                    <div className="px-6 py-4 flex items-start gap-4">
                      <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Hash className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-400 font-medium">Hash Dokumen</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-1 break-all leading-relaxed bg-slate-50 rounded px-2 py-1.5">
                          {result.signature_hash}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="py-4 text-center">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} {appName || 'SIMRS'}. Verifikasi Tanda Tangan Digital.
        </p>
      </footer>
    </div>
  );
}
