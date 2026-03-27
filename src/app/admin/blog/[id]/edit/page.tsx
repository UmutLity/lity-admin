"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/admin/topbar";
import { BlogForm } from "@/components/admin/blog-form";

export default function EditBlogPage() {
  const params = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/blog/${params.id}`);
        const data = await res.json();
        if (data.success) setPost(data.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div>
        <Topbar title="Edit Blog Post" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div>
        <Topbar title="Not Found" />
        <p className="text-muted-foreground">Blog post not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={`Edit: ${post.title}`} />
      <BlogForm initialData={post} isEditing />
    </div>
  );
}

