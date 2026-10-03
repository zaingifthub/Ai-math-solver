/** Time helpers (kept out of render bodies so components stay pure). */
export const nowMs = () => Date.now();
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
export const isoDay = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
