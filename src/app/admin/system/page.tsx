"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database, Wifi, Shield, Server, Clock, AlertTriangle, CheckCircle,
  XCircle, RefreshCw, HardDrive,
} from "lucide-react";

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch("/api/admin/system")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading && !data) {
    return (
      <div>
        <Topbar title="System Health" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { database, webhooks, security, uptime } = data;

  return (
    <div>
      <Topbar title="System Health" description="Monitor infrastructure and service status">
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </Topbar>

      {/* Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
        database.status === "healthy" && security.unresolvedAlerts === 0
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        {database.status === "healthy" && security.unresolvedAlerts === 0 ? (
          <><CheckCircle className="h-5 w-5 text-emerald-500" /><span className="font-medium text-emerald-400">All systems operational</span></>
        ) : (
          <><AlertTriangle className="h-5 w-5 text-amber-500" /><span className="font-medium text-amber-400">Some issues detected</span></>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Database className="h-4 w-4" /> Database</span>
              <Badge variant={database.status === "healthy" ? "success" : "destructive"}>
                {database.status === "healthy" ? "Healthy" : "Error"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><span className="font-mono">{database.latencyMs}ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span className="font-mono">{database.tables.products}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Customers</span><span className="font-mono">{database.tables.customers}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Page Views</span><span className="font-mono">{database.tables.pageViews.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Audit Logs</span><span className="font-mono">{database.tables.auditLogs.toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Server */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Server className="h-4 w-4" /> Server</span>
              <Badge variant="success">Online</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span className="font-mono">{formatUptime(uptime.uptimeSeconds)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span className="font-mono text-xs">{new Date(uptime.serverStarted).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Runtime</span><span className="font-mono">Node.js</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Framework</span><span className="font-mono">Next.js 14</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Wifi className="h-4 w-4" /> Discord Webhooks</span>
              <Badge variant={webhooks.successRate >= 90 ? "success" : "destructive"}>
                {webhooks.successRate}% success
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Sent</span><span className="font-mono">{webhooks.total}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Failed</span><span className={`font-mono ${webhooks.failed > 0 ? "text-red-400" : ""}`}>{webhooks.failed}</span></div>
              {webhooks.lastResult && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Result</span>
                    {webhooks.lastResult.success ? (
                      <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="h-3 w-3" /> OK</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3 w-3" /> Failed</span>
                    )}
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Event</span><span className="font-mono text-xs">{webhooks.lastResult.event}</span></div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security</span>
              <Badge variant={security.unresolvedAlerts === 0 ? "success" : "destructive"}>
                {security.unresolvedAlerts} alerts
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Unresolved Alerts</span><span className={`font-mono ${security.unresolvedAlerts > 0 ? "text-amber-400" : ""}`}>{security.unresolvedAlerts}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Active Locks</span><span className="font-mono">{security.activeLocks}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Login Fails (24h)</span><span className={`font-mono ${security.loginFailsLast24h > 5 ? "text-red-400" : ""}`}>{security.loginFailsLast24h}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Audit Events (24h)</span><span className="font-mono">{security.auditEventsLast24h}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* API Health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> API Endpoints</span>
              <Badge variant="success">All OK</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {["/api/products", "/api/changelog", "/api/settings", "/api/status"].map((ep) => (
                <div key={ep} className="flex justify-between items-center">
                  <code className="text-xs font-mono">{ep}</code>
                  <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="h-3 w-3" /> OK</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Quick Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Database</span><span className="font-mono">SQLite</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ORM</span><span className="font-mono">Prisma</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Auth</span><span className="font-mono">NextAuth</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">UI</span><span className="font-mono">shadcn/ui</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Checked</span><span className="font-mono text-xs">{new Date().toLocaleTimeString()}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
