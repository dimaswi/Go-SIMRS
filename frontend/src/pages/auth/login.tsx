import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { authApi, settingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  getSavedAccounts,
  removeSavedAccount,
  touchSavedAccount,
  upsertSavedAccount,
  type SavedAuthAccount,
} from '@/lib/saved-accounts';
import { setPageTitle, getAppName } from '@/lib/page-title';
import { Building2, Loader2, LogIn, Trash2 } from 'lucide-react';

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  return apiUrl.replace(/\/api$/, '');
};

const GRID_SIZE = 40;
const INFLUENCE_RADIUS = 220;

function InteractiveGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouseRef = useRef({ x: -9999, y: -9999 });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        mouseRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(width * dpr);
    const ch = Math.round(height * dpr);

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Smooth mouse follow (lerp)
    const sm = smoothMouseRef.current;
    const tm = mouseRef.current;
    sm.x += (tm.x - sm.x) * 0.15;
    sm.y += (tm.y - sm.y) * 0.15;

    ctx.clearRect(0, 0, width, height);

    const mx = sm.x;
    const my = sm.y;

    const cols = Math.ceil(width / GRID_SIZE) + 1;
    const rows = Math.ceil(height / GRID_SIZE) + 1;

    // --- Static grid lines ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      const x = c * GRID_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * GRID_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // --- Big ambient glow under cursor ---
    if (mx > -1000 && my > -1000) {
      const bigGlow = ctx.createRadialGradient(mx, my, 0, mx, my, INFLUENCE_RADIUS * 1.3);
      bigGlow.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
      bigGlow.addColorStop(0.5, 'rgba(99, 102, 241, 0.03)');
      bigGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = bigGlow;
      ctx.fillRect(0, 0, width, height);
    }

    // --- Interactive grid lines (highlight near cursor) ---
    for (let c = 0; c <= cols; c++) {
      const x = c * GRID_SIZE;
      // Find closest point on this vertical line to cursor
      const clampedY = Math.max(0, Math.min(height, my));
      const vDist = Math.abs(x - mx);
      if (vDist < INFLUENCE_RADIUS) {
        const vt = 1 - vDist / INFLUENCE_RADIUS;
        const alpha = vt * vt * 0.35;
        // Draw a gradient segment around cursor
        const segTop = Math.max(0, clampedY - INFLUENCE_RADIUS);
        const segBot = Math.min(height, clampedY + INFLUENCE_RADIUS);
        const grad = ctx.createLinearGradient(x, segTop, x, segBot);
        grad.addColorStop(0, 'rgba(129, 140, 248, 0)');
        grad.addColorStop(0.5, `rgba(129, 140, 248, ${alpha})`);
        grad.addColorStop(1, 'rgba(129, 140, 248, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, segTop);
        ctx.lineTo(x, segBot);
        ctx.stroke();
      }
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * GRID_SIZE;
      const clampedX = Math.max(0, Math.min(width, mx));
      const hDist = Math.abs(y - my);
      if (hDist < INFLUENCE_RADIUS) {
        const ht = 1 - hDist / INFLUENCE_RADIUS;
        const alpha = ht * ht * 0.35;
        const segLeft = Math.max(0, clampedX - INFLUENCE_RADIUS);
        const segRight = Math.min(width, clampedX + INFLUENCE_RADIUS);
        const grad = ctx.createLinearGradient(segLeft, y, segRight, y);
        grad.addColorStop(0, 'rgba(129, 140, 248, 0)');
        grad.addColorStop(0.5, `rgba(129, 140, 248, ${alpha})`);
        grad.addColorStop(1, 'rgba(129, 140, 248, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(segLeft, y);
        ctx.lineTo(segRight, y);
        ctx.stroke();
      }
    }

    // --- Intersection dots ---
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * GRID_SIZE;
        const y = r * GRID_SIZE;

        const dx = x - mx;
        const dy = y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const t = Math.max(0, 1 - dist / INFLUENCE_RADIUS);
        const ease = t * t;

        const baseRadius = 1.2;
        const baseOpacity = 0.1;

        if (ease > 0.01) {
          const dotRadius = baseRadius + ease * 5;
          const dotOpacity = baseOpacity + ease * 0.9;

          // Glow ring
          const glow = ctx.createRadialGradient(x, y, 0, x, y, dotRadius + 16);
          glow.addColorStop(0, `rgba(129, 140, 248, ${ease * 0.45})`);
          glow.addColorStop(0.4, `rgba(129, 140, 248, ${ease * 0.15})`);
          glow.addColorStop(1, 'rgba(129, 140, 248, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius + 16, 0, Math.PI * 2);
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(199, 210, 254, ${dotOpacity})`;
          ctx.fill();
        } else {
          // Static small dot
          ctx.beginPath();
          ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity})`;
          ctx.fill();
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAuthAccount[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [appName, setAppName] = useState('StarterKits');
  const [appLogo, setAppLogo] = useState('');
  const [appSubtitle, setAppSubtitle] = useState('');

  useEffect(() => {
    setPageTitle('Login');
    loadSettings();
    setSavedAccounts(getSavedAccounts());
  }, []);

  const refreshSavedAccounts = useCallback(() => {
    setSavedAccounts(getSavedAccounts());
  }, []);

  const updateFavicon = (faviconUrl: string) => {
    const BASE_URL = getBaseUrl();
    const fullUrl = faviconUrl.startsWith('http') ? faviconUrl : `${BASE_URL}${faviconUrl}`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = fullUrl;
  };

  const loadSettings = async () => {
    try {
      const response = await settingsApi.getAll();
      const settings = response.data.data;

      if (settings.app_name) {
        setAppName(settings.app_name);
        localStorage.setItem('appName', settings.app_name);
      }
      if (settings.app_subtitle) {
        setAppSubtitle(settings.app_subtitle);
        localStorage.setItem('appSubtitle', settings.app_subtitle);
      }
      if (settings.app_logo) {
        setAppLogo(settings.app_logo);
        localStorage.setItem('appLogo', settings.app_logo);
      }
      if (settings.app_favicon) {
        localStorage.setItem('appFavicon', settings.app_favicon);
        updateFavicon(settings.app_favicon);
      }
    } catch (error) {
      setAppName(getAppName());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      login(response.data.token, response.data.user);
      if (rememberLogin) {
        upsertSavedAccount(response.data.token, response.data.user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (account: SavedAuthAccount) => {
    login(account.token, account.user);
    touchSavedAccount(account.key);
    navigate('/dashboard');
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, accountKey: string) => {
    e.stopPropagation();
    removeSavedAccount(accountKey);
    refreshSavedAccounts();
  };

  const logoEl = (
    <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur border border-white/10 overflow-hidden">
      {appLogo ? (
        <img
          src={appLogo.startsWith('http') ? appLogo : `${getBaseUrl()}${appLogo}`}
          alt="Logo"
          className="size-10 object-contain"
        />
      ) : (
        <Building2 className="size-5 text-white" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Dark with interactive grid */}
      <div className="relative hidden lg:flex lg:w-[55%] bg-gray-950 overflow-hidden">
        <InteractiveGrid />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-gray-950/40 pointer-events-none" />

        {/* Branding content */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full pointer-events-none">
          {/* Top - Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            {logoEl}
            <span className="text-xl font-bold text-white tracking-tight">{appName}</span>
          </motion.div>

          {/* Center - Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="max-w-md"
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Sistem Informasi<br />
              <span className="text-indigo-400">Manajemen</span><br />
              Rumah Sakit
            </h1>
            {appSubtitle && (
              <p className="text-lg text-gray-400 leading-relaxed">
                {appSubtitle}
              </p>
            )}
          </motion.div>

          {/* Bottom - Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-sm text-gray-600"
          >
            &copy; {new Date().getFullYear()} {appName}
          </motion.p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="relative flex-1 flex items-center justify-center bg-background p-6 sm:p-10">
        {/* Mobile: dark bg with grid */}
        <div className="absolute inset-0 lg:hidden bg-gray-950">
          <InteractiveGrid />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/50 to-gray-950/80 pointer-events-none" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:hidden flex items-center gap-3 mb-8 justify-center"
          >
            {logoEl}
            <span className="text-xl font-bold text-white tracking-tight">{appName}</span>
          </motion.div>

          <div className="bg-background/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none rounded-2xl lg:rounded-none p-8 lg:p-0 border border-border/50 lg:border-0">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Selamat datang</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Masukkan kredensial untuk mengakses akun anda
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@simrs.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-login"
                  checked={rememberLogin}
                  onCheckedChange={(checked) => setRememberLogin(checked === true)}
                />
                <Label htmlFor="remember-login" className="text-sm cursor-pointer">
                  Simpan akun ini di perangkat
                </Label>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              {savedAccounts.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Akun Tersimpan
                  </p>
                  <div className="space-y-1.5">
                    {savedAccounts.map((account) => (
                      <div
                        key={account.key}
                        className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{account.user.full_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{account.user.email}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleQuickLogin(account)}
                          >
                            <LogIn className="mr-1 h-3.5 w-3.5" />
                            Masuk
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => handleRemoveSavedAccount(e, account.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Mobile footer */}
          <p className="lg:hidden text-center text-xs text-gray-500 mt-8">
            &copy; {new Date().getFullYear()} {appName}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
