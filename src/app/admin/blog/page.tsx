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
import { Plus, MoreHorizontal, Pencil, Trash2, Newspaper } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function BlogPage() {
  const { addToast } = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPosts = async () => {
    try {
      const res = await fetch("/api/admin/blog");
      const data = await res.json();
      setPosts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: "Deleted" });
        loadPosts();
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div>
      <Topbar title="Blog" description="Manage public blog articles">
        <Link href="/admin/blog/new">
          <Button>
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </Topbar>

      {loading ? (
        <Card className="p-8">
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState icon={Newspaper} title="No blog posts yet" description="Create your first blog post">
            <Link href="/admin/blog/new">
              <Button>
                <Plus className="h-4 w-4" /> New Post
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
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-0.5">
                      <div>{post.title}</div>
                      <div className="text-xs text-muted-foreground">/{post.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{post.authorName || "-"}</Badge>
                  </TableCell>
                  <TableCell>{post.isDraft ? <Badge variant="outline">Draft</Badge> : <Badge variant="success">Published</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(post.publishedAt || post.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/blog/${post.id}/edit`} className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(post.id)}>
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
            <DialogTitle>Delete Blog Post</DialogTitle>
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

