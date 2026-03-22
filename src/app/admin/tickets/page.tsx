"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Inbox, Search, MessageSquare, Mail, Clock3, UserRound, Send } from "lucide-react";

const statusOptions = [
  { value: "ALL", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_CUSTOMER", label: "Waiting Customer" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const STATUS_BADGES: Record<string, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  WAITING_CUSTOMER: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  RESOLVED: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  CLOSED: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

const PRIORITY_BADGES: Record<string, string> = {
  LOW: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  NORMAL: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  HIGH: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TicketsPage() {
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editStatus, setEditStatus] = useState("OPEN");
  const [editPriority, setEditPriority] = useState("NORMAL");
  const [editNotes, setEditNotes] = useState("");

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (query) params.set("q", query);
      const res = await fetch(`/api/admin/tickets?${params.toString()}`);
      const data = await res.json();
      if (data.success) setTickets(data.data || []);
    } catch {
      addToast({ type: "error", title: "Error", description: "Tickets could not be loaded." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTickets(); }, [status, query]);

  const openTicket = (ticket: any) => {
    setSelected(ticket);
    setEditStatus(ticket.status || "OPEN");
    setEditPriority(ticket.priority || "NORMAL");
    setEditNotes(ticket.adminNotes || "");
  };

  const saveTicket = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          adminNotes: editNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed");
      addToast({ type: "success", title: "Saved", description: "Ticket updated successfully." });
      setSelected(null);
      loadTickets();
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Update failed." });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Topbar title="Tickets" description="Manage login-free support requests from the public site" />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subject, email, Discord, message..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              className="w-full sm:w-56"
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-8"><div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div></CardContent></Card>
      ) : tickets.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="No tickets yet" description="Public support requests will appear here." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">#{ticket.ticketNumber}</span>
                      <Badge className={STATUS_BADGES[ticket.status] || STATUS_BADGES.OPEN}>{ticket.status.replaceAll("_", " ")}</Badge>
                      <Badge className={PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.NORMAL}>{ticket.priority}</Badge>
                      {ticket.product?.name && <Badge variant="outline">{ticket.product.name}</Badge>}
                      {ticket.isFallback && <Badge variant="outline">Notification fallback</Badge>}
                    </div>
                    <h3 className="text-base font-semibold text-white">{ticket.subject}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{ticket.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        {ticket.contactType === "EMAIL" ? <Mail className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                        {ticket.email || ticket.discordUsername}
                      </span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {timeAgo(ticket.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openTicket(ticket)}>
                      <MessageSquare className="h-4 w-4" /> Open
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket {selected ? `#${selected.ticketNumber}` : ""}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                  <div className="rounded-lg border bg-card p-3 text-sm">
                    <div>{selected.email || selected.discordUsername}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{selected.contactType}</div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Product</p>
                  <div className="rounded-lg border bg-card p-3 text-sm">
                    {selected.product?.name || "General support"}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                <div className="rounded-lg border bg-card p-3 text-sm">{selected.subject}</div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Message</p>
                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm">
                  {selected.message}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    options={statusOptions.filter((option) => option.value !== "ALL")}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                  <Select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    options={[
                      { value: "LOW", label: "Low" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "HIGH", label: "High" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Admin notes</p>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes for the team..."
                  rows={5}
                />
              </div>
              {selected.isFallback && (
                <p className="text-xs text-amber-400">
                  This ticket was captured from notification fallback. Updates are saved into fallback metadata.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button onClick={saveTicket} disabled={updating}>
              <Send className="h-4 w-4" /> {updating ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
