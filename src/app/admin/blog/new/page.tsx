"use client";

import { Topbar } from "@/components/admin/topbar";
import { BlogForm } from "@/components/admin/blog-form";

export default function NewBlogPage() {
  return (
    <div>
      <Topbar title="New Blog Post" description="Create a public article" />
      <BlogForm />
    </div>
  );
}

