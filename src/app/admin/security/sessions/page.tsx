"use client";

import { useState, useEffect } from "react";
import { Monitor, Shield, Trash2, XCircle, RefreshCw, Clock } from "lucide-react";

interface AdminSessionData {
  id: string;
  sessionId: string;
  ipHash: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

export default function SecuritySessionsPage() {
  const [sessions, setSessions] = useState<AdminSessionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security/sessions");
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const revokeSession = async (sessionId: string) => {
    if (!confirm("Revoke this session?")) return;
    await fetch("/api/admin/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    fetchSessions();
  };

  const revokeAllForUser = async (userId: string) => {
    if (!confirm("Revoke all sessions for this user?")) return;
    await fetch("/api/admin/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revokeAllForUser: userId }),
    });
    fetchSessions();
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const parseUA = (ua: string | null) => {
    if (!ua) return "Unknown";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return ua.slice(0, 40);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Active Sessions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage admin sessions</p>
        </div>
        <button onClick={fetchSessions} className="p-2 rounded-lg bg-card border hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Browser</th>
              <th className="text-left px-4 py-3 font-medium">Last Active</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No active sessions</td></tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{s.user.name}</span>
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.user.role}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{parseUA(s.userAgent)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {timeAgo(s.lastSeenAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => revokeSession(s.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      title="Revoke"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
