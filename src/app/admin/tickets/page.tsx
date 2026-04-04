"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Send, Ticket } from "lucide-react";

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
  adminNotes?: string | null;
  email: string | null;
  discordUsername: string | null;
  createdAt: string;
  updatedAt: string;
  conversation: TicketMessage[];
  assignedTo?: { id: string; name: string; email?: string | null } | null;
}

const statusOptions: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const priorityOptions: TicketPriority[] = ["LOW", "NORMAL", "HIGH"];
const quickReplies = [
  {
    label: "Delivered",
    message:
      "Your delivery has been completed. Please check your dashboard order details. If anything looks wrong, reply here and we will help immediately.",
  },
  {
    label: "Need Info",
    message:
      "We are reviewing your request. Please send the missing details here so we can continue quickly: game, region, account type, and any extra note.",
  },
  {
    label: "Stock Delay",
    message:
      "Your request is queued but stock/delivery is delayed right now. We will update you as soon as your delivery is ready.",
  },
  {
    label: "Discord Check",
    message:
      "Please check our Discord ticket or direct messages as well. If you do not see a message, reply here and we will resend the delivery details.",
  },
];

function formatStatus(status: TicketStatus) {
  return status.replace("_", " ");
}

function statusClass(status: TicketStatus) {
  if (status === "OPEN") return "text-sky-300 border-sky-400/25 bg-sky-500/10";
  if (status === "IN_PROGRESS") return "text-amber-300 border-amber-400/25 bg-amber-500/10";
  if (status === "WAITING_CUSTOMER") return "text-orange-300 border-orange-400/25 bg-orange-500/10";
  if (status === "RESOLVED") return "text-emerald-300 border-emerald-400/25 bg-emerald-500/10";
  return "text-zinc-300 border-zinc-400/20 bg-zinc-500/10";
}

function priorityClass(priority: TicketPriority) {
  if (priority === "HIGH") return "text-rose-300 border-rose-400/25 bg-rose-500/10";
  if (priority === "LOW") return "text-zinc-300 border-zinc-400/20 bg-zinc-500/10";
  return "text-violet-200 border-violet-400/20 bg-violet-500/10";
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyMessage, setReplyMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredTickets = useMemo(() => tickets, [tickets]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedId) || filteredTickets[0] || null,
    [filteredTickets, selectedId]
  );

  const queueStats = useMemo(() => {
    return {
      total: filteredTickets.length,
      waitingCustomer: filteredTickets.filter((ticket) => ticket.status === "WAITING_CUSTOMER").length,
      highPriority: filteredTickets.filter((ticket) => ticket.priority === "HIGH").length,
      unassigned: filteredTickets.filter((ticket) => !ticket.assignedTo).length,
    };
  }, [filteredTickets]);

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

  async function patchTicket(
    payload: Partial<Pick<AdminTicket, "status" | "priority">> & {
      replyMessage?: string;
      assignAction?: "ASSIGN_SELF" | "UNASSIGN";
    }
  ) {
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

  async function assignTicket(action: "ASSIGN_SELF" | "UNASSIGN") {
    await patchTicket({ assignAction: action });
  }

  return (
    <div>
      <Topbar title="Tickets" description="Simple queue for support replies" />

      <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>{queueStats.total} tickets</span>
          <span>{queueStats.waitingCustomer} waiting customer</span>
          <span>{queueStats.highPriority} high priority</span>
          <span>{queueStats.unassigned} unassigned</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by subject, email, or Discord..."
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <div className="premium-card p-3">
          <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-zinc-200">
            <Ticket className="h-4 w-4 text-[#c7bdd8]" />
            Ticket List
          </div>

          <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-500">
                Loading tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-500">
                No tickets found.
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedTicket?.id === ticket.id
                      ? "border-[#b9accf]/35 bg-[#a996c4]/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        #{ticket.ticketNumber} {ticket.subject}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {ticket.email || ticket.discordUsername || "Customer"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(ticket.status)}`}>
                      {formatStatus(ticket.status)}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{ticket.message}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="premium-card p-4">
          {!selectedTicket ? (
            <div className="flex min-h-[560px] items-center justify-center text-sm text-zinc-500">
              Select a ticket to view details.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-white">
                    #{selectedTicket.ticketNumber} {selectedTicket.subject}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedTicket.email || selectedTicket.discordUsername || "Customer"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(selectedTicket.status)}`}>
                      {formatStatus(selectedTicket.status)}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityClass(selectedTicket.priority)}`}>
                      {selectedTicket.priority}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400">
                      {selectedTicket.assignedTo?.name || "Unassigned"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Updated {new Date(selectedTicket.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(event) => patchTicket({ status: event.target.value as TicketStatus })}
                    className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-zinc-200"
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
                    className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-zinc-200"
                    disabled={saving}
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => assignTicket(selectedTicket.assignedTo ? "UNASSIGN" : "ASSIGN_SELF")}
                    className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-semibold text-zinc-200"
                    disabled={saving}
                  >
                    {selectedTicket.assignedTo ? "Unassign" : "Assign to Me"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-3 text-sm font-semibold text-zinc-200">Conversation</div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {selectedTicket.conversation?.length ? (
                    selectedTicket.conversation.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-xl border p-3 ${
                          message.sender === "ADMIN"
                            ? "ml-8 border-[#b9accf]/20 bg-[#a996c4]/10"
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
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-3 text-sm font-semibold text-zinc-200">Reply</div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {quickReplies.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setReplyMessage(item.message)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-[#b9accf]/35 hover:bg-[#a996c4]/12 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  placeholder="Write your response..."
                  className="min-h-[220px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/40"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
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
