/**
 * Resolves API endpoint URLs across both Web/PWA (relative `/api/...`)
 * and native Capacitor Android APK builds (using VITE_API_BASE_URL or deployed Cloud Run backend).
 */
const DEFAULT_NATIVE_API_BASE =
  'https://ais-pre-znt5coeee2dugrkqz23d52-867516947968.asia-northeast1.run.app';

export function isNativeCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return window.location.protocol === 'capacitor:';
}

export function getApiBaseUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL
      ? String((import.meta as any).env.VITE_API_BASE_URL).trim()
      : '';

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (isNativeCapacitorRuntime()) {
    return DEFAULT_NATIVE_API_BASE;
  }

  return '';
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
