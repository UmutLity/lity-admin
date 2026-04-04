"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { AlertCircle, ExternalLink, MessageSquare, Send, Ticket } from "lucide-react";

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
  product?: { name: string; slug: string | null } | null;
  contactType?: string | null;
  adminNotes?: string | null;
  email: string | null;
  discordUsername: string | null;
  createdAt: string;
  updatedAt: string;
  conversation: TicketMessage[];
  statusHistory?: Array<{ id: string; from: string; to: string; at: string; by: string }>;
  assignedTo?: { id: string; name: string; email?: string | null } | null;
  assignedAt?: string | null;
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
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | TicketPriority>("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyMessage, setReplyMessage] = useState("");
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (priorityFilter !== "ALL" && ticket.priority !== priorityFilter) return false;
      if (assignmentFilter === "ASSIGNED" && !ticket.assignedTo) return false;
      if (assignmentFilter === "UNASSIGNED" && !!ticket.assignedTo) return false;
      return true;
    });
  }, [tickets, priorityFilter, assignmentFilter]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedId) || filteredTickets[0] || null,
    [filteredTickets, selectedId]
  );

  useEffect(() => {
    setAdminNotesDraft(selectedTicket?.adminNotes || "");
  }, [selectedTicket?.id, selectedTicket?.adminNotes]);

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
    payload: Partial<Pick<AdminTicket, "status" | "priority" | "adminNotes">> & {
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

  const queueStats = useMemo(() => {
    return {
      total: filteredTickets.length,
      waitingCustomer: filteredTickets.filter((x) => x.status === "WAITING_CUSTOMER").length,
      highPriority: filteredTickets.filter((x) => x.priority === "HIGH").length,
      unassigned: filteredTickets.filter((x) => !x.assignedTo).length,
    };
  }, [filteredTickets]);

  return (
    <div>
      <Topbar title="Tickets" description="User support tickets and admin replies" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-white">{queueStats.total}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Waiting Customer</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{queueStats.waitingCustomer}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">High Priority</p>
          <p className="mt-1 text-xl font-semibold text-rose-300">{queueStats.highPriority}</p>
        </div>
        <div className="kpi-card py-4">
          <p className="text-xs text-zinc-500">Unassigned</p>
          <p className="mt-1 text-xl font-semibold text-violet-300">{queueStats.unassigned}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_180px_180px]">
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
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as "ALL" | TicketPriority)}
          className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">All Priority</option>
          {priorityOptions.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <select
          value={assignmentFilter}
          onChange={(event) => setAssignmentFilter(event.target.value as "ALL" | "ASSIGNED" | "UNASSIGNED")}
          className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">All Queue</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="UNASSIGNED">Unassigned</option>
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
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-500">No tickets found.</div>
            ) : (
              filteredTickets.map((ticket) => (
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
                  <p className="mt-1 text-xs text-zinc-500">{ticket.email || ticket.discordUsername || "Customer"} · {ticket.priority}</p>
                  {ticket.assignedTo?.name ? <p className="mt-1 text-[11px] text-violet-300">Assigned to {ticket.assignedTo.name}</p> : null}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-violet-200">
                      {selectedTicket.assignedTo?.name ? `Assigned to ${selectedTicket.assignedTo.name}` : "Unassigned"}
                    </span>
                    {selectedTicket.assignedAt ? <span>Updated {new Date(selectedTicket.assignedAt).toLocaleString()}</span> : null}
                    {selectedTicket.product?.name ? <span>Product: {selectedTicket.product.name}</span> : null}
                  </div>
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

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <AlertCircle className="h-4 w-4 text-[#c7bdd8]" />
                    Ticket Context
                  </div>
                  <div className="space-y-2 text-sm text-zinc-400">
                    <div><span className="text-zinc-500">Contact:</span> {selectedTicket.contactType || "Unknown"}</div>
                    <div><span className="text-zinc-500">Priority:</span> {selectedTicket.priority}</div>
                    <div><span className="text-zinc-500">Opened:</span> {new Date(selectedTicket.createdAt).toLocaleString()}</div>
                    <div><span className="text-zinc-500">Updated:</span> {new Date(selectedTicket.updatedAt).toLocaleString()}</div>
                    {selectedTicket.product?.slug ? (
                      <div className="pt-1">
                        <Link
                          href={`/products/${selectedTicket.product.slug}`}
                          className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
                        >
                          Open product <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-200">Internal Notes</div>
                    <button
                      type="button"
                      onClick={() => patchTicket({ adminNotes: adminNotesDraft })}
                      disabled={saving}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-200"
                    >
                      Save Notes
                    </button>
                  </div>
                  <textarea
                    value={adminNotesDraft}
                    onChange={(event) => setAdminNotesDraft(event.target.value)}
                    placeholder="Private admin notes for this ticket..."
                    className="min-h-[120px] w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/40"
                  />
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
                <div className="flex flex-wrap gap-2">
                  {(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"] as TicketStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => patchTicket({ status })}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-[#b9accf]/35 hover:bg-[#a996c4]/12 hover:text-white"
                    >
                      Mark {formatStatus(status)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
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
