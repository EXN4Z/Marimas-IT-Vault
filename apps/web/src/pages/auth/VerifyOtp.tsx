import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp, resendOtp } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

export default function VerifyOtp() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const registrationId = location.state?.registrationId;

  useEffect(() => {
    if (!registrationId) {
      navigate('/register');
    }
  }, [registrationId, navigate]);

  if (!registrationId) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp(registrationId, otp);
      localStorage.setItem('token', data.token);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kode OTP salah atau kedaluwarsa');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    try {
      await resendOtp(registrationId);
      setResendMsg('Kode OTP baru sudah dikirim ke email kamu');
    } catch {
      setResendMsg('Gagal mengirim ulang OTP');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Verifikasi Email</h1>
          <p className="text-sm text-slate-500 mt-1">
            Masukkan kode 6 digit yang dikirim ke email kamu
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              placeholder="123456"
              className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </form>

          <button
            onClick={handleResend}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-900 mt-4 underline"
          >
            Kirim ulang kode
          </button>
          {resendMsg && <p className="text-xs text-center text-slate-500 mt-2">{resendMsg}</p>}
        </div>
      </div>
    </div>
  );
}
