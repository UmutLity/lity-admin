"use client";

import { Topbar } from "@/components/admin/topbar";
import { GuideForm } from "@/components/admin/guide-form";

export default function NewGuidePage() {
  return (
    <div>
      <Topbar title="New Guide" description="Create a product guide" />
      <GuideForm />
    </div>
  );
}
