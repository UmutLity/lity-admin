"use client";

import { Topbar } from "@/components/admin/topbar";
import { ChangelogForm } from "@/components/admin/changelog-form";

export default function NewChangelogPage() {
  return (
    <div>
      <Topbar title="New Changelog" description="Create a new changelog entry" />
      <ChangelogForm />
    </div>
  );
}
