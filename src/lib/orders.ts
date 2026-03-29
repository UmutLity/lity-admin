export type OrderTimelineEvent = {
  type: string;
  title: string;
  description?: string;
  createdAt: string;
};

export function parseOrderTimeline(raw: string | null | undefined): OrderTimelineEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeOrderTimeline(events: OrderTimelineEvent[]): string {
  return JSON.stringify(
    [...events].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  );
}

export function appendOrderTimeline(
  raw: string | null | undefined,
  event: Omit<OrderTimelineEvent, "createdAt"> & { createdAt?: string }
): string {
  const current = parseOrderTimeline(raw);
  current.push({
    ...event,
    createdAt: event.createdAt || new Date().toISOString(),
  });
  return serializeOrderTimeline(current);
}
