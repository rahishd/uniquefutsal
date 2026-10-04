/**
 * Formats a 24-hour time string (HH:mm) to 12-hour format (hh:mm AM/PM).
 * @param time 24-hour time string
 * @returns 12-hour formatted time string
 */
export const formatTimeTo12h = (time: string): string => {
  if (!time) return "";
  
  // Handle "HH:00 - HH:00" or "HH:00-HH:00" format used in pricing
  if (time.includes("-")) {
    const separator = time.includes(" - ") ? " - " : "-";
    return time.split(separator).map(t => formatTimeTo12h(t)).join(" - ");
  }

  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;

  const h = Number(match[1]);
  const m = match[2];
  const period = h >= 12 ? "PM" : "AM";
  const hours = h % 12 || 12;
  return `${hours.toString().padStart(2, "0")}:${m} ${period}`;
};

/**
 * Returns the end time for a given start time and duration.
 * @param startTime 24-hour start time string
 * @param duration duration in hours
 * @returns 12-hour formatted end time string
 */
export const getEndTime12h = (startTime: string, duration: number): string => {
  if (!startTime) return "";
  const [h] = startTime.split(":").map(Number);
  const endH = h + duration;
  const normalizedEndH = endH % 24;
  const timeStr = `${normalizedEndH.toString().padStart(2, "0")}:00`;
  return formatTimeTo12h(timeStr);
};
