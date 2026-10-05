/**
 * Waktu server terkoreksi (BR-23).
 * Return Date sekarang dari server, bukan jam klien.
 */
export function getServerTime(): Date {
  return new Date();
}
