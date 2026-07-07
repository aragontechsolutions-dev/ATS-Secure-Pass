/**
 * Búsqueda y paginación de credenciales (lógica pura, testeable).
 * Genérica sobre la forma mínima necesaria; no importa código nativo.
 */
export interface SearchableCredential {
  title: string;
  username?: string | null;
  url?: string | null;
}

/** Filtra por coincidencia (case-insensitive) en título, usuario o URL. */
export function filterCredentials<T extends SearchableCredential>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      (c.username ? c.username.toLowerCase().includes(q) : false) ||
      (c.url ? c.url.toLowerCase().includes(q) : false)
  );
}

/** Número de páginas para `total` elementos (mínimo 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Ajusta `page` al rango válido [1, pageCount]. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const pages = pageCount(total, pageSize);
  return Math.min(Math.max(1, page), pages);
}

/** Devuelve la porción de `list` correspondiente a `page` (1-indexado). */
export function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, list.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return list.slice(start, start + pageSize);
}
