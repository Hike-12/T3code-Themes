import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, SlidersHorizontal } from 'lucide-react';
import { GalleryPreview } from './components/theme-preview';
import { DownloadAction } from './components/ui';
import { themes } from './themes';

export default function Collection() {
  return (
    <main id="main">
      <section id="themes" className="gallery wrap" aria-labelledby="gallery-title">
        <header className="collection-bar">
          <div>
            <h1 id="gallery-title">Theme collection</h1>
            <p>Themes I made for my T3 Code setup.</p>
          </div>
          <a className="text-link" href="#install">How to install <ArrowDown size={15} aria-hidden="true" /></a>
        </header>
        <div className="theme-grid">
          {['koi-pond', 'nightfall-christmas', 'blockworks', 'margin-notes', 'dark-texture'].map(slug => [slug, themes[slug]]).map(([slug, theme]) => (
            <article className="theme" aria-labelledby={slug + '-title'} key={slug}>
              <div className="theme-info">
                <header>
                  <h2 id={slug + '-title'}>{theme.name}</h2>
                  <p>{theme.description}</p>
                </header>
                {slug === 'koi-pond' && (
                  <div className="theme-art">
                    <Image src="/assets/koi-cover.webp" alt="Koi swimming through rippled water" fill sizes="(max-width: 700px) 90vw, 340px" preload />
                  </div>
                )}
                <div className="theme-actions">
                  <Link className="open-theme" href={'/' + slug}><SlidersHorizontal size={15} aria-hidden="true" /> {theme.action}</Link>
                  <DownloadAction href={theme.download} />
                </div>
              </div>
              <GalleryPreview slug={slug} />
            </article>
          ))}
        </div>
      </section>

      <section id="install" className="install wrap" aria-labelledby="install-title">
        <h2 id="install-title">Install a theme</h2>
        <ol className="install-steps">
          <li><strong>Download</strong><span>Get the JSON for any theme, or customize it and download your version.</span></li>
          <li><strong>Import</strong><span>In T3 Code, go to <b>Settings → Appearance</b> and choose <b>Import a file</b>.</span></li>
          <li><strong>Apply</strong><span>Open your JSON and select the theme in the picker.</span></li>
        </ol>
        <p className="install-note">Switch between Light and Dark in <strong>Settings → Appearance</strong>.</p>
      </section>

      <section id="about" className="about wrap" aria-labelledby="about-title">
        <h2 id="about-title">Share a theme</h2>
        <p>Made a theme you’d like to share? <a href="https://github.com/wrestle-R/T3code-Themes/pulls">Open a pull request</a> with the theme file and any images it uses.</p>
      </section>
    </main>
  );
}
