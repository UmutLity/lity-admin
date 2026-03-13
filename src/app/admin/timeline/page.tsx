"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Filter, User, Activity, Calendar } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TimelineEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff: string | null;
  userId: string;
  userName: string;
  createdAt: string;
  ip: string | null;
}

interface TimelineResponse {
  success: boolean;
  data: {
    dates: Record<string, TimelineEntry[]>;
  };
}

const ACTION_COLORS: Record<string, string> = {
  PRODUCT_CREATE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PRODUCT_UPDATE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PRODUCT_DELETE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CHANGELOG_CREATE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CHANGELOG_PUBLISH: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  STATUS_CHANGE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  LOGIN_SUCCESS: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  LOGIN_FAIL: "bg-red-500/20 text-red-400 border-red-500/30",
  WEBHOOK_SEND: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SETTINGS_UPDATE: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  MEDIA_UPLOAD: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  MEDIA_DELETE: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  ROLE_UPDATE: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  USER_UPDATE: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  LOCK: "bg-red-500/20 text-red-400 border-red-500/30",
  UNLOCK: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const ALL_ACTIONS = [
  "PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE",
  "CHANGELOG_CREATE", "CHANGELOG_PUBLISH", "STATUS_CHANGE",
  "LOGIN_SUCCESS", "LOGIN_FAIL", "WEBHOOK_SEND", "SETTINGS_UPDATE",
  "MEDIA_UPLOAD", "MEDIA_DELETE", "ROLE_UPDATE", "USER_UPDATE",
  "LOCK", "UNLOCK",
];

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export default function TimelinePage() {
  const [timelineData, setTimelineData] = useState<Record<string, TimelineEntry[]>>({});
  const [heatmapData, setHeatmapData] = useState<Record<string, TimelineEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterActions, setFilterActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/timeline?days=30", { credentials: "include" });
        const json: TimelineResponse = await res.json();
        if (json.success && json.data?.dates) {
          setTimelineData(json.data.dates);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, []);

  useEffect(() => {
    async function fetchHeatmap() {
      setHeatmapLoading(true);
      try {
        const res = await fetch("/api/admin/timeline?days=365", { credentials: "include" });
        const json: TimelineResponse = await res.json();
        if (json.success && json.data?.dates) {
          setHeatmapData(json.data.dates);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setHeatmapLoading(false);
      }
    }
    fetchHeatmap();
  }, []);

  const users = useMemo(() => {
    const set = new Set<string>();
    Object.values(timelineData).flat().forEach((e) => set.add(e.userName));
    return Array.from(set).sort();
  }, [timelineData]);

  const sortedDates = useMemo(() => {
    return Object.keys(timelineData).sort((a, b) => b.localeCompare(a));
  }, [timelineData]);

  const filteredEntries = useMemo(() => {
    return sortedDates.reduce<{ date: string; entries: TimelineEntry[] }[]>((acc, date) => {
      let entries = timelineData[date] ?? [];
      if (filterUser) {
        entries = entries.filter((e) => e.userName === filterUser);
      }
      if (filterActions.size > 0) {
        entries = entries.filter((e) => filterActions.has(e.action));
      }
      if (entries.length > 0) {
        acc.push({ date, entries: entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
      }
      return acc;
    }, []);
  }, [sortedDates, timelineData, filterUser, filterActions]);

  const toggleAction = (action: string) => {
    setFilterActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  const heatmapGrid = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (364 - i));
      const key = d.toISOString().slice(0, 10);
      const entries = heatmapData[key] ?? [];
      days.push({ date: key, count: entries.length });
    }
    const cols = 52;
    const rows = 7;
    const grid: { date: string; count: number }[][] = [];
    for (let c = 0; c < cols; c++) {
      const col: { date: string; count: number }[] = [];
      for (let r = 0; r < rows; r++) {
        const idx = c * 7 + r;
        col.push(days[idx] ?? { date: "", count: 0 });
      }
      grid.push(col);
    }
    return grid;
  }, [heatmapData]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...heatmapGrid.flat().map((c) => c.count));
  }, [heatmapGrid]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <Topbar
        title="Activity Timeline"
        description="Admin activity history with filters and heatmap"
      >
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Last 30 days</span>
        </div>
      </Topbar>

      {/* Activity Heatmap */}
      <Card className="mb-6 border-[#1e293b] bg-[#111827]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold">Activity Heatmap</h3>
          </div>
          {heatmapLoading ? (
            <div className="h-[120px] flex items-center justify-center">
              <div className="flex gap-1">
                {Array.from({ length: 52 }).map((_, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-sm bg-[#1e293b] animate-pulse" style={{ animationDelay: `${i * 20}ms` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto pb-2">
              {heatmapGrid.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-0.5">
                  {col.map((cell, ri) => (
                    <div
                      key={`${ci}-${ri}`}
                      className="w-2.5 h-2.5 rounded-sm transition-colors"
                      style={{
                        backgroundColor:
                          cell.count === 0
                            ? "transparent"
                            : cell.count <= 3
                            ? "rgba(34, 197, 94, 0.35)"
                            : cell.count <= 10
                            ? "rgba(34, 197, 94, 0.6)"
                            : "rgba(34, 197, 94, 0.95)",
                      }}
                      title={`${cell.date}: ${cell.count} events`}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6 border-[#1e293b] bg-[#111827]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="bg-[#0a0a1a] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Activity className="h-4 w-4 text-slate-400 shrink-0 self-center" />
              {ALL_ACTIONS.map((a) => (
                <Button
                  key={a}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAction(a)}
                  className={
                    filterActions.has(a)
                      ? "border-purple-500 bg-purple-500/20 text-purple-400"
                      : "border-[#1e293b] bg-[#0a0a1a] text-slate-400 hover:border-[#334155]"
                  }
                >
                  {a.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-[#1e293b] bg-[#111827]">
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-6">
                  <div className="w-24 h-6 rounded bg-[#1e293b] animate-pulse" />
                  <div className="flex-1 space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-20 rounded-lg bg-[#1e293b] animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity found for the selected filters.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-[#1e293b]" />
              <div className="space-y-8">
                {filteredEntries.map(({ date, entries }) => (
                  <div key={date} className="flex gap-6">
                    <div className="w-24 shrink-0 pt-1 text-sm font-medium text-slate-400">
                      {new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="flex-1 space-y-4">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="relative flex gap-4 pl-4 before:absolute before:left-0 before:top-3 before:w-2 before:h-2 before:rounded-full before:bg-purple-500"
                        >
                          <div className="flex-1 rounded-lg border border-[#1e293b] bg-[#0a0a1a] p-4">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs text-slate-500 font-mono">
                                {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium border ${getActionColor(entry.action)}`}
                              >
                                {entry.action}
                              </span>
                              <span className="text-sm font-medium text-slate-300">{entry.entity}</span>
                              {entry.entityId && (
                                <span className="text-xs text-slate-500 font-mono">#{String(entry.entityId).slice(-6)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 rounded-full bg-[#1e293b] flex items-center justify-center text-xs font-medium">
                                {entry.userName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm text-slate-400">{entry.userName}</span>
                            </div>
                            {entry.diff && (
                              <pre className="mt-2 text-xs text-slate-500 font-mono whitespace-pre-wrap truncate max-w-md">
                                {entry.diff}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
