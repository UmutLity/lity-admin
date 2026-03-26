"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/admin/topbar";
import { GuideForm } from "@/components/admin/guide-form";

export default function EditGuidePage() {
  const params = useParams();
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/guides/${params.id}`);
        const data = await res.json();
        if (data.success) setGuide(data.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div>
        <Topbar title="Edit Guide" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div>
        <Topbar title="Not Found" />
        <p className="text-muted-foreground">Guide not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={`Edit: ${guide.title}`} />
      <GuideForm initialData={guide} isEditing />
    </div>
  );
}
