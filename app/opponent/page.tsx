import OpponentHub from "@/components/captain/OpponentHub";

export default async function OpponentPage({ searchParams }: { searchParams: Promise<{ report?: string | string[] }> }) {
  const { report } = await searchParams;
  const id = Array.isArray(report) ? report[0] : report;
  // Only plain game ids are accepted (they look like "ch-red" or "ch-1791143168248").
  const reportId = id && /^[a-z0-9-]{1,40}$/i.test(id) ? id : undefined;
  return <OpponentHub reportId={reportId} />;
}
