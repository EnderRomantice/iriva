// IANA zones let Intl handle daylight saving and half-hour offsets automatically.
export function memberTime(timezone: string | undefined, now: Date) {
  if (!timezone) return undefined;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || "";
    const offset = part("timeZoneName").replace("GMT", "UTC").replace(/^UTC(?:[+-]0(?::00)?)?$/, "UTC+0");
    const date = new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "long", day: "numeric" }).format(now);
    return { time: `${part("hour")}:${part("minute")}`, offset, date };
  } catch { return undefined; }
}
