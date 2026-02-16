"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { X, Copy, MessageSquare, ExternalLink } from "lucide-react";

interface ChangelogEmbedModalProps {
  changelogId: string;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  UPDATE: "#7c3aed",
  FIX: "#22c55e",
  INFO: "#3b82f6",
  WARNING: "#f59e0b",
};

const TYPE_EMOJIS: Record<string, string> = {
  UPDATE: "🆕",
  FIX: "🐛",
  INFO: "ℹ️",
  WARNING: "⚠️",
};

export function ChangelogEmbedModal({ changelogId, onClose }: ChangelogEmbedModalProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [embedData, setEmbedData] = useState<any>(null);
  const [jsonText, setJsonText] = useState("");

  useEffect(() => {
    async function loadEmbed() {
      try {
        const res = await fetch("/api/admin/discord/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changelogId }),
        });
        const data = await res.json();
        if (data.success) {
          setEmbedData(data.data);
          setJsonText(data.data.json);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadEmbed();
  }, [changelogId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: "success", title: `${label} kopyalandı!` });
  };

  const embed = embedData?.embed?.embeds?.[0];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#5865F2]" /> Discord Embed Oluşturucu
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="p-8 text-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-2" /><p className="text-muted-foreground">Yükleniyor...</p></div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
              {/* Left: Discord Preview */}
              <div className="p-6">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Discord Önizleme</h4>
                <div className="bg-[#313338] rounded-lg p-4">
                  {/* Bot message */}
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{embedData?.fullPayload?.username || "Lity Software"}</span>
                        <Badge className="bg-[#5865F2] text-white text-[10px] px-1 py-0">BOT</Badge>
                      </div>

                      {/* Embed */}
                      {embed && (
                        <div className="rounded overflow-hidden" style={{ borderLeft: `4px solid ${embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#7c3aed"}` }}>
                          <div className="bg-[#2b2d31] p-3">
                            <p className="text-white font-semibold text-sm mb-2">{embed.title}</p>
                            <p className="text-[#dbdee1] text-xs whitespace-pre-wrap leading-relaxed">{embed.description?.slice(0, 300)}{embed.description?.length > 300 ? "..." : ""}</p>

                            {embed.fields && embed.fields.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {embed.fields.map((field: any, i: number) => (
                                  <div key={i}>
                                    <p className="text-[#dbdee1] text-[11px] font-semibold">{field.name}</p>
                                    <p className="text-[#b5bac1] text-xs">{field.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 pt-2 border-t border-[#3f4147] flex items-center gap-2">
                              <span className="text-[#b5bac1] text-[10px]">{embed.footer?.text}</span>
                              <span className="text-[#b5bac1] text-[10px]">•</span>
                              <span className="text-[#b5bac1] text-[10px]">{embed.timestamp ? new Date(embed.timestamp).toLocaleDateString() : ""}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: JSON */}
              <div className="p-6">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Webhook JSON</h4>
                <div className="relative">
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[400px] font-mono whitespace-pre-wrap">
                    {jsonText}
                  </pre>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => copyToClipboard(jsonText, "JSON")} className="flex-1">
                    <Copy className="h-4 w-4" /> JSON Kopyala
                  </Button>
                  <Button variant="outline" onClick={() => copyToClipboard(jsonText, "Discohook JSON")} className="flex-1">
                    <ExternalLink className="h-4 w-4" /> Discohook JSON
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
