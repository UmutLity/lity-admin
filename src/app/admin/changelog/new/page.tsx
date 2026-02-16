"use client";

import { Topbar } from "@/components/admin/topbar";
import { ChangelogForm } from "@/components/admin/changelog-form";

export default function NewChangelogPage() {
  return (
    <div>
      <Topbar title="Yeni Changelog" description="Yeni bir duyuru veya güncelleme kaydı oluşturun" />
      <ChangelogForm />
    </div>
  );
}
