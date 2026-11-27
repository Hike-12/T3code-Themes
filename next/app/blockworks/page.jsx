import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

export const metadata = {
  title: themes.blockworks.name,
  description: themes.blockworks.studioDescription,
};

export default function BlockworksPage() {
  return <ThemeStudio slug="blockworks" />;
}
