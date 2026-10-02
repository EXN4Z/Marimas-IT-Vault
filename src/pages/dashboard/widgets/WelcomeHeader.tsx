import type { User as UserType } from '../../../types/user';

const GREETING_ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  user: 'Staff / Karyawan', // REVISI (simplify_roles_table): dulu 'hr'/'manajer'/'karyawan' 3 entry beda-beda, sekarang cukup 1 karena udah di-merge jadi 'user'
  cabang: 'Staff Cabang',
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function WelcomeHeader({ user, action }: { user?: UserType | null; action?: React.ReactNode }) {
  if (!user) return null;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user.name?.split(' ')[0] ?? user.name;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#171633] dark:text-white leading-tight">
            {greetingWord()}, {firstName}!
          </h2>
          <p className="text-xs text-[#A9A9C6] dark:text-zinc-400 font-medium capitalize mt-1">{today}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-white bg-[#171633] dark:bg-zinc-800 dark:border dark:border-zinc-700 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xs">
          {GREETING_ROLE_LABEL[user.role] ?? user.role}
        </span>
        {user.departemen?.nama && (
          <span className="text-[11px] font-medium text-[#666687] bg-white dark:bg-zinc-800/90 dark:text-zinc-200 dark:border dark:border-zinc-700 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-[0_2px_8px_rgba(23,22,51,0.06)] dark:shadow-none">
            {user.departemen.nama}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#34A853] bg-[#E7F6EC] dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-700/50 px-3 py-1.5 rounded-lg shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] dark:bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.9)] animate-pulse shrink-0" />
          Online
        </span>
      </div>
    </div>
  );
}
