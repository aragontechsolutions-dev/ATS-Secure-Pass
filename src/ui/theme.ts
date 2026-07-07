/** Paleta y tema de la app (claro/oscuro). */
import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  warning: string;
}

const light: Theme = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardAlt: '#F0F3FA',
  border: '#E2E6EF',
  text: '#0B1220',
  muted: '#5B6472',
  accent: '#2F6BFF',
  accentText: '#FFFFFF',
  danger: '#D92D20',
  success: '#12805C',
  warning: '#B54708',
};

const dark: Theme = {
  bg: '#0B1220',
  card: '#131C2E',
  cardAlt: '#1B2740',
  border: '#25314A',
  text: '#EAF0FF',
  muted: '#8A97AD',
  accent: '#4C86FF',
  accentText: '#FFFFFF',
  danger: '#FF6B5E',
  success: '#3DD6A0',
  warning: '#F5A524',
};

/** Devuelve el tema según el esquema de color del sistema. */
export function useTheme(): { theme: Theme; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { theme: isDark ? dark : light, isDark };
}
