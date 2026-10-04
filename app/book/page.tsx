import BookingFlow from "@/components/booking/BookingFlow";

type Search = { date?: string | string[]; hour?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  // Optional deep link, e.g. /book?date=2026-10-09&hour=19 (used by Quick Rebook).
  // Values are validated here and again inside the flow; invalid ones are ignored.
  const date = first(sp.date);
  const hourNum = Number(first(sp.hour));
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const initialHour = Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23 && first(sp.hour) ? hourNum : undefined;
  return <BookingFlow initialDate={initialDate} initialHour={initialDate ? initialHour : undefined} />;
}
