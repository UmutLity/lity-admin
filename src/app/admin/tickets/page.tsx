"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Ticket, MessageSquare, Send } from "lucide-react";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH";

interface TicketMessage {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  author: string;
  message: string;
  createdAt: string;
}

interface AdminTicket {
  id: string;
  ticketNumber: number;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  email: string | null;
  discordUsername: string | null;
  createdAt: string;
  updatedAt: string;
  conversation: TicketMessage[];
  statusHistory?: Array<{ id: string; from: string; to: string; at: string; by: string }>;
}

const statusOptions: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const priorityOptions: TicketPriority[] = ["LOW", "NORMAL", "HIGH"];

function formatStatus(status: TicketStatus) {
  return status.replace("_", " ");
}

function statusClass(status: TicketStatus) {
  if (status === "OPEN") return "text-sky-300 border-sky-400/30 bg-sky-500/10";
  if (status === "IN_PROGRESS") return "text-amber-300 border-amber-400/30 bg-amber-500/10";
  if (status === "WAITING_CUSTOMER") return "text-orange-300 border-orange-400/30 bg-orange-500/10";
  if (status === "RESOLVED") return "text-emerald-300 border-emerald-400/30 bg-emerald-500/10";
  return "text-zinc-300 border-zinc-400/30 bg-zinc-500/10";
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyMessage, setReplyMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [tickets, selectedId]
  );

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/tickets?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      const nextTickets: AdminTicket[] = data?.data || [];
      setTickets(nextTickets);
      setSelectedId((current) => {
        if (current && nextTickets.some((ticket) => ticket.id === current)) return current;
        return nextTickets[0]?.id || "";
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets().catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, statusFilter]);

  async function patchTicket(payload: Partial<Pick<AdminTicket, "status" | "priority">> & { replyMessage?: string }) {
    if (!selectedTicket) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) return;

      setTickets((current) =>
        current.map((ticket) => (ticket.id === selectedTicket.id ? { ...ticket, ...data.data } : ticket))
      );
      if (payload.replyMessage) setReplyMessage("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topbar title="Tickets" description="User support tickets and admin replies" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-white">{tickets.length}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Open</p>
          <p className="mt-1 text-xl font-semibold text-sky-300">{tickets.filter((x) => x.status === "OPEN").length}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">In Progress</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{tickets.filter((x) => x.status === "IN_PROGRESS").length}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Resolved/Closed</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">
            {tickets.filter((x) => x.status === "RESOLVED" || x.status === "CLOSED").length}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by subject, email, discord..."
          className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/40"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | TicketStatus)}
          className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">All Status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="premium-card p-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-zinc-200">
            <Ticket className="h-4 w-4 text-[#c7bdd8]" />
            Ticket List
          </div>
          <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-500">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-500">No tickets found.</div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === ticket.id
                      ? "border-[#b9accf]/35 bg-[#a996c4]/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">#{ticket.ticketNumber} {ticket.subject}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(ticket.status)}`}>
                      {formatStatus(ticket.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{ticket.email || ticket.discordUsername || "Customer"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{ticket.message}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="premium-card p-4">
          {!selectedTicket ? (
            <div className="flex min-h-[500px] items-center justify-center text-zinc-500">Select a ticket to view details.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">#{selectedTicket.ticketNumber} {selectedTicket.subject}</h2>
                  <p className="text-sm text-zinc-500">{selectedTicket.email || selectedTicket.discordUsername || "Customer"}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(event) => patchTicket({ status: event.target.value as TicketStatus })}
                    className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-zinc-200"
                    disabled={saving}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedTicket.priority}
                    onChange={(event) => patchTicket({ priority: event.target.value as TicketPriority })}
                    className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-zinc-200"
                    disabled={saving}
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-[430px] space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                {selectedTicket.conversation?.length ? (
                  selectedTicket.conversation.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg border p-3 ${
                        message.sender === "ADMIN"
                          ? "ml-8 border-[#b9accf]/25 bg-[#a996c4]/10"
                          : "mr-8 border-white/[0.08] bg-[#141621]"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <strong className="text-zinc-200">{message.author}</strong>
                        <span className="text-zinc-500">{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-zinc-300">{message.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-500">No messages yet.</div>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-3 text-sm font-semibold text-zinc-200">Status History</div>
                {selectedTicket.statusHistory?.length ? (
                  <div className="space-y-2">
                    {selectedTicket.statusHistory.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                        <div>
                          <div className="text-sm text-zinc-100">{item.from} → {item.to}</div>
                          <div className="text-xs text-zinc-500">{item.by}</div>
                        </div>
                        <div className="text-xs text-zinc-500">{new Date(item.at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">No status transitions recorded yet.</div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Reply as admin</label>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  placeholder="Write your response..."
                  className="min-h-[120px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/40"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => patchTicket({ replyMessage })}
                    disabled={saving || !replyMessage.trim()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#b9accf]/35 bg-[#a996c4]/15 px-4 py-2 text-sm font-semibold text-[#ddd4ea] transition hover:bg-[#a996c4]/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Send Reply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
