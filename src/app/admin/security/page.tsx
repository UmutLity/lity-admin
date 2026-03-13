"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  ShieldAlert, Unlock, CheckCircle, XCircle, Clock, AlertTriangle,
  Globe, Plus, Trash2, Shield,
} from "lucide-react";

interface SecurityData {
  stats: {
    totalAttempts24h: number;
    failedAttempts24h: number;
    successAttempts24h: number;
    activeLocks: number;
    unresolvedAlerts: number;
  };
  locks: any[];
  attempts: any[];
  alerts: any[];
}

interface WhitelistData {
  enabled: boolean;
  globalCidrs: string[];
  userIps: any[];
}

export default function SecurityPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<SecurityData | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCidr, setNewCidr] = useState("");

  const loadData = async () => {
    try {
      const [secRes, wlRes] = await Promise.all([
        fetch("/api/admin/security"),
        fetch("/api/admin/security/whitelist"),
      ]);
      const secData = await secRes.json();
      const wlData = await wlRes.json();
      if (secData.success) setData(secData.data);
      if (wlData.success) setWhitelist(wlData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUnlock = async (lockId: string) => {
    const res = await fetch("/api/admin/security/locks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockId }),
    });
    if (res.ok) {
      addToast({ type: "success", title: "Account lock released" });
      loadData();
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const res = await fetch("/api/admin/security/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId }),
    });
    if (res.ok) {
      addToast({ type: "success", title: "Alert resolved" });
      loadData();
    }
  };

  const handleWhitelistToggle = async () => {
    if (!whitelist) return;
    const res = await fetch("/api/admin/security/whitelist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !whitelist.enabled, globalCidrs: whitelist.globalCidrs }),
    });
    if (res.ok) {
      setWhitelist({ ...whitelist, enabled: !whitelist.enabled });
      addToast({ type: "success", title: whitelist.enabled ? "Whitelist disabled" : "Whitelist enabled" });
    }
  };

  const handleAddCidr = async () => {
    if (!newCidr.trim() || !whitelist) return;
    const updated = [...whitelist.globalCidrs, newCidr.trim()];
    const res = await fetch("/api/admin/security/whitelist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalCidrs: updated }),
    });
    if (res.ok) {
      setWhitelist({ ...whitelist, globalCidrs: updated });
      setNewCidr("");
      addToast({ type: "success", title: "CIDR added" });
    }
  };

  const handleRemoveCidr = async (cidr: string) => {
    if (!whitelist) return;
    const updated = whitelist.globalCidrs.filter((c) => c !== cidr);
    const res = await fetch("/api/admin/security/whitelist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalCidrs: updated }),
    });
    if (res.ok) {
      setWhitelist({ ...whitelist, globalCidrs: updated });
      addToast({ type: "success", title: "CIDR removed" });
    }
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Security" />
        <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div>
      <Topbar title="Security" description="Login attempts, account locks and security alerts">
        <Button variant="outline" onClick={loadData}><Shield className="h-4 w-4" /> Refresh</Button>
      </Topbar>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{stats?.totalAttempts24h || 0}</p>
            <p className="text-xs text-muted-foreground">24h Total Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-green-500">{stats?.successAttempts24h || 0}</p>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-red-500">{stats?.failedAttempts24h || 0}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-orange-500">{stats?.activeLocks || 0}</p>
            <p className="text-xs text-muted-foreground">Active Locks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-yellow-500">{stats?.unresolvedAlerts || 0}</p>
            <p className="text-xs text-muted-foreground">Unresolved Alerts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Security Alerts {stats?.unresolvedAlerts ? <Badge variant="destructive" className="ml-1 text-xs">{stats.unresolvedAlerts}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="locks">Locked Accounts</TabsTrigger>
          <TabsTrigger value="attempts">Login Attempts</TabsTrigger>
          <TabsTrigger value="whitelist">IP Whitelist</TabsTrigger>
        </TabsList>

        {/* Alerts */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader><CardTitle>Security Alerts</CardTitle></CardHeader>
            <CardContent>
              {!data?.alerts?.length ? (
                <p className="text-muted-foreground text-center py-8">No unresolved alerts</p>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                      <div className="flex gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === "HIGH" || alert.severity === "CRITICAL" ? "text-red-500" : "text-yellow-500"}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={alert.severity === "HIGH" || alert.severity === "CRITICAL" ? "destructive" : "secondary"}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">{alert.type}</Badge>
                          </div>
                          <p className="text-sm">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(alert.createdAt).toLocaleString("en-US")}</p>
                        </div>
                      </div>
                      {!alert.resolvedAt && (
                        <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert.id)}>
                          <CheckCircle className="h-4 w-4" /> Resolve
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locks */}
        <TabsContent value="locks">
          <Card>
            <CardHeader><CardTitle>Locked Accounts</CardTitle></CardHeader>
            <CardContent>
              {!data?.locks?.length ? (
                <p className="text-muted-foreground text-center py-8">No locked accounts</p>
              ) : (
                <div className="space-y-3">
                  {data.locks.map((lock: any) => (
                    <div key={lock.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">{lock.user.name} ({lock.user.email})</p>
                        <p className="text-sm text-muted-foreground">{lock.reason}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" /> Lock expires: {new Date(lock.lockedUntil).toLocaleString("en-US")}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleUnlock(lock.id)}>
                        <Unlock className="h-4 w-4" /> Unlock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attempts */}
        <TabsContent value="attempts">
          <Card>
            <CardHeader><CardTitle>Last 24 Hours Login Attempts</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">IP</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.attempts?.map((a: any) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2">
                          {a.success ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Success</Badge>
                          ) : (
                            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>
                          )}
                        </td>
                        <td className="py-2 font-mono text-xs">{a.email}</td>
                        <td className="py-2 font-mono text-xs">{a.ip}</td>
                        <td className="py-2 text-muted-foreground text-xs">{new Date(a.createdAt).toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data?.attempts?.length && <p className="text-center text-muted-foreground py-8">No records</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Whitelist */}
        <TabsContent value="whitelist">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> IP Whitelist</CardTitle>
                <Button size="sm" variant={whitelist?.enabled ? "destructive" : "default"} onClick={handleWhitelistToggle}>
                  {whitelist?.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {whitelist?.enabled && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" /> Whitelist active. Only the IP/CIDR ranges below can access the admin panel.
                </div>
              )}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="IP or CIDR (e.g. 192.168.1.0/24)"
                    value={newCidr}
                    onChange={(e) => setNewCidr(e.target.value)}
                    className="font-mono"
                  />
                  <Button onClick={handleAddCidr}><Plus className="h-4 w-4" /> Add</Button>
                </div>
                <div className="space-y-2">
                  {whitelist?.globalCidrs?.map((cidr, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded border bg-muted/50">
                      <code className="text-sm">{cidr}</code>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveCidr(cidr)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {!whitelist?.globalCidrs?.length && (
                    <p className="text-muted-foreground text-center py-4">No CIDR added yet</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
