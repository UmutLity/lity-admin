"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select-native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  Plus, MoreHorizontal, Trash2, Users, UserCog, Shield,
  Crown, Ban, Search, UserPlus, UserCheck, UserX, KeyRound,
  Copy, RefreshCw, Eye, EyeOff, Check,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Generate a strong random password
function generatePassword(length = 16): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*_-+=";
  const all = upper + lower + digits + symbols;

  // Ensure at least one of each
  let pass = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  for (let i = pass.length; i < length; i++) {
    pass.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle
  for (let i = pass.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pass[i], pass[j]] = [pass[j], pass[i]];
  }

  return pass.join("");
}

export default function UsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin create dialog
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", name: "", password: "", role: "EDITOR" });

  // Customer create dialog
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    email: "", username: "", password: "", role: "MEMBER",
    isActive: true, mustChangePassword: true,
  });
  const [showNewCustPassword, setShowNewCustPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Password reset dialog
  const [resetPasswordFor, setResetPasswordFor] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Other dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "user" | "customer" } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<any>(null);

  const loadData = async () => {
    try {
      const [usersRes, customersRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/customers", { credentials: "include" }),
      ]);
      const usersData = await usersRes.json();
      const customersData = await customersRes.json();
      setUsers(usersData.data || []);
      setCustomers(customersData.data || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Create Admin User ───────────────────────────────
  const handleCreateAdmin = async () => {
    setCreatingAdmin(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAdmin),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: "Admin user created" });
        setShowCreateAdmin(false);
        setNewAdmin({ email: "", name: "", password: "", role: "EDITOR" });
        loadData();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch { addToast({ type: "error", title: "Error" }); }
    finally { setCreatingAdmin(false); }
  };

  // ─── Create Customer Account ─────────────────────────
  const handleCreateCustomer = async () => {
    if (!newCustomer.email || !newCustomer.username || !newCustomer.password) {
      addToast({ type: "error", title: "All fields required" });
      return;
    }
    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: "success", title: "Customer account created", description: `${newCustomer.username} has been created` });
        setShowCreateCustomer(false);
        setNewCustomer({ email: "", username: "", password: "", role: "MEMBER", isActive: true, mustChangePassword: true });
        setShowNewCustPassword(false);
        loadData();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch { addToast({ type: "error", title: "Connection error" }); }
    finally { setCreatingCustomer(false); }
  };

  // ─── Reset Customer Password ─────────────────────────
  const handleResetPassword = async () => {
    if (!resetPasswordFor || !newPassword) return;
    if (newPassword.length < 6) {
      addToast({ type: "error", title: "Password must be at least 6 characters" });
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/admin/customers/${resetPasswordFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword, mustChangePassword: true }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: "success", title: "Password reset", description: `Password for ${resetPasswordFor.username} has been reset. User must change it on next login.` });
        setResetPasswordFor(null);
        setNewPassword("");
        setShowResetPassword(false);
        loadData();
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch { addToast({ type: "error", title: "Error" }); }
    finally { setResettingPassword(false); }
  };

  const toggleActive = async (id: string, isActive: boolean, type: "user" | "customer") => {
    const url = type === "user" ? `/api/admin/users/${id}` : `/api/admin/customers/${id}`;
    const method = type === "user" ? "PUT" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        addToast({ type: "success", title: isActive ? "Account suspended" : "Account activated" });
        loadData();
      }
    } catch { addToast({ type: "error", title: "Error" }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.type === "user"
        ? `/api/admin/users/${deleteTarget.id}`
        : `/api/admin/customers/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted" });
        loadData();
      } else {
        const data = await res.json();
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch { addToast({ type: "error", title: "Error" }); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const updateCustomerRole = async (id: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: "success", title: "Role updated", description: `Customer role changed to ${role}` });
        loadData();
        setEditCustomer(null);
      } else {
        addToast({ type: "error", title: "Failed", description: data.error || "Could not update role" });
      }
    } catch { addToast({ type: "error", title: "Error" }); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredCustomers = customers.filter((c) =>
    c.username.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Stats
  const activeCustomers = customers.filter(c => c.isActive).length;
  const bannedCustomers = customers.filter(c => c.role === "BANNED").length;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = customers.filter(c => new Date(c.createdAt) > weekAgo).length;

  const customerRoleBadge = (role: string) => {
    switch (role) {
      case "VIP": return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
          <Crown className="h-3 w-3" /> VIP
        </span>
      );
      case "BANNED": return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 px-2.5 py-0.5 text-xs font-semibold">
          <Ban className="h-3 w-3" /> Banned
        </span>
      );
      default: return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 text-zinc-400 px-2.5 py-0.5 text-xs font-semibold">
          Member
        </span>
      );
    }
  };

  return (
    <div>
      <Topbar title="Users & Customers" description="Manage admin staff and customer accounts. Only admins can create accounts.">
        <div className="flex gap-2">
          <Button onClick={() => {
            const pw = generatePassword();
            setNewCustomer({ ...newCustomer, password: pw });
            setShowCreateCustomer(true);
          }} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0 text-white shadow-glow">
            <UserPlus className="h-4 w-4" /> New Customer
          </Button>
          <Button onClick={() => setShowCreateAdmin(true)} className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 border-0 text-white shadow-glow">
            <Plus className="h-4 w-4" /> New Admin User
          </Button>
        </div>
      </Topbar>

      {/* Customer KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/15">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-white">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15">
              <UserCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Active</p>
              <p className="text-xl font-bold text-white">{activeCustomers}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15">
              <UserX className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Banned</p>
              <p className="text-xl font-bold text-white">{bannedCustomers}</p>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/15">
              <UserPlus className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">New (7d)</p>
              <p className="text-xl font-bold text-white">{newThisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" /> Customers
            <Badge variant="secondary" className="ml-1 text-[10px]">{customers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <Shield className="h-4 w-4" /> Admin Staff
            <Badge variant="secondary" className="ml-1 text-[10px]">{users.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <div className="premium-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Customer Accounts</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Accounts can only be created by administrators</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <input
                  placeholder="Search customers..."
                  className="h-9 pl-9 pr-4 w-64 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/30 transition-all"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 w-full" />)}</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={Users} title="No customers yet" description="Create customer accounts using the 'New Customer' button above" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full premium-table">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">User</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Last Login</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                      <th className="w-[50px] px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="group">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
                              customer.role === "VIP"
                                ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-400"
                                : customer.role === "BANNED"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-purple-500/15 text-purple-400"
                            )}>
                              {customer.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-zinc-200 block">{customer.username}</span>
                              {customer.mustChangePassword && (
                                <span className="text-[10px] text-amber-500 flex items-center gap-1">
                                  <KeyRound className="h-2.5 w-2.5" /> Must change password
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm text-zinc-500">{customer.email}</td>
                        <td className="px-6 py-3">{customerRoleBadge(customer.role)}</td>
                        <td className="px-6 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium",
                            customer.isActive ? "text-emerald-400" : "text-zinc-500"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              customer.isActive ? "bg-emerald-400" : "bg-zinc-500"
                            )} />
                            {customer.isActive ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-zinc-600">
                          {customer.lastLoginAt ? formatDate(customer.lastLoginAt) : "Never"}
                        </td>
                        <td className="px-6 py-3 text-xs text-zinc-600">{formatDate(customer.createdAt)}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0d1424] border-white/[0.08]">
                              <DropdownMenuItem onClick={() => setEditCustomer(customer)}>
                                <Crown className="h-4 w-4 mr-2" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const pw = generatePassword();
                                setNewPassword(pw);
                                setShowResetPassword(false);
                                setResetPasswordFor(customer);
                              }}>
                                <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(customer.id, customer.isActive, "customer")}>
                                <UserCog className="h-4 w-4 mr-2" /> {customer.isActive ? "Suspend" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.06]" />
                              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteTarget({ id: customer.id, type: "customer" })}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Admin Staff Tab */}
        <TabsContent value="admins">
          <div className="premium-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">Admin Staff</h3>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-14 w-full" />)}</div>
            ) : users.length === 0 ? (
              <div className="p-8"><EmptyState icon={Users} title="No admin users" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full premium-table">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Created</th>
                      <th className="w-[50px] px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {users.map((user) => (
                      <tr key={user.id} className="group">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center text-purple-400 text-xs font-bold flex-shrink-0">
                              {(user.name || "A").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-zinc-200">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm text-zinc-500">{user.email}</td>
                        <td className="px-6 py-3">
                          <Badge
                            variant={user.role === "ADMIN" ? "default" : "secondary"}
                            className={cn(
                              user.role === "ADMIN" && "bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 border border-purple-500/20"
                            )}
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium",
                            user.isActive ? "text-emerald-400" : "text-zinc-500"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              user.isActive ? "bg-emerald-400" : "bg-zinc-500"
                            )} />
                            {user.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-zinc-600">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0d1424] border-white/[0.08]">
                              <DropdownMenuItem onClick={() => toggleActive(user.id, user.isActive, "user")}>
                                <UserCog className="h-4 w-4 mr-2" /> {user.isActive ? "Disable" : "Enable"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.06]" />
                              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteTarget({ id: user.id, type: "user" })}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Create Admin User Dialog ═══ */}
      <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
        <DialogContent className="bg-[#0d1424] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-purple-400" /> New Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Full name" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="admin@example.com" /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Min 6 characters" /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select options={[{ value: "ADMIN", label: "Admin" }, { value: "EDITOR", label: "Editor" }, { value: "VIEWER", label: "Viewer" }]} value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAdmin(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} loading={creatingAdmin} className="bg-gradient-to-r from-purple-600 to-violet-600 border-0 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Create Customer Account Dialog ═══ */}
      <Dialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
        <DialogContent className="bg-[#0d1424] border-white/[0.08] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-400" /> Create Customer Account</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Create a new customer account. The user will receive credentials from you manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username <span className="text-red-400">*</span></Label>
                <Input value={newCustomer.username} onChange={(e) => setNewCustomer({ ...newCustomer, username: e.target.value })} placeholder="johndoe" />
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-red-400">*</span></Label>
                <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="john@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password <span className="text-red-400">*</span></Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-purple-400 hover:text-purple-300"
                  onClick={() => setNewCustomer({ ...newCustomer, password: generatePassword() })}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showNewCustPassword ? "text" : "password"}
                  value={newCustomer.password}
                  onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowNewCustPassword(!showNewCustPassword)}
                  >
                    {showNewCustPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(newCustomer.password)}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  options={[
                    { value: "MEMBER", label: "Member" },
                    { value: "VIP", label: "VIP" },
                  ]}
                  value={newCustomer.role}
                  onChange={(e) => setNewCustomer({ ...newCustomer, role: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Suspended" },
                  ]}
                  value={String(newCustomer.isActive)}
                  onChange={(e) => setNewCustomer({ ...newCustomer, isActive: e.target.value === "true" })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <input
                type="checkbox"
                id="mustChangePassword"
                checked={newCustomer.mustChangePassword}
                onChange={(e) => setNewCustomer({ ...newCustomer, mustChangePassword: e.target.checked })}
                className="rounded border-white/20"
              />
              <label htmlFor="mustChangePassword" className="text-xs text-amber-400 cursor-pointer">
                Force password change on first login
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCustomer(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomer} loading={creatingCustomer} className="bg-gradient-to-r from-emerald-600 to-teal-600 border-0 text-white">
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Reset Password Dialog ═══ */}
      <Dialog open={!!resetPasswordFor} onOpenChange={() => { setResetPasswordFor(null); setNewPassword(""); }}>
        <DialogContent className="bg-[#0d1424] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-amber-400" /> Reset Password</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Reset password for <span className="text-white font-medium">{resetPasswordFor?.username}</span>. The user will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          {resetPasswordFor && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 flex items-center justify-center font-bold text-purple-400">
                  {resetPasswordFor.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{resetPasswordFor.username}</p>
                  <p className="text-xs text-zinc-500">{resetPasswordFor.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>New Password</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-purple-400 hover:text-purple-300"
                    onClick={() => setNewPassword(generatePassword())}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Generate
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type={showResetPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowResetPassword(!showResetPassword)}>
                      {showResetPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(newPassword)}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-amber-400">The user will be required to change their password on next login.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordFor(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={handleResetPassword} loading={resettingPassword} className="bg-gradient-to-r from-amber-600 to-orange-600 border-0 text-white">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Customer Role Dialog ═══ */}
      <Dialog open={!!editCustomer} onOpenChange={() => setEditCustomer(null)}>
        <DialogContent className="bg-[#0d1424] border-white/[0.08]">
          <DialogHeader><DialogTitle>Change Customer Role</DialogTitle></DialogHeader>
          {editCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 flex items-center justify-center font-bold text-purple-400">
                  {editCustomer.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{editCustomer.username}</p>
                  <p className="text-xs text-zinc-500">{editCustomer.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  options={[
                    { value: "MEMBER", label: "Member - Standard access" },
                    { value: "VIP", label: "VIP - Premium customer" },
                    { value: "BANNED", label: "Banned - Access revoked" },
                  ]}
                  value={editCustomer.role}
                  onChange={(e) => setEditCustomer({ ...editCustomer, role: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)}>Cancel</Button>
            <Button onClick={() => editCustomer && updateCustomerRole(editCustomer.id, editCustomer.role)} className="bg-gradient-to-r from-purple-600 to-violet-600 border-0 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#0d1424] border-white/[0.08]">
          <DialogHeader><DialogTitle>Delete {deleteTarget?.type === "customer" ? "Customer" : "User"}</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">This action cannot be undone. All associated data will be permanently deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
