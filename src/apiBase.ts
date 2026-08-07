// Basis-URL für alle API-Aufrufe.
//
// Im Web-Build (iwbees.netlify.app) läuft das Frontend auf derselben Origin wie
// die Netlify Functions, daher bleibt API_BASE leer und apiUrl() gibt einfach
// den relativen Pfad zurück.
//
// Im nativen iOS-Build (Capacitor) läuft die App aus einem lokalen Bundle und hat
// keine gemeinsame Origin mit dem Backend - deshalb wird hier über
// VITE_API_BASE (gesetzt in .env.native) die volle Netlify-URL fest eingebaut.
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
