"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { KeyRound, Plus, Save, Trash2, Users, Check, Shield } from "lucide-react";

interface RoleData {
  id: string;
  name: string;
  label: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
}

const PERMISSION_GROUPS: Record<string, { label: string; perms: string[] }> = {
  product: { label: "Products", perms: ["product.view","product.create","product.update","product.delete","product.status.change"] },
  changelog: { label: "Changelog", perms: ["changelog.view","changelog.create","changelog.update","changelog.delete","changelog.publish"] },
  settings: { label: "Settings", perms: ["settings.view","settings.update"] },
  media: { label: "Media", perms: ["media.view","media.upload","media.delete"] },
  user: { label: "Users", perms: ["user.view","user.manage"] },
  role: { label: "Roles", perms: ["role.view","role.manage"] },
  audit: { label: "Audit", perms: ["audit.view"] },
  security: { label: "Security", perms: ["security.view","security.manage"] },
  webhook: { label: "Discord", perms: ["webhook.test","webhook.manage"] },
};

export default function RolesPage() {
  const { addToast } = useToast();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showNew, setShowNew] = useState(false);

  const loadRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (data.success) setRoles(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRoles(); }, []);

  const startEdit = (role: RoleData) => {
    setEditingId(role.id);
    setEditPerms([...role.permissions]);
    setEditLabel(role.label);
  };

  const togglePerm = (perm: string) => {
    setEditPerms((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/admin/roles/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel, permissions: editPerms }),
    });
    if (res.ok) {
      addToast({ type: "success", title: "Role updated" });
      setEditingId(null);
      loadRoles();
    } else {
      addToast({ type: "error", title: "Error" });
    }
  };

  const handleCreate = async () => {
    if (!newName || !newLabel) return;
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, label: newLabel, permissions: [] }),
    });
    if (res.ok) {
      addToast({ type: "success", title: "New role created" });
      setShowNew(false);
      setNewName("");
      setNewLabel("");
      loadRoles();
    } else {
      const err = await res.json();
      addToast({ type: "error", title: err.error || "Error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast({ type: "success", title: "Role deleted" });
      loadRoles();
    } else {
      const err = await res.json();
      addToast({ type: "error", title: err.error || "Error" });
    }
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Roles & Permissions" />
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Roles & Permissions" description="Role-based access control management">
        <Button onClick={() => setShowNew(!showNew)}><Plus className="h-4 w-4" /> New Role</Button>
      </Topbar>

      {showNew && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Create New Role</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Role Name (technical)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="MODERATOR" className="font-mono" />
              </div>
              <div className="flex-1">
                <Label>Display Name</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Moderatör" />
              </div>
              <Button onClick={handleCreate}><Plus className="h-4 w-4" /> Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {role.isSystem ? <Shield className="h-5 w-5 text-primary" /> : <KeyRound className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    {editingId === role.id ? (
                      <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-sm font-bold w-48" />
                    ) : (
                      <CardTitle className="text-base">{role.label}</CardTitle>
                    )}
                    <CardDescription className="font-mono text-xs">{role.name}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary"><Users className="h-3 w-3 mr-1" /> {role._count?.users || 0} users</Badge>
                  {role.isSystem && <Badge>System</Badge>}
                  {editingId === role.id ? (
                    <>
                      <Button size="sm" onClick={handleSave}><Save className="h-4 w-4" /> Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(role)}>Edit</Button>
                      {!role.isSystem && <Button size="sm" variant="ghost" onClick={() => handleDelete(role.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
                  <div key={groupKey} className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</h4>
                    <div className="space-y-1">
                      {group.perms.map((perm) => {
                        const isActive = editingId === role.id ? editPerms.includes(perm) : role.permissions.includes(perm);
                        return (
                          <button
                            key={perm}
                            disabled={editingId !== role.id}
                            onClick={() => editingId === role.id && togglePerm(perm)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                              isActive ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                            } ${editingId === role.id ? "cursor-pointer hover:bg-primary/20" : "cursor-default"}`}
                          >
                            <Check className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-0"}`} />
                            <span className="font-mono">{perm}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
