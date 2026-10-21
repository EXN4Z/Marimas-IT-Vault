import { useForm } from '@inertiajs/react';
import { User as UserIcon, Mail, Phone, Save, Bell, BellOff, Lock, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { usePushNotifications } from '../../features/notifications/hooks/usePushNotifications';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  user: 'User', // REVISI (simplify_roles_table): dulu 'hr'/'manajer'/'manager'/'karyawan' 4 entry beda-beda, sekarang cukup 1 karena udah di-merge jadi 'user'
  cabang: 'Cabang',
};

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

// Update profil & ganti password: Inertia useForm -> PUT /settings/profile & /settings/password.
// Error validasi datang lewat props errors; auth.user di shared props ter-update otomatis setelah simpan.
export default function SettingsIndex() {
  const { user } = useAuth();
  const push = usePushNotifications();

  const profile = useForm({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });

  // GANTI PASSWORD -- kartu terpisah dari Profil Saya karena butuh
  // verifikasi current_password & validasi confirmed, beda konteks
  // dari update nama/email/HP yang semuanya opsional.
  const password = useForm({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const isDirty =
    profile.data.name !== (user?.name ?? '') ||
    profile.data.email !== (user?.email ?? '') ||
    profile.data.phone !== (user?.phone ?? '');

  const isPasswordDirty =
    password.data.current_password.length > 0 ||
    password.data.password.length > 0 ||
    password.data.password_confirmation.length > 0;

  const handleSubmit = () => {
    if (!profile.data.name.trim()) {
      toast.error('Nama tidak boleh kosong.');
      return;
    }
    if (!profile.data.email.trim()) {
      toast.error('Email tidak boleh kosong!');
      return;
    }

    // Email/HP kosong tidak dikirim (sama seperti versi axios): dikirim '' akan jadi null di server.
    profile.transform((d) => ({
      name: d.name.trim(),
      email: d.email.trim() || undefined,
      phone: d.phone.trim() || undefined,
    }));

    profile.put('/settings/profile', {
      preserveScroll: true,
      // Toast sukses datang dari flash server (FlashToaster).
      onError: (errors) =>
        toast.error(errors.email || errors.phone || errors.name || 'Gagal memperbarui profil. Coba lagi.'),
    });
  };

  const handlePasswordSubmit = () => {
    if (!password.data.current_password.trim()) {
      toast.error('Password saat ini tidak boleh kosong!');
      return;
    }
    if (password.data.password !== password.data.password_confirmation) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    password.put('/settings/password', {
      preserveScroll: true,
      onSuccess: () => {
        password.reset(); // toast sukses datang dari flash server (FlashToaster)
      },
      onError: (errors) =>
        toast.error(errors.current_password || errors.password || 'Gagal memperbarui password. Coba lagi.'),
    });
  };

  return (
    <>
      <p className="text-sm text-slate-500 mb-6">Kelola informasi akun kamu di sini.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KARTU IDENTITAS */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center h-fit">
          <div className="w-20 h-20 rounded-full bg-slate-900 text-white text-2xl font-bold flex items-center justify-center mb-4">
            {initials(user?.name)}
          </div>
          <p className="text-base font-semibold text-slate-900 break-words">{user?.name}</p>
          <p className="text-sm text-slate-400 mb-3 break-all">{user?.email}</p>
          {user?.role && (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {roleLabels[user.role] ?? user.role}
            </span>
          )}
        </div>

        {/* FORM PROFIL SAYA */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Profil Saya</h3>
          <p className="text-sm text-slate-400 mb-5">Perbarui nama, email, dan nomor HP kamu.</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nama</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.name}
                  onChange={(e) => profile.setData('name', e.target.value)}
                  maxLength={255}
                  placeholder="Nama lengkap"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.name} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.email}
                  onChange={(e) => profile.setData('email', e.target.value)}
                  type="email"
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.email} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">No. HP</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.phone}
                  onChange={(e) => profile.setData('phone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.phone} />
            </div>

            <button
              onClick={handleSubmit}
              disabled={profile.processing || !isDirty}
              className="self-start flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Save size={16} />
              {profile.processing ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>

        {/* FORM GANTI PASSWORD */}
        <div className="lg:col-span-3 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Ganti Password</h3>
          <p className="text-sm text-slate-400 mb-5">
            Pastikan gunakan password yang kuat dan tidak dipakai di tempat lain.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Password Saat Ini</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.current_password}
                  onChange={(e) => password.setData('current_password', e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password sekarang"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={password.errors.current_password} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Password Baru</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.password}
                  onChange={(e) => password.setData('password', e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={password.errors.password} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Konfirmasi Password Baru</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.password_confirmation}
                  onChange={(e) => password.setData('password_confirmation', e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 hidden sm:block">
              Kamu akan tetap login setelah password diganti.
            </p>
            <button
              onClick={handlePasswordSubmit}
              disabled={password.processing || !isPasswordDirty}
              className="ml-auto flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {password.processing ? (
                <Lock size={16} className="animate-pulse" />
              ) : (
                <KeyRound size={16} />
              )}
              {password.processing ? 'Menyimpan...' : 'Ganti Password'}
            </button>
          </div>
        </div>

        {/* NOTIFIKASI PUSH */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-fit lg:col-span-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                {push.isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Notifikasi Push</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Aktifkan supaya kamu tetap dapat notifikasi (misal laporan kerusakan inventory)
                  walau tab/browser lagi ketutup atau lagi di device lain.
                </p>
                {push.status === 'denied' && (
                  <p className="text-xs text-red-500 mt-1">
                    Notifikasi diblokir di browser ini. Aktifkan lewat setting izin situs.
                  </p>
                )}
                {!push.isSupported && (
                  <p className="text-xs text-slate-400 mt-1">Browser ini tidak mendukung push notification.</p>
                )}
              </div>
            </div>

            {push.isSupported && push.status !== 'denied' && (
              <button
                onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
                disabled={push.loading}
                className={
                  'flex-shrink-0 text-sm font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-40 ' +
                  (push.isSubscribed
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800')
                }
              >
                {push.loading ? 'Memproses...' : push.isSubscribed ? 'Matikan' : 'Aktifkan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
