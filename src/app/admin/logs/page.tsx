"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Filter, RefreshCcw } from "lucide-react";

type LogType = "audit" | "payment" | "role";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "ROLE_CHANGE", "PASSWORD_RESET", "LOGIN_SUCCESS", "LOGIN_FAIL"];
const ENTITIES = ["Customer", "Role", "User", "Product", "SiteSetting", "Security"];

export default function LogsPage() {
  const [type, setType] = useState<LogType>("audit");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [txType, setTxType] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      type,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) params.set("search", search.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (type === "audit") {
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
    }
    if (type === "payment" && txType) params.set("txType", txType);
    return params.toString();
  }, [type, page, pageSize, search, dateFrom, dateTo, action, entity, txType]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?${queryString}`);
      const data = await res.json();
      if (data.success) {
        setLogs(Array.isArray(data.data) ? data.data : []);
        setTotal(data.meta?.total || 0);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [type]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <Topbar title="Logs" description={`Toplam ${total} kayıt`}>
        <Button variant="outline" onClick={loadLogs}>
          <RefreshCcw className="h-4 w-4" />
          Yenile
        </Button>
      </Topbar>

      <Card className="mb-4">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={type === "audit" ? "default" : "outline"} onClick={() => setType("audit")}>Audit</Button>
            <Button size="sm" variant={type === "payment" ? "default" : "outline"} onClick={() => setType("payment")}>Payment</Button>
            <Button size="sm" variant={type === "role" ? "default" : "outline"} onClick={() => setType("role")}>Role</Button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Search</Label>
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="user, entity, reason..." className="h-9 w-52" />
            </div>
            <div>
              <Label className="text-xs">Başlangıç</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Bitiş</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-9 w-40" />
            </div>

            {type === "audit" && (
              <>
                <div>
                  <Label className="text-xs">Action</Label>
                  <select
                    value={action}
                    onChange={(e) => { setAction(e.target.value); setPage(1); }}
                    className="h-9 rounded-md border bg-background px-3 text-sm w-44"
                  >
                    <option value="">Tümü</option>
                    {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Entity</Label>
                  <select
                    value={entity}
                    onChange={(e) => { setEntity(e.target.value); setPage(1); }}
                    className="h-9 rounded-md border bg-background px-3 text-sm w-44"
                  >
                    <option value="">Tümü</option>
                    {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </>
            )}

            {type === "payment" && (
              <div>
                <Label className="text-xs">Transaction</Label>
                <select
                  value={txType}
                  onChange={(e) => { setTxType(e.target.value); setPage(1); }}
                  className="h-9 rounded-md border bg-background px-3 text-sm w-44"
                >
                  <option value="">Tümü</option>
                  <option value="CREDIT">CREDIT</option>
                  <option value="DEBIT">DEBIT</option>
                </select>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setAction("");
                setEntity("");
                setTxType("");
                setPage(1);
              }}
            >
              <Filter className="h-4 w-4" />
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Tarih</th>
                  {type === "audit" && (
                    <>
                      <th className="pb-2 font-medium">Kullanıcı</th>
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Entity</th>
                      <th className="pb-2 font-medium">IP</th>
                    </>
                  )}
                  {type === "payment" && (
                    <>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Balance</th>
                      <th className="pb-2 font-medium">Admin</th>
                      <th className="pb-2 font-medium">Reason</th>
                    </>
                  )}
                  {type === "role" && (
                    <>
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Entity</th>
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Role Change</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>

                    {type === "audit" && (
                      <>
                        <td className="py-2">{log.user?.name || "-"}</td>
                        <td className="py-2">
                          <Badge variant="outline">{log.action}</Badge>
                        </td>
                        <td className="py-2">
                          {log.entity}
                          {log.entityId ? <span className="text-xs text-muted-foreground ml-1">#{String(log.entityId).slice(-6)}</span> : null}
                        </td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{log.ip || "-"}</td>
                      </>
                    )}

                    {type === "payment" && (
                      <>
                        <td className="py-2">{log.customer?.username || "-"} <span className="text-xs text-muted-foreground">({log.customer?.email || "-"})</span></td>
                        <td className="py-2">
                          <Badge variant="outline" className={log.type === "CREDIT" ? "border-green-500/40 text-green-500" : "border-red-500/40 text-red-500"}>
                            {log.type}
                          </Badge>
                        </td>
                        <td className="py-2 font-medium">${Number(log.amount || 0).toFixed(2)}</td>
                        <td className="py-2 text-xs text-muted-foreground">${Number(log.balanceBefore || 0).toFixed(2)} → ${Number(log.balanceAfter || 0).toFixed(2)}</td>
                        <td className="py-2">{log.admin?.name || "-"}</td>
                        <td className="py-2 text-xs">{log.reason || "-"}</td>
                      </>
                    )}

                    {type === "role" && (
                      <>
                        <td className="py-2">{log.user?.name || "-"}</td>
                        <td className="py-2">{log.entity}</td>
                        <td className="py-2"><Badge variant="outline">{log.action}</Badge></td>
                        <td className="py-2 text-xs">{log.role?.from || "-"} → {log.role?.to || "-"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && (
              <div className="text-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto" />
              </div>
            )}

            {!loading && logs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Kayıt bulunamadı</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Sayfa {page} / {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Önceki
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Sonraki
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
