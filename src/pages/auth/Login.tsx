import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Lock,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { login } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Skeleton } from '../../components/shared/skeleton';
import '../../index.css';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, isLoading, setUser } = useAuth();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;
    navigate('/dashboard', { replace: true });
  }, [isLoading, user, navigate]);

  useEffect(() => {
    const state = location.state as { passwordReset?: boolean } | null;
    if (state?.passwordReset) {
      toast('Password telah diganti, silahkan cek email Anda.', {
        icon: '🔒',
        duration: 4000,
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(loginId, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email/No HP/Nama atau password salah');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-[#121214]">
        <div className="hidden lg:block lg:w-1/2 bg-slate-900" />
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-6 w-32 rounded mb-6" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#121214] text-slate-900 dark:text-zinc-100 transition-colors">
      {/* LEFT PANEL: Modern Corporate Office Supply & Inventory Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-10 xl:p-14 overflow-hidden bg-slate-900">
        {/* Full-bleed Inventory Supply Room Image */}
        <img
          src="/login-bg.jpg"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://img.magnific.com/premium-photo/visual-office-with-wellorganized-supply-room-including-inventory-management-office-sup_1314467-60091.jpg';
          }}
          alt="Office Supply & Inventory Room"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Clean soft ambient gradient for text contrast - NO glass, NO boxes */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-slate-950/60 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
            MARIMAS ONE
          </h2>
          <p className="text-xs text-white/90 drop-shadow-sm font-medium mt-0.5">
            Integrated Inventory Management System
          </p>
        </div>

        {/* Center Content: Clean Typography directly over image (NO glass box, NO container) */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            Sistem Tata Kelola Inventory & Operasional Terpadu
          </h1>
          <p className="mt-4 text-white text-sm leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] font-medium max-w-lg">
            Platform terpadu untuk pencatatan data, serah terima unit, penomoran kode barang,
            serta monitoring status dan riwayat inventaris di seluruh departemen dan cabang PT Marimas Putera Kencana.
          </p>
        </div>

        {/* Footer info & status (Clean inline text, NO glass box) */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#22c55e]" />
            <span className="font-semibold drop-shadow-md">Server Online & Beroperasi Normal</span>
          </div>
          <span className="text-white/90 drop-shadow-md font-medium">© 2026 PT Marimas Putera Kencana</span>
        </div>
      </div>

      {/* RIGHT PANEL: Modern Authentication Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile Brand */}
          <div className="lg:hidden mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              MARIMAS ONE
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Sistem Pengelolaan Inventory Terpadu
            </p>
          </div>

          {/* Form Card Container */}
          <div className="bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-[#27272a] shadow-xl dark:shadow-2xl rounded-2xl p-7 sm:p-9">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Selamat Datang
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Masukkan kredensial akun Anda untuk mengakses sistem.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Login ID Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  ID Pengguna / Email
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                    placeholder="Email, No. HP, atau Nama"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Password Input with Visibility Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 transition"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error Message Alert */}
              {error && (
                <div className="text-xs text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl px-3.5 py-2.5 animate-[fadeIn_150ms_ease-out]">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-[#18181b] px-2 text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[10px] font-medium">
                  Pilihan Tampilan
                </span>
              </div>
            </div>

            {/* TOMBOL GANTI TEMA TERANG / GELAP (Di bawah tombol login) */}
            <div>
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    !isDark
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sun size={14} className={!isDark ? 'text-amber-500' : 'text-slate-400'} />
                  <span>Mode Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isDark
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Moon size={14} className={isDark ? 'text-blue-400' : 'text-slate-400'} />
                  <span>Mode Gelap</span>
                </button>
              </div>
            </div>

            {/* Security footnote */}
            <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-zinc-500 leading-normal">
              Akses terbatas hanya untuk staf & karyawan berwenang PT Marimas Putera Kencana.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
