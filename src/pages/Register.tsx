import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, Lock } from 'lucide-react';
import { register } from '../api/auth';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(name, email, phone, password, passwordConfirmation);
      navigate('/verify-otp', { state: { registrationId: data.registration_id } });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registrasi gagal';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200')] bg-cover bg-center opacity-20" />

        <div className="relative z-10 flex flex-col justify-center h-full px-16 text-white">
          <h1 className="text-5xl font-extrabold tracking-tight">MARIMAS ONE</h1>
          <p className="mt-6 text-slate-300 text-lg leading-relaxed max-w-md">
            Bergabung dan mulai kelola aktivitas kerja kamu lewat satu
            platform terintegrasi — izin, ticketing, hingga absensi.
          </p>
        </div>

        {/* WAVE DIVIDER */}
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
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-sm font-semibold tracking-widest text-slate-500 mb-6">
            DAFTAR AKUN
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nama Lengkap"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="08xxxxxxxxxx"
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

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                placeholder="Konfirmasi Password"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
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
              {loading ? 'MEMPROSES...' : 'DAFTAR'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">Sudah punya akun?</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Link
            to="/login"
            className="block w-full text-center bg-white border border-slate-300 text-slate-700 text-sm font-semibold tracking-wide py-3.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}