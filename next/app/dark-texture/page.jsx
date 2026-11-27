import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

export const metadata = {
  title: themes['dark-texture'].name,
  description: themes['dark-texture'].studioDescription,
};

export default function DarkTexturePage() {
  return <ThemeStudio slug="dark-texture" />;
}
