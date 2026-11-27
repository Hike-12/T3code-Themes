import Image from 'next/image';
import Link from 'next/link';
import localFont from 'next/font/local';
import { SiteNavigation } from './components/site-controls';
import './globals.css';

const instrument = localFont({
  src: [
    { path: '../public/assets/instrument-serif.woff2', style: 'normal', weight: '400' },
    { path: '../public/assets/instrument-serif-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata = {
  title: { default: 'Themes for T3 Code', template: '%s · T3 Code themes' },
  description: 'Preview, customize, and download Koi pond and Dark texture for T3 Code.',
  icons: { icon: '/assets/mark.svg' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f0' },
    { media: '(prefers-color-scheme: dark)', color: '#161a17' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={instrument.variable} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header wrap">
          <Link className="wordmark" href="/">
            <Image src="/assets/mark.svg" width={26} height={26} alt="" unoptimized />
            <span>T3 <span className="wordmark-divider">/</span> themes</span>
          </Link>
          <SiteNavigation />
        </header>
        {children}
        <footer className="site-footer wrap">
          <p>Made by Russel</p>
          <a className="text-link" href="https://github.com/wrestle-R/T3code-Themes">Source on GitHub <span aria-hidden="true">↗</span></a>
        </footer>
      </body>
    </html>
  );
}
