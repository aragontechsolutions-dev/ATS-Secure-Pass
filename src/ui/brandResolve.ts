/**
 * Resolución de marca a partir del título/URL (lógica pura, testeable).
 * No importa react-native-svg, así que se puede ejecutar en Node.
 */
import { BRAND_ICONS, type BrandIconData } from './brandData';

/** Alias → clave de marca (solo surte efecto si la clave existe en el set). */
const ALIASES: Record<string, string> = {
  googlemail: 'gmail',
  correo: 'gmail',
  ig: 'instagram',
  insta: 'instagram',
  fb: 'facebook',
  wa: 'whatsapp',
  tg: 'telegram',
  yt: 'youtube',
  ps: 'playstation',
  psn: 'playstation',
  so: 'stackoverflow',
  gh: 'github',
  mp: 'mercadopago',
};

/** Resuelve la marca por tokens exactos del título y la URL, o `null`. */
export function resolveBrand(title: string, url?: string | null): BrandIconData | null {
  const tokens = `${title} ${url ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const token of tokens) {
    if (BRAND_ICONS[token]) return BRAND_ICONS[token];
    const aliased = ALIASES[token];
    if (aliased && BRAND_ICONS[aliased]) return BRAND_ICONS[aliased];
  }
  return null;
}

/** Luminancia relativa aproximada de un color hex de 6 dígitos (0..1). */
export function luminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const AVATAR_PALETTE = ['#2F6BFF', '#12805C', '#B54708', '#7A3EF0', '#0E7490', '#B42318', '#5B21B6'];

/** Color de fondo estable para el avatar de letra, derivado del nombre. */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
