'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  systemTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  themes: string[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  systemTheme: 'light',
  setTheme: () => {},
  themes: ['light', 'dark', 'system'],
});

const themeInitScript = `!function(){try{var e=localStorage.getItem('theme')||'system',d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)'),t=e==='system'?(m.matches?'dark':'light'):e;d.classList.remove('light','dark');d.classList.add(t);d.style.colorScheme=t}catch(e){}}()`;

export function useTheme() {
  return useContext(ThemeContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch (error) {
      console.error('Unable to save theme preference.', error);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      setSystemTheme(media.matches ? 'dark' : 'light');
    };
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);

    try {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemeState(storedTheme);
      }
    } catch (error) {
      console.error('Unable to read saved theme preference.', error);
    }

    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      setTheme,
      themes: ['light', 'dark', 'system'],
    }),
    [theme, resolvedTheme, systemTheme, setTheme]
  );

  return (
    <>
      <script
        type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: themeInitScript }}
      />
      <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
    </>
  );
}
