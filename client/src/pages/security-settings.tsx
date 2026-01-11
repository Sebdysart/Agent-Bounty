import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, Lock, Bell, Smartphone, Key, History, 
  CheckCircle, AlertTriangle, Upload, LogIn, Settings, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SecuritySettings as SecuritySettingsType, SecurityAuditLog } from "@shared/schema";

const eventTypeIcons: Record<string, React.ElementType> = {
  login: LogIn,
  upload: Upload,
  publish: Eye,
  settings_changed: Settings,
  api_key_created: Key,
  "2fa_enabled": Shield,
  "2fa_disabled": AlertTriangle,
};

const eventTypeColors: Record<string, string> = {
  login: "text-blue-500",
  upload: "text-purple-500",
  publish: "text-green-500",
  settings_changed: "text-amber-500",
  api_key_created: "text-cyan-500",
  "2fa_enabled": "text-emerald-500",
  "2fa_disabled": "text-red-500",
};

export default function SecuritySettingsPage() {
  const { toast } = useToast();

  const { data: settings } = useQuery<SecuritySettingsType>({
    queryKey: ["/api/security/settings"],
  });

  const { data: auditLog = [] } = useQuery<SecurityAuditLog[]>({
    queryKey: ["/api/security/audit-log"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SecuritySettingsType>) => {
      const res = await fetch("/api/security/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/settings"] });
      toast({ title: "Settings updated", description: "Your security settings have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    },
  });

  const defaultSettings: SecuritySettingsType = settings || {
    id: 0,
    userId: "",
    twoFactorEnabled: false,
    twoFactorSecret: null,
    backupCodes: [],
    trustedDevices: [],
    lastPasswordChange: null,
    loginNotifications: true,
    uploadRequires2fa: false,
    publishRequires2fa: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const handleSettingChange = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="security-settings-page">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Security Settings</h1>
            <p className="text-muted-foreground">Manage your account security and privacy</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable 2FA</Label>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app for additional security
                    </p>
                  </div>
                  <Switch 
                    checked={defaultSettings.twoFactorEnabled ?? false}
                    onCheckedChange={(v) => handleSettingChange("twoFactorEnabled", v)}
                    data-testid="switch-2fa"
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require 2FA for uploads</Label>
                    <p className="text-sm text-muted-foreground">
                      Verify identity when uploading new agents
                    </p>
                  </div>
                  <Switch 
                    checked={defaultSettings.uploadRequires2fa ?? false}
                    onCheckedChange={(v) => handleSettingChange("uploadRequires2fa", v)}
                    disabled={!defaultSettings.twoFactorEnabled}
                    data-testid="switch-2fa-upload"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require 2FA for publishing</Label>
                    <p className="text-sm text-muted-foreground">
                      Verify identity when publishing agents to marketplace
                    </p>
                  </div>
                  <Switch 
                    checked={defaultSettings.publishRequires2fa ?? false}
                    onCheckedChange={(v) => handleSettingChange("publishRequires2fa", v)}
                    disabled={!defaultSettings.twoFactorEnabled}
                    data-testid="switch-2fa-publish"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Control security-related notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Login notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your account is accessed from a new device
                    </p>
                  </div>
                  <Switch 
                    checked={defaultSettings.loginNotifications ?? true}
                    onCheckedChange={(v) => handleSettingChange("loginNotifications", v)}
                    data-testid="switch-login-notifications"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Trusted Devices
                </CardTitle>
                <CardDescription>
                  Devices that have been verified for your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {defaultSettings.trustedDevices && defaultSettings.trustedDevices.length > 0 ? (
                  <div className="space-y-2">
                    {defaultSettings.trustedDevices.map((device, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{device}</span>
                        </div>
                        <Button variant="ghost" size="sm">Remove</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No trusted devices yet. Complete 2FA verification to add devices.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-muted"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={`${(defaultSettings.twoFactorEnabled ? 70 : 40) * 3.52} 352`}
                        className="text-primary"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">
                        {defaultSettings.twoFactorEnabled ? 70 : 40}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {defaultSettings.twoFactorEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span>Two-factor authentication</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {defaultSettings.loginNotifications ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span>Login notifications</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {auditLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No recent activity
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {auditLog.slice(0, 10).map((log) => {
                        const Icon = eventTypeIcons[log.eventType] || Settings;
                        const color = eventTypeColors[log.eventType] || "text-muted-foreground";
                        
                        return (
                          <div key={log.id} className="flex items-start gap-3">
                            <div className={`shrink-0 ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize">
                                {log.eventType.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(log.createdAt)}
                              </p>
                            </div>
                            <Badge variant={log.success ? "secondary" : "destructive"} className="text-xs">
                              {log.success ? "Success" : "Failed"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
