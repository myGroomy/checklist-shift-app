/**
 * Utilitas waktu shift berbasis zona waktu cabang (BR-02, BR-23).
 * Semua perhitungan memakai waktu server; tanggal & jam ditampilkan sesuai zona cabang.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export type DayKey = (typeof DAY_KEYS)[number];

interface ZonedParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  minutes: number; // menit sejak tengah malam
  dayKey: DayKey;
}

/** Pecah waktu instant menjadi tanggal/jam/menit/day-key menurut zona waktu IANA. */
export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').slice(0, 3).toLowerCase();
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
    dayKey: (DAY_KEYS.includes(weekday as DayKey) ? weekday : 'sun') as DayKey,
  };
}

/** Tanggal shift = tanggal saat dibuka di zona waktu cabang (BR-02). */
export function getShiftDate(now: Date, timezone: string): string {
  return getZonedParts(now, timezone).date;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export interface TimingResult {
  timingLabel: 'tepat_waktu' | 'lebih_awal' | 'terlambat' | null;
  timingDeltaMinutes: number | null;
}

/**
 * Label waktu item (BR-23): bandingkan waktu server terhadap target_time
 * memakai toleransi item, atau toleransi default dari snapshot.
 */
export function computeTiming(
  now: Date,
  timezone: string,
  targetTime: string | null,
  toleranceMinutes: number | null,
  toleranceDefault: number
): TimingResult {
  if (!targetTime) return { timingLabel: null, timingDeltaMinutes: null };
  const zoned = getZonedParts(now, timezone);
  const delta = zoned.minutes - toMinutes(targetTime);
  const tolerance = toleranceMinutes ?? toleranceDefault;
  const timingLabel =
    Math.abs(delta) <= tolerance ? 'tepat_waktu' : delta < 0 ? 'lebih_awal' : 'terlambat';
  return { timingLabel, timingDeltaMinutes: delta };
}

/**
 * Apakah jam sekarang berada di dalam rentang shift (untuk penanda
 * openedOutsideHours). Shift yang lewat tengah malam melewati batas 24:00.
 */
export function isWithinShiftHours(
  now: Date,
  timezone: string,
  startTime: string,
  endTime: string
): boolean {
  const minutes = getZonedParts(now, timezone).minutes;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (end > start) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

/**
 * Item hanya berlaku pada hari yang tercantum di active_days (Fase 4).
 * active_days disimpan sebagai CSV: 'mon,tue,wed'. Null/ kosong = semua hari.
 */
export function isPointActiveOn(activeDays: string | null, dayKey: DayKey): boolean {
  if (!activeDays) return true;
  const days = activeDays.split(',').map((d) => d.trim()).filter(Boolean);
  if (days.length === 0) return true;
  return days.includes(dayKey);
}