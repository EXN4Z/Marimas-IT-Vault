import type { User } from './user';

export interface Flash {
  success?: string | null;
  error?: string | null;
}

// Props yang selalu ada di SETIAP halaman Inertia (lihat HandleInertiaRequests::share).
export interface SharedProps {
  auth: { user: User | null };
  flash: Flash;
  [key: string]: unknown;
}
