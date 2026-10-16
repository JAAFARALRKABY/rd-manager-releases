export const formatBaghdadTime = (dateStr, includeTime = true) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(includeTime && {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    });

    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach((part) => (p[part.type] = part.value));

    if (includeTime) {
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.dayPeriod}`;
    } else {
      return `${p.year}-${p.month}-${p.day}`;
    }
  } catch {
    return dateStr;
  }
};
