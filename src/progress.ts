export const STORAGE_KEY = 'cavallo.progress.v1';
const MAX_INTERVAL = 365 * 86400000;
const MAX_DATE = 8640000000000000;
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type Review = { due: number; interval: number; repetitions: number; lapses: number; mastered?: boolean };
export type Event = { cardId: string; time: number; recalled: boolean; rating: Rating };
export type Progress = { version: 1; reviews: Record<string, Review>; events: Event[]; daily?: { date: string; ids: string[] } };
export const emptyProgress = (): Progress => ({ version: 1, reviews: {}, events: [] });
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const p = JSON.parse(raw);
    if (p.version !== 1 || !p.reviews || typeof p.reviews !== 'object' || Array.isArray(p.reviews) || !Array.isArray(p.events)) return emptyProgress();
    for (const r of Object.values(p.reviews) as Review[]) {
      if (!r || ![r.due, r.interval, r.repetitions, r.lapses].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return emptyProgress();
      if (r.due > MAX_DATE || r.interval > MAX_INTERVAL || !Number.isSafeInteger(r.repetitions) || !Number.isSafeInteger(r.lapses)) return emptyProgress();
      if (r.mastered !== undefined && typeof r.mastered !== 'boolean') return emptyProgress();
    }
    if (!p.events.every((e: Event) => e && typeof e.cardId === 'string' && Number.isFinite(e.time) && e.time >= 0 && e.time <= MAX_DATE && typeof e.recalled === 'boolean' && ['again', 'hard', 'good', 'easy'].includes(e.rating))) return emptyProgress();
    if (p.daily !== undefined && (!p.daily || typeof p.daily.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.daily.date) || !Array.isArray(p.daily.ids) || p.daily.ids.length > 10 || !p.daily.ids.every((id: unknown) => typeof id === 'string') || new Set(p.daily.ids).size !== p.daily.ids.length)) delete p.daily;
    return p;
  } catch { return emptyProgress(); }
}
export function intervalFor(previous: Review | undefined, rating: Rating): number {
  const day = 86400000;
  if (rating === 'again') return 5 * 60000;
  if (rating === 'hard') return Math.min(MAX_INTERVAL, Math.max(day, Math.round((previous?.interval ?? 0) * 1.2)));
  if (rating === 'good') return Math.min(MAX_INTERVAL, Math.max(3 * day, Math.round((previous?.interval ?? 0) * 2.2)));
  return Math.min(MAX_INTERVAL, Math.max(7 * day, Math.round((previous?.interval ?? 0) * 3)));
}
export function rateCard(progress: Progress, cardId: string, rating: Rating, recalled: boolean, now: number): Progress {
  const prev = progress.reviews[cardId];
  const interval = intervalFor(prev, rating);
  return {
    ...progress,
    version: 1,
    reviews: { ...progress.reviews, [cardId]: { ...prev, due: now + interval, interval, repetitions: (prev?.repetitions ?? 0) + 1, lapses: (prev?.lapses ?? 0) + (rating === 'again' ? 1 : 0) } },
    events: [...progress.events, { cardId, time: now, recalled, rating }].slice(-5000),
  };
}
export function intervalLabel(ms: number): string {
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  const days = Math.round(ms / 86400000);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}
export function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function streak(events: Event[], now: number): number {
  const days = new Set(events.map(e => dayKey(e.time)));
  const d = new Date(now);
  if (!days.has(dayKey(+d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(+d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
