"use client";

import { useEffect, useState, useCallback } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  ClipboardList, Download, ChevronLeft, ChevronRight, Search,
  Eye, X, Filter,
} from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  diff: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-500/10 text-green-500 border-green-500/20",
  UPDATE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
  PUBLISH: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  LOGIN_SUCCESS: "bg-green-500/10 text-green-500 border-green-500/20",
  LOGIN_FAIL: "bg-red-500/10 text-red-500 border-red-500/20",
  STATUS_CHANGE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  SETTINGS_UPDATE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  WEBHOOK_TEST: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  WEBHOOK_SEND: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  "2FA_ENABLE": "bg-green-500/10 text-green-500 border-green-500/20",
  "2FA_DISABLE": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  LOCK: "bg-red-500/10 text-red-500 border-red-500/20",
  UNLOCK: "bg-green-500/10 text-green-500 border-green-500/20",
  ROLE_CHANGE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const ACTIONS = ["CREATE","UPDATE","DELETE","PUBLISH","LOGIN_SUCCESS","LOGIN_FAIL","STATUS_CHANGE","SETTINGS_UPDATE","WEBHOOK_TEST","WEBHOOK_SEND","2FA_ENABLE","2FA_DISABLE","LOCK","UNLOCK","MEDIA_UPLOAD","MEDIA_DELETE","ROLE_CHANGE"];
const ENTITIES = ["Product","Changelog","SiteSetting","User","Media","Role","Security","Webhook"];

export default function AuditPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const pageSize = 30;

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity", filterEntity);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotal(data.meta.total);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterAction, filterEntity, dateFrom, dateTo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleExport = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/admin/audit?${params}`, "_blank");
    addToast({ type: "success", title: "CSV indiriliyor..." });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <Topbar title="Audit Log" description={`Toplam ${total} kayıt`}>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> CSV İndir</Button>
      </Topbar>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Action</Label>
              <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm w-40">
                <option value="">Tümü</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Entity</Label>
              <select value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm w-36">
                <option value="">Tümü</option>
                {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Başlangıç</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-36 h-9" />
            </div>
            <div>
              <Label className="text-xs">Bitiş</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-36 h-9" />
            </div>
            {(filterAction || filterEntity || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterAction(""); setFilterEntity(""); setDateFrom(""); setDateTo(""); setPage(1); }}>
                <X className="h-4 w-4" /> Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Tarih</th>
                  <th className="pb-2 font-medium">Kullanıcı</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Entity</th>
                  <th className="pb-2 font-medium">IP</th>
                  <th className="pb-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                    <td className="py-2"><span className="text-xs">{log.user.name}</span></td>
                    <td className="py-2">
                      <Badge className={ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"} variant="outline">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <span className="text-xs font-mono">{log.entity}</span>
                      {log.entityId && <span className="text-xs text-muted-foreground ml-1">#{log.entityId.slice(-6)}</span>}
                    </td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{log.ip || "-"}</td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="text-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto" /></div>}
            {!loading && logs.length === 0 && <p className="text-center text-muted-foreground py-8">Kayıt bulunamadı</p>}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Sayfa {page} / {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Önceki
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Sonraki <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-card rounded-xl border shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Audit Log Detayı</h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedLog(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Tarih</Label><p>{new Date(selectedLog.createdAt).toLocaleString("tr-TR")}</p></div>
                <div><Label className="text-xs text-muted-foreground">Kullanıcı</Label><p>{selectedLog.user.name} ({selectedLog.user.email})</p></div>
                <div><Label className="text-xs text-muted-foreground">Action</Label><p><Badge className={ACTION_COLORS[selectedLog.action]} variant="outline">{selectedLog.action}</Badge></p></div>
                <div><Label className="text-xs text-muted-foreground">Entity</Label><p>{selectedLog.entity} {selectedLog.entityId ? `#${selectedLog.entityId.slice(-8)}` : ""}</p></div>
                <div><Label className="text-xs text-muted-foreground">IP</Label><p className="font-mono">{selectedLog.ip || "-"}</p></div>
                <div><Label className="text-xs text-muted-foreground">User Agent</Label><p className="text-xs truncate">{selectedLog.userAgent || "-"}</p></div>
              </div>

              {selectedLog.diff && (
                <div>
                  <Label className="text-xs text-muted-foreground">Değişiklik Özeti</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">{selectedLog.diff}</pre>
                </div>
              )}

              {selectedLog.before && (
                <div>
                  <Label className="text-xs text-muted-foreground">Önceki (Before)</Label>
                  <pre className="mt-1 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selectedLog.before), null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after && (
                <div>
                  <Label className="text-xs text-muted-foreground">Sonraki (After)</Label>
                  <pre className="mt-1 p-3 bg-green-500/5 border border-green-500/20 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selectedLog.after), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
