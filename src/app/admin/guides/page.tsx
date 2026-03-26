"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, MoreHorizontal, Pencil, Trash2, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function GuidesPage() {
  const { addToast } = useToast();
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGuides = async () => {
    try {
      const res = await fetch("/api/admin/guides");
      const data = await res.json();
      setGuides(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuides();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/guides/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted" });
        loadGuides();
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div>
      <Topbar title="Guides" description="Manage product-specific guides">
        <Link href="/admin/guides/new">
          <Button>
            <Plus className="h-4 w-4" /> New Guide
          </Button>
        </Link>
      </Topbar>

      {loading ? (
        <Card className="p-8">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
        </Card>
      ) : guides.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No guides yet" description="Create your first guide">
            <Link href="/admin/guides/new">
              <Button>
                <Plus className="h-4 w-4" /> New Guide
              </Button>
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {guides.map((guide) => (
                <TableRow key={guide.id}>
                  <TableCell className="font-medium">{guide.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{guide.product?.name || "-"}</Badge>
                  </TableCell>
                  <TableCell>{guide.isDraft ? <Badge variant="outline">Draft</Badge> : <Badge variant="success">Published</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(guide.publishedAt || guide.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/guides/${guide.id}/edit`} className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(guide.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Guide</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
