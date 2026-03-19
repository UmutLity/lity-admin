"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Shield, Webhook, BarChart3, AlertTriangle, Server, Filter } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  meta: string | null;
  isRead: boolean;
  createdAt: string;
  user?: { name: string } | null;
}

const TYPE_ICONS: Record<string, any> = {
  SECURITY: Shield,
  WEBHOOK: Webhook,
  TRAFFIC: BarChart3,
  STATUS: AlertTriangle,
  SYSTEM: Server,
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  WARNING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<string>("");

  const fetchNotifications = async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set("type", filter);
      const res = await fetch(`/api/admin/notifications?${params}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [filter]);

  const markRead = async (id: string) => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    fetchNotifications();
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter("")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filter ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
          All
        </button>
        {["SECURITY", "WEBHOOK", "TRAFFIC", "STATUS", "SYSTEM"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === t ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const severityClass = SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.INFO;
            return (
              <div
                key={n.id}
                className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition-all ${!n.isRead ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <div className={`p-2 rounded-lg border ${severityClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{n.title}</h3>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{timeAgo(n.createdAt)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${severityClass}`}>
                      {n.severity}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">{n.type}</span>
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
