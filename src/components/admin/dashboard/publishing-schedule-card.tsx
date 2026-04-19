import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PublishingEvent {
  id: string;
  title: string;
  type: "CHANGELOG" | "GUIDE" | "BLOG";
  when: string;
  state: "scheduled" | "published";
  href: string;
}

interface PublishingScheduleCardProps {
  loading?: boolean;
  events: PublishingEvent[];
}

const typeTone: Record<PublishingEvent["type"], string> = {
  CHANGELOG: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  GUIDE: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  BLOG: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStateTone(state: PublishingEvent["state"]) {
  return state === "scheduled"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export function PublishingScheduleCard({ loading, events }: PublishingScheduleCardProps) {
  return (
    <div className="admin-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-zinc-100">Publishing Schedule</p>
          <p className="text-xs text-zinc-500">Upcoming and recent content timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/changelog/new">
            <Button variant="outline" className="h-7 rounded-lg border-white/[0.12] bg-white/[0.02] px-2 text-[11px] text-zinc-200 hover:bg-white/[0.06]">
              New Changelog
            </Button>
          </Link>
          <Link href="/admin/blog/new">
            <Button variant="outline" className="h-7 rounded-lg border-violet-500/30 bg-violet-500/10 px-2 text-[11px] text-violet-100 hover:bg-violet-500/15">
              New Post
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-2">
        {loading ? (
          <>
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          </>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-zinc-500">
            No scheduled content yet. Set a future publish date in changelog to populate this timeline.
          </p>
        ) : (
          events.slice(0, 6).map((event) => (
            <div key={event.id} className="flex h-12 items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", typeTone[event.type])}>{event.type}</Badge>
                  <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", getStateTone(event.state))}>{event.state}</Badge>
                </div>
                <p className="truncate text-xs text-zinc-200">{event.title}</p>
              </div>
              <div className="ml-3 flex items-center gap-2">
                <span className="hidden text-xs text-zinc-400 sm:inline">{formatWhen(event.when)}</span>
                <Link href={event.href}>
                  <Button variant="ghost" className="h-7 rounded-lg px-2 text-[11px] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100">
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Open
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

