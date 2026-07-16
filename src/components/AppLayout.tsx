import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  QrCode,
  Ticket,
  BarChart3,
  Bot,
  ScrollText,
  Settings as SettingsIcon,
  FileText,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import api from '../api/axios';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string | null; // null = belum ada halamannya, tampil tapi non-aktif
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Data Karyawan', icon: Users, path: '/karyawan' },
  { label: 'Absensi QR', icon: QrCode, path: '/absensi' },
  { label: 'Pengajuan Izin', icon: FileText, path: '/izin' },
  { label: 'Ticketing', icon: Ticket, path: '/ticketing' },
  { label: 'Inventaris', icon: Package, path: '/inventaris' },
  { label: 'Dashboard Analytics', icon: BarChart3, path: '/dashboard-analytics' },
  { label: 'AI Assistant', icon: Bot, path: '/ai-assistant' },
  { label: 'Audit Log', icon: ScrollText, path: '/audit-log' },
  { label: 'Laporan', icon: FileText, path: '/laporan' },
  {label: 'Agenda', icon: FileText, path: '/agenda' },
  { label: 'Payroll', icon: FileText, path: '/payroll' },
  { label: 'Master Data', icon: FileText, path: '/master-data' },
  { label: 'Segera Hadir', icon: FileText, path: null }, // Placeholder untuk fitur yang belum ada
  { label: 'Settings', icon: SettingsIcon, path: '/settings' },
];

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface AppLayoutProps {
  title: string;
  children: ReactNode;
}

export default function AppLayout({ title, children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { resetChat } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const visibleNavItems = navItems.filter((item) => {
  // Audit Log hanya untuk admin
  if (item.label === 'Audit Log' && user?.role !== 'admin') {
    return false;
  }
  else if (item.label === 'Dashboard Analytics' && user?.role === 'karyawan') {
    return false;
  }

  return true;
  });

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Logout di server gagal, lanjut clear session lokal.', err);
    } finally {
      resetChat();
      logout();
      navigate('/login', { replace: true });
    }
  };

  const handleNavClick = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ===== MOBILE OVERLAY ===== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight">MARIMAS ONE</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === location.pathname;
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                disabled={isDisabled}
                title={isDisabled ? 'Segera hadir' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div className="flex-1 min-w-0">
        {/* TOPBAR */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
              <Menu size={22} />
            </button>
            <h1 className="text-xl font-bold text-slate-900 hidden sm:block">{title}</h1>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-sm mx-6 relative">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              placeholder="Cari sesuatu..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <Bell size={16} />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">
                2
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                {initials(user?.name)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-xs text-slate-400 leading-tight">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}