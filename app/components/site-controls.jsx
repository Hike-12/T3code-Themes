'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const modeKey = 't3-themes-site-mode';

function SiteAppearance() {
  const [dark, setDark] = useState(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const followPreference = () => {
      let saved;
      try {
        saved = window.localStorage.getItem(modeKey);
      } catch {
        // The toggle also works when storage is unavailable.
      }
      setDark(saved === 'dark' || (saved !== 'light' && preference.matches));
    };
    followPreference();
    preference.addEventListener('change', followPreference);
    return () => preference.removeEventListener('change', followPreference);
  }, []);

  useEffect(() => {
    if (dark != null) document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
  }, [dark]);

  function toggleAppearance() {
    const next = !dark;
    setDark(next);
    try {
      window.localStorage.setItem(modeKey, next ? 'dark' : 'light');
    } catch {
      // The current page still uses the selected appearance.
    }
  }

  return (
    <button className="site-mode" type="button" aria-label="Dark site appearance" aria-pressed={dark ?? false} onClick={toggleAppearance}>
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}

export function SiteNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      <Link href="/#themes" aria-current={pathname === '/' ? 'location' : undefined}>Collection</Link>
      <Link href="/koi-pond" aria-current={pathname === '/koi-pond' ? 'page' : undefined}>Koi pond</Link>
      <Link href="/dark-texture" aria-current={pathname === '/dark-texture' ? 'page' : undefined}>Dark texture</Link>
      <SiteAppearance />
    </nav>
  );
}
