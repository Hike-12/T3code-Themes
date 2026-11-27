import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

const theme = themes['nightfall-christmas'];
export const metadata = { title: theme.name, description: theme.studioDescription };

export default function NightfallChristmasPage() {
  return <ThemeStudio slug="nightfall-christmas" />;
}
