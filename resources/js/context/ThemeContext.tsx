import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  // Kirim elemen tombol (origin) supaya animasi circle-spread menyebar dari tombol itu.
  // Tanpa origin -> ganti tema langsung tanpa animasi.
  // duration (ms) opsional; default DEFAULT_DURATION.
  toggleTheme: (origin?: HTMLElement | null, duration?: number) => void;
  setTheme: (theme: Theme, origin?: HTMLElement | null, duration?: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Durasi animasi default (ms) untuk semua halaman, kecuali yang mengirim durasi sendiri.
const DEFAULT_DURATION = 800;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

// Matikan crossfade bawaan View Transitions selama transisi berjalan,
// supaya hanya animasi circle-spread yang terlihat.
function addTransitionStyle() {
  const style = document.createElement('style');
  style.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
  `;
  document.head.appendChild(style);
  return style;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const changeTheme = useCallback(
    (next: Theme, origin?: HTMLElement | null, duration: number = DEFAULT_DURATION) => {
      if (next === theme) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Fallback: tanpa titik asal, reduced-motion, atau browser tanpa View Transitions API.
      if (!origin || reduceMotion || typeof document.startViewTransition !== 'function') {
        setThemeState(next);
        return;
      }

      const rect = origin.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      const style = addTransitionStyle();

      const transition = document.startViewTransition(() => {
        flushSync(() => setThemeState(next));
        applyTheme(next);
      });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
            },
            {
              duration,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        })
        .catch(() => {
          /* transisi dibatalkan -> abaikan */
        });

      transition.finished.finally(() => style.remove());
    },
    [theme],
  );

  const toggleTheme = (origin?: HTMLElement | null, duration?: number) =>
    changeTheme(theme === 'dark' ? 'light' : 'dark', origin, duration);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}