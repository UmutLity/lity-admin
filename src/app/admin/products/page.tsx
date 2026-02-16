"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Zap, Package, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "UNDETECTED", label: "Undetected" },
  { value: "DETECTED", label: "Detected" },
  { value: "UPDATING", label: "Updating" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

export default function ProductsPage() {
  const { addToast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick status change
  const [quickStatusId, setQuickStatusId] = useState<string | null>(null);
  const [quickStatus, setQuickStatus] = useState("");
  const [quickStatusNote, setQuickStatusNote] = useState("");

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted", description: "Product deleted successfully" });
        loadProducts();
      } else {
        addToast({ type: "error", title: "Error", description: "Delete operation failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Error" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleQuickStatus = async () => {
    if (!quickStatusId || !quickStatus) return;
    try {
      const res = await fetch(`/api/admin/products/${quickStatusId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: quickStatus, statusNote: quickStatusNote || null }),
      });
      if (res.ok) {
        addToast({ type: "success", title: "Updated", description: "Status changed" });
        loadProducts();
      }
    } catch (error) {
      addToast({ type: "error", title: "Error" });
    } finally {
      setQuickStatusId(null);
      setQuickStatus("");
      setQuickStatusNote("");
    }
  };

  const getMinPrice = (product: any) => {
    if (!product.prices?.length) return null;
    const min = Math.min(...product.prices.map((p: any) => p.price));
    return formatCurrency(min, product.currency);
  };

  return (
    <div>
      <Topbar title="Products" description="Manage all products">
        <Link href="/admin/products/new">
          <Button><Plus className="h-4 w-4" /> New Product</Button>
        </Link>
      </Topbar>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="p-8"><div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState icon={Package} title="No products yet" description="Get started by adding your first product">
            <Link href="/admin/products/new"><Button><Plus className="h-4 w-4" /> New Product</Button></Link>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">/{product.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} />
                    {product.statusNote && <p className="text-xs text-muted-foreground mt-1">{product.statusNote}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {getMinPrice(product) ? `From ${getMinPrice(product)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {product.lastUpdateAt ? (
                      <div className="group relative">
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {timeAgo(product.lastUpdateAt)}
                        </span>
                        <div className="absolute hidden group-hover:block bottom-full left-0 bg-popover border rounded-md px-2 py-1 text-xs shadow-lg whitespace-nowrap z-10 mb-1">
                          {formatDate(product.lastUpdateAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {product.isActive && <Badge variant="success" className="text-[10px]">Active</Badge>}
                      {product.isFeatured && <Badge variant="info" className="text-[10px]">Featured</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}/edit`} className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setQuickStatusId(product.id); setQuickStatus(product.status); setQuickStatusNote(product.statusNote || ""); }}>
                          <Zap className="h-4 w-4 mr-2" /> Quick Status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(product.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>This action cannot be undone. The product will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Status Dialog */}
      <Dialog open={!!quickStatusId} onOpenChange={() => setQuickStatusId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Status Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              options={statusOptions.filter((s) => s.value !== "")}
              value={quickStatus}
              onChange={(e) => setQuickStatus(e.target.value)}
            />
            <Input
              placeholder="Status note (optional)"
              value={quickStatusNote}
              onChange={(e) => setQuickStatusNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickStatusId(null)}>Cancel</Button>
            <Button onClick={handleQuickStatus}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
