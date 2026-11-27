import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

export const metadata = {
  title: themes['koi-pond'].name,
  description: themes['koi-pond'].studioDescription,
};

export default function KoiPondPage() {
  return <ThemeStudio slug="koi-pond" />;
}
