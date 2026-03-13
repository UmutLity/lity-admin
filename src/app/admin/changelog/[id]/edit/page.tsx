"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/admin/topbar";
import { ChangelogForm } from "@/components/admin/changelog-form";
import { ChangelogEmbedModal } from "@/components/admin/changelog-embed-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export default function EditChangelogPage() {
  const params = useParams();
  const [changelog, setChangelog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/changelog/${params.id}`);
        const data = await res.json();
        if (data.success) setChangelog(data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div>
        <Topbar title="Edit Changelog" />
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!changelog) {
    return <div><Topbar title="Not Found" /><p className="text-muted-foreground">Record not found.</p></div>;
  }

  return (
    <div>
      <Topbar title={`Edit: ${changelog.title}`}>
        <Button variant="outline" onClick={() => setShowEmbed(true)}>
          <MessageSquare className="h-4 w-4 text-[#5865F2]" /> Discord Embed
        </Button>
        {changelog.webhookDeliveries?.length > 0 && (
          <Badge variant={changelog.webhookDeliveries[0].success ? "success" : "destructive"} className="text-xs">
            {changelog.webhookDeliveries[0].success ? "Sent to Discord" : "Delivery failed"}
          </Badge>
        )}
      </Topbar>
      <ChangelogForm initialData={changelog} isEditing />

      {showEmbed && (
        <ChangelogEmbedModal changelogId={changelog.id} onClose={() => setShowEmbed(false)} />
      )}
    </div>
  );
}
