/** Timestamps are stored UTC (epoch ms) and displayed in Asia/Baghdad (UTC+3). */

export const STORE_TZ = "Asia/Baghdad";
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, no DST

export function formatDateTime(
  epochMs: number,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: STORE_TZ }).format(
    new Date(epochMs)
  );
}

export function formatDate(epochMs: number): string {
  return formatDateTime(epochMs, { year: "numeric", month: "short", day: "numeric" });
}

/** Midnight (Baghdad) for the Baghdad calendar day containing epochMs, returned as a UTC epoch ms. */
export function baghdadDayStart(epochMs: number): number {
  const shifted = epochMs + BAGHDAD_OFFSET_MS;
  const dayMs = 24 * 60 * 60 * 1000;
  const flooredShifted = Math.floor(shifted / dayMs) * dayMs;
  return flooredShifted - BAGHDAD_OFFSET_MS;
}

export function addDays(epochMs: number, days: number): number {
  return epochMs + days * 24 * 60 * 60 * 1000;
}

export type DatePresetId =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "prevMonth"
  | "allTime"
  | "custom";

export interface DateRange {
  from: number; // inclusive, epoch ms (UTC), resolved from Baghdad-local boundary
  to: number; // exclusive, epoch ms (UTC)
  label: string;
}

function baghdadYMD(epochMs: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Baghdad-local midnight of year/month(1-based)/day, as a UTC epoch ms. */
function baghdadMidnight(y: number, m: number, d: number): number {
  // Compute the UTC instant such that formatting it in Baghdad gives y-m-d 00:00.
  const naiveUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  return naiveUtc - BAGHDAD_OFFSET_MS;
}

export function resolveDatePreset(
  preset: DatePresetId,
  now: number = Date.now(),
  custom?: { from: string; to: string }
): DateRange {
  const today = baghdadYMD(now);
  const todayStart = baghdadMidnight(today.y, today.m, today.d);
  const dayMs = 24 * 60 * 60 * 1000;

  switch (preset) {
    case "today":
      return { from: todayStart, to: todayStart + dayMs, label: "Today" };
    case "yesterday":
      return {
        from: todayStart - dayMs,
        to: todayStart,
        label: "Yesterday",
      };
    case "last7":
      return {
        from: todayStart - 7 * dayMs,
        to: todayStart + dayMs,
        label: "Last 7 days",
      };
    case "last30":
      return {
        from: todayStart - 30 * dayMs,
        to: todayStart + dayMs,
        label: "Last 30 days",
      };
    case "thisMonth": {
      const from = baghdadMidnight(today.y, today.m, 1);
      const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        new Date(from)
      );
      return {
        from,
        to: todayStart + dayMs,
        label: `${monthName} ${today.y} to date`,
      };
    }
    case "prevMonth": {
      const pm = today.m === 1 ? 12 : today.m - 1;
      const py = today.m === 1 ? today.y - 1 : today.y;
      const from = baghdadMidnight(py, pm, 1);
      const to = baghdadMidnight(today.y, today.m, 1);
      const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        new Date(from)
      );
      return { from, to, label: `${monthName} ${py}` };
    }
    case "allTime":
      return { from: 0, to: todayStart + dayMs, label: "All time" };
    case "custom": {
      if (!custom) throw new Error("custom range requires from/to");
      const [fy, fm, fd] = custom.from.split("-").map(Number);
      const [ty, tm, td] = custom.to.split("-").map(Number);
      const from = baghdadMidnight(fy, fm, fd);
      const to = baghdadMidnight(ty, tm, td) + dayMs; // inclusive of both days
      return { from, to, label: `${custom.from} to ${custom.to}` };
    }
  }
}
