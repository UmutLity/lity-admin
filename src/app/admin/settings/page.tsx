"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Save, Globe, Palette, Layout, Share2, MessageSquare, AlertTriangle,
  Send, CheckCircle, XCircle, Shield, ShoppingCart, Wifi, WifiOff,
} from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  group: string;
  label: string | null;
}

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.data) {
          setSettings(data.data);
          const v: Record<string, string> = {};
          data.data.forEach((s: Setting) => { v[s.key] = s.value; });
          setValues(v);
          if (v.discord_webhook_last_test) {
            try { setLastTestResult(JSON.parse(v.discord_webhook_last_test)); } catch {}
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const setBoolValue = (key: string, checked: boolean) => {
    setValues((prev) => ({ ...prev, [key]: String(checked) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsPayload = Object.entries(values).map(([key, value]) => ({ key, value }));
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsPayload }),
      });
      if (res.ok) {
        addToast({ type: "success", title: "Saved", description: "Site settings updated" });
      } else {
        addToast({ type: "error", title: "Error", description: "Save failed" });
      }
    } catch (error) {
      addToast({ type: "error", title: "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await fetch("/api/admin/discord/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLastTestResult(data.data);
        addToast({
          type: data.data.success ? "success" : "error",
          title: data.data.success ? "Test successful!" : "Test failed",
          description: data.data.success ? "Discord message sent" : `Error: ${data.data.responseBody}`,
        });
      } else {
        addToast({ type: "error", title: "Error", description: data.error });
      }
    } catch (error) {
      addToast({ type: "error", title: "Connection error" });
    } finally {
      setTestingWebhook(false);
    }
  };

  const getSettingsByGroup = (group: string) => settings.filter((s) => s.group === group);

  const renderField = (setting: Setting) => {
    const value = values[setting.key] || "";
    if (setting.type === "color") {
      return (
        <div className="flex items-center gap-3">
          <input type="color" value={value || "#7c3aed"} onChange={(e) => updateValue(setting.key, e.target.value)} className="h-10 w-14 rounded-md border border-input cursor-pointer" />
          <Input value={value} onChange={(e) => updateValue(setting.key, e.target.value)} placeholder="#7c3aed" className="w-32 font-mono text-sm" />
        </div>
      );
    }
    if (setting.key.includes("description") || setting.key.includes("subtitle")) {
      return <Textarea value={value} onChange={(e) => updateValue(setting.key, e.target.value)} rows={3} />;
    }
    return <Input value={value} onChange={(e) => updateValue(setting.key, e.target.value)} type={setting.type === "image" ? "url" : "text"} />;
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Site Settings" />
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Site Settings" description="Manage site content without coding">
        <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
      </Topbar>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-2"><Globe className="h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="hero" className="gap-2"><Layout className="h-4 w-4" /> Hero</TabsTrigger>
          <TabsTrigger value="social" className="gap-2"><Share2 className="h-4 w-4" /> Social</TabsTrigger>
          <TabsTrigger value="theme" className="gap-2"><Palette className="h-4 w-4" /> Theme</TabsTrigger>
          <TabsTrigger value="discord" className="gap-2"><MessageSquare className="h-4 w-4" /> Discord</TabsTrigger>
          <TabsTrigger value="emergency" className="gap-2"><AlertTriangle className="h-4 w-4" /> Emergency Controls</TabsTrigger>
        </TabsList>

        {["general", "hero", "social", "theme"].map((group) => (
          <TabsContent key={group} value={group}>
            <Card>
              <CardHeader>
                <CardTitle>{group === "general" ? "General Settings" : group === "hero" ? "Homepage Hero" : group === "social" ? "Social Media Links" : "Theme Settings"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {getSettingsByGroup(group).map((setting) => (
                  <div key={setting.key} className="space-y-2">
                    <Label>{setting.label || setting.key}</Label>
                    {renderField(setting)}
                    <p className="text-xs text-muted-foreground font-mono">{setting.key}</p>
                  </div>
                ))}
                {getSettingsByGroup(group).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No settings in this group yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Discord Integration */}
        <TabsContent value="discord">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Discord Webhook Integration</CardTitle>
              <CardDescription>Send automatic Discord notification when changelog is published</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={values.discord_webhook_url || ""}
                  onChange={(e) => updateValue("discord_webhook_url", e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  type="url"
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">Automatic Sending</p>
                  <p className="text-sm text-muted-foreground">Automatically send Discord message when changelog is published</p>
                </div>
                <Switch
                  checked={values.discord_webhook_enabled === "true"}
                  onCheckedChange={(checked) => setBoolValue("discord_webhook_enabled", checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bot Username</Label>
                  <Input value={values.discord_webhook_username || ""} onChange={(e) => updateValue("discord_webhook_username", e.target.value)} placeholder="Lity Software" />
                </div>
                <div className="space-y-2">
                  <Label>Bot Avatar URL</Label>
                  <Input value={values.discord_webhook_avatar_url || ""} onChange={(e) => updateValue("discord_webhook_avatar_url", e.target.value)} placeholder="https://..." type="url" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleTestWebhook} loading={testingWebhook} variant="outline" disabled={!values.discord_webhook_url}>
                  <Send className="h-4 w-4" /> Send Test
                </Button>
                {lastTestResult && (
                  <div className="flex items-center gap-2 text-sm">
                    {lastTestResult.success ? (
                      <><CheckCircle className="h-4 w-4 text-green-500" /> <span className="text-green-500">Success</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-500" /> <span className="text-red-500">Failed ({lastTestResult.responseCode})</span></>
                    )}
                    {lastTestResult.date && <span className="text-xs text-muted-foreground">{new Date(lastTestResult.date).toLocaleString("en-US")}</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">Status Changes Affect Last Update</p>
                  <p className="text-sm text-muted-foreground">Update &quot;Last Update&quot; date when product status changes</p>
                </div>
                <Switch
                  checked={values.status_changes_affect_last_update === "true"}
                  onCheckedChange={(checked) => setBoolValue("status_changes_affect_last_update", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Controls */}
        <TabsContent value="emergency">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /> Emergency Controls</CardTitle>
              <CardDescription>These settings take effect immediately. Use with caution!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Maintenance Mode */}
              <div className={`flex items-center justify-between p-5 rounded-lg border-2 transition-colors ${values.maintenance_mode === "true" ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${values.maintenance_mode === "true" ? "bg-red-500/20" : "bg-muted"}`}>
                    <Shield className={`h-5 w-5 ${values.maintenance_mode === "true" ? "text-red-500" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-semibold">Maintenance Mode</p>
                    <p className="text-sm text-muted-foreground">Shows maintenance banner on public site</p>
                  </div>
                </div>
                <Switch
                  checked={values.maintenance_mode === "true"}
                  onCheckedChange={(checked) => setBoolValue("maintenance_mode", checked)}
                />
              </div>

              {/* Disable Purchases */}
              <div className={`flex items-center justify-between p-5 rounded-lg border-2 transition-colors ${values.disable_purchases === "true" ? "border-orange-500/50 bg-orange-500/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${values.disable_purchases === "true" ? "bg-orange-500/20" : "bg-muted"}`}>
                    <ShoppingCart className={`h-5 w-5 ${values.disable_purchases === "true" ? "text-orange-500" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-semibold">Disable Purchases</p>
                    <p className="text-sm text-muted-foreground">Disables checkout/buy buttons</p>
                  </div>
                </div>
                <Switch
                  checked={values.disable_purchases === "true"}
                  onCheckedChange={(checked) => setBoolValue("disable_purchases", checked)}
                />
              </div>

              {/* Public API Pause */}
              <div className={`flex items-center justify-between p-5 rounded-lg border-2 transition-colors ${values.public_api_pause === "true" ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${values.public_api_pause === "true" ? "bg-yellow-500/20" : "bg-muted"}`}>
                    {values.public_api_pause === "true" ? <WifiOff className="h-5 w-5 text-yellow-500" /> : <Wifi className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-semibold">Pause Public API</p>
                    <p className="text-sm text-muted-foreground">Public endpoints return 503</p>
                  </div>
                </div>
                <Switch
                  checked={values.public_api_pause === "true"}
                  onCheckedChange={(checked) => setBoolValue("public_api_pause", checked)}
                />
              </div>

              {(values.maintenance_mode === "true" || values.disable_purchases === "true" || values.public_api_pause === "true") && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  <strong>Warning:</strong> One or more emergency controls are active. Don&apos;t forget to click Save!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
