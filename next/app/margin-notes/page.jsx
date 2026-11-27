import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GalleryPreview } from '../components/theme-preview';
import { DownloadAction } from '../components/ui';
import { themes } from '../themes';
import '../studio.css';

const theme = themes['margin-notes'];
export const metadata = { title: theme.name, description: theme.studioDescription };

export default function MarginNotesPage() {
  return (
    <main className="wrap studio" id="main">
      <header className="studio-intro">
        <div>
          <Link href="/#themes" className="text-link back-link"><ArrowLeft size={16} aria-hidden="true" /> Collection</Link>
          <h1>{theme.name}</h1>
          <p>{theme.studioDescription}</p>
        </div>
        <DownloadAction href={theme.download} />
      </header>
      <GalleryPreview slug="margin-notes" />
      <section className="studio-note" aria-labelledby="install-title">
        <h2 id="install-title">Install Margin Notes</h2>
        <ol>
          <li>Download the original JSON.</li>
          <li>In T3 Code, open <strong>Settings → Appearance</strong> and choose <strong>Import a file</strong>.</li>
          <li>Open the JSON and select <strong>Margin Notes</strong> in the theme picker.</li>
        </ol>
        <p>Switch between Light and Dark in Settings → Appearance. A crimson bookmark appears while subagents work.</p>
      </section>
    </main>
  );
}
