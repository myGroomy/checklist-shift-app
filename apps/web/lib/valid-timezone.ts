/**
 * Validasi zona waktu IANA (mis. Asia/Jakarta).
 * Dipakai oleh CRUD Branches (Fase 3a).
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    // Memicu exception jika zona tidak dikenal
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
  } catch {
    return false;
  }
  // Batasi ke daftar resmi IANA bila tersedia di runtime
  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf?.('timeZone');
  if (supported) {
    return tz === 'UTC' || supported.includes(tz);
  }
  return true;
}
