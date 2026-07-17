import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock } from 'lucide-react';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();

  // BARU: kalau AuthContext sudah selesai validasi token dan ternyata user
  // masih login (token valid), langsung lempar ke dashboard tanpa nampilin
  // form login lagi.
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(loginId, password);
      localStorage.setItem('token', data.token);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email/No HP atau password salah');
    } finally {
      setLoading(false);
    }
  };

  // BARU: selama AuthContext masih validasi token ke backend, jangan
  // tampilkan form login dulu — mencegah "kelip" form login sebelum
  // ke-redirect ke dashboard kalau ternyata user masih login.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200')] bg-cover bg-center opacity-20" />
        <div className="relative z-10 flex flex-col justify-center h-full px-16 text-white">
          <h1 className="text-5xl font-extrabold tracking-tight">MARIMAS ONE</h1>
          <p className="mt-6 text-slate-300 text-lg leading-relaxed max-w-md">
            Sistem ERP terintegrasi untuk mempercepat proses kerja,
            monitoring, dan pengambilan keputusan di PT Marimas Putera
            Kencana.
          </p>
        </div>
        <svg
          className="absolute top-0 -right-1 h-full w-32 z-20"
          viewBox="0 0 100 800"
          preserveAspectRatio="none"
        >
          <path fill="#f8fafc">
            <animate
              attributeName="d"
              dur="8s"
              repeatCount="indefinite"
              values="
                M50,0 C20,150 80,300 50,400 C20,500 80,650 50,800 L100,800 L100,0 Z;
                M60,0 C30,150 70,300 60,400 C30,500 70,650 60,800 L100,800 L100,0 Z;
                M50,0 C20,150 80,300 50,400 C20,500 80,650 50,800 L100,800 L100,0 Z
              "
            />
          </path>
        </svg>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-sm font-semibold tracking-widest text-slate-500 mb-6">
            SIGN IN
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                placeholder="Email atau No. HP"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-slate-900 rounded" />
                Remember me
              </label>
              <a href="#" className="text-slate-500 hover:text-slate-900 underline underline-offset-2">
                Forgot password?
              </a>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white text-sm font-semibold tracking-wide py-3.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'MEMPROSES...' : 'LOGIN'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">Belum punya akun?</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Link
            to="/register"
            className="block w-full text-center bg-white border border-slate-300 text-slate-700 text-sm font-semibold tracking-wide py-3.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            DAFTAR AKUN BARU
          </Link>
        </div>
      </div>
    </div>
  );
}