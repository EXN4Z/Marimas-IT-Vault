import {
  LayoutDashboard,
  ScrollText,
  Settings as SettingsIcon,
  Package,
  FileSpreadsheet,
  Database,
  Building2,
  Truck,
  Wrench,
  Images,
  History,
  Tags,
  Users,
} from 'lucide-react';

export interface NavChild {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles?: string[];
}

export interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string | null;
  children?: NavChild[];
  matchPrefix?: string | string[];
  restricted?: boolean;
  hidden?: boolean;
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Transaksi',
    icon: Package,
    path: null,
    matchPrefix: '/penanganan-inventory',
    children: [
      { label: 'Penanganan Inventory', icon: Wrench, path: '/penanganan-inventory', roles: ['user', 'admin'] },
    ],
  },
  {
    label: 'Laporan',
    icon: FileSpreadsheet,
    path: null,
    matchPrefix: '/laporan',
    restricted: true,
    children: [
      { label: 'Export Data', icon: FileSpreadsheet, path: '/laporan?tab=export_data' },
      { label: 'Foto Inventory', icon: Images, path: '/laporan?tab=foto_inventory', roles: ['admin'] },
      { label: 'Riwayat Inventory', icon: History, path: '/laporan?tab=riwayat_inventory' },
    ],
  },
  {
    label: 'Master Data',
    icon: Database,
    path: null,
    matchPrefix: ['/master-data', '/karyawan', '/cabang'],
    restricted: true,
    children: [
      { label: 'Inventory', icon: Package, path: '/master-data?tab=inventory' },
      { label: 'Kategori', icon: Tags, path: '/master-data?tab=kategori', roles: ['admin'] },
      { label: 'Data User', icon: Users, path: '/master-data?tab=karyawan', roles: ['admin'] },
      { label: 'Cabang', icon: Building2, path: '/master-data?tab=cabang', roles: ['admin'] },
      { label: 'Perusahaan', icon: Building2, path: '/master-data?tab=perusahaan', roles: ['admin'] },
      { label: 'Departemen', icon: Building2, path: '/master-data?tab=departemen', roles: ['admin'] },
      { label: 'Supplier', icon: Truck, path: '/master-data?tab=supplier', roles: ['admin'] },
    ],
  },
  { label: 'Audit Log', icon: ScrollText, path: '/audit-log', restricted: true },
  { label: 'Settings', icon: SettingsIcon, path: '/settings' },
];

export function interleaveByChildren(items: NavItem[]): NavItem[] {
  const noChild = items.filter((i) => !i.children);
  const withChild = items.filter((i) => i.children);
  const merged: NavItem[] = [];
  const maxLen = Math.max(noChild.length, withChild.length);
  for (let i = 0; i < maxLen; i++) {
    if (noChild[i]) merged.push(noChild[i]);
    if (withChild[i]) merged.push(withChild[i]);
  }
  return merged;
}

export function matchesPrefix(pathname: string, prefix?: string | string[]): boolean {
  if (!prefix) return false;
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  return prefixes.some((p) => pathname.startsWith(p));
}

export function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const INVENTORY_ROLES = ['user', 'admin'];
