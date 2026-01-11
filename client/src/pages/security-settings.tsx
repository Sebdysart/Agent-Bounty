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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Shield, Lock, Bell, Smartphone, Key, History, 
  CheckCircle, AlertTriangle, Upload, LogIn, Settings, Eye, Loader2, Copy
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

interface TwoFactorSetupData {
  secret: string;
  backupCodes: string[];
  qrCodeUrl: string;
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [show2FASetupDialog, setShow2FASetupDialog] = useState(false);
  const [show2FADisableDialog, setShow2FADisableDialog] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { data: settings } = useQuery<SecuritySettingsType>({
    queryKey: ["/api/security/settings"],
  });

  const { data: auditLog = [] } = useQuery<SecurityAuditLog[]>({
    queryKey: ["/api/security/audit-log"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SecuritySettingsType>) => {
      const res = await apiRequest("POST", "/api/security/settings", newSettings);
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

  const setup2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/2fa/setup");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to setup 2FA");
      }
      return res.json() as Promise<TwoFactorSetupData>;
    },
    onSuccess: (data) => {
      if (data?.secret && data?.qrCodeUrl) {
        setSetupData(data);
        setShow2FASetupDialog(true);
      } else {
        toast({ title: "Error", description: "Invalid setup data received", variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to setup 2FA", 
        variant: "destructive" 
      });
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/security/2fa/enable", { token });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to enable 2FA");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/settings"] });
      setShowBackupCodes(true);
      toast({ title: "2FA Enabled", description: "Two-factor authentication is now active on your account." });
    },
    onError: (error) => {
      toast({ 
        title: "Verification Failed", 
        description: error instanceof Error ? error.message : "Invalid verification code", 
        variant: "destructive" 
      });
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/security/2fa/disable", { token });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to disable 2FA");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/settings"] });
      setShow2FADisableDialog(false);
      setVerificationCode("");
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed from your account." });
    },
    onError: (error) => {
      toast({ 
        title: "Verification Failed", 
        description: error instanceof Error ? error.message : "Invalid verification code", 
        variant: "destructive" 
      });
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

  const handle2FAToggle = () => {
    if (defaultSettings.twoFactorEnabled) {
      setShow2FADisableDialog(true);
    } else {
      setup2FAMutation.mutate();
    }
  };

  const handleEnableSubmit = () => {
    if (verificationCode.length === 6) {
      enable2FAMutation.mutate(verificationCode);
    }
  };

  const handleDisableSubmit = () => {
    if (verificationCode.length >= 6) {
      disable2FAMutation.mutate(verificationCode);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
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
                    <div className="flex items-center gap-2">
                      <Label>Enable 2FA</Label>
                      {defaultSettings.twoFactorEnabled && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app for additional security
                    </p>
                  </div>
                  <Button 
                    variant={defaultSettings.twoFactorEnabled ? "destructive" : "default"}
                    onClick={handle2FAToggle}
                    disabled={setup2FAMutation.isPending}
                    data-testid="button-toggle-2fa"
                  >
                    {setup2FAMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {defaultSettings.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                  </Button>
                </div>
                
                {defaultSettings.twoFactorEnabled && (
                  <>
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
                        data-testid="switch-2fa-publish"
                      />
                    </div>
                  </>
                )}
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-4 h-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {auditLog.length > 0 ? (
                      auditLog.map((log) => {
                        const Icon = eventTypeIcons[log.eventType] || Settings;
                        const colorClass = eventTypeColors[log.eventType] || "text-muted-foreground";
                        return (
                          <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <div className={`mt-0.5 ${colorClass}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize">
                                {log.eventType.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(log.createdAt)}
                              </p>
                              {log.ipAddress && (
                                <p className="text-xs text-muted-foreground">
                                  IP: {log.ipAddress}
                                </p>
                              )}
                            </div>
                            {log.success ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No activity recorded yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={show2FASetupDialog} onOpenChange={(open) => {
        if (!open) {
          setShow2FASetupDialog(false);
          setSetupData(null);
          setVerificationCode("");
          setShowBackupCodes(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showBackupCodes ? "Save Your Backup Codes" : "Set Up Two-Factor Authentication"}
            </DialogTitle>
            <DialogDescription>
              {showBackupCodes 
                ? "Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator."
                : "Scan this QR code with your authenticator app (like Google Authenticator or Authy), then enter the 6-digit code below."
              }
            </DialogDescription>
          </DialogHeader>
          
          {showBackupCodes ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {setupData?.backupCodes.map((code, i) => (
                  <div key={i} className="text-center py-1">{code}</div>
                ))}
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  if (setupData) {
                    copyToClipboard(setupData.backupCodes.join('\n'));
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Backup Codes
              </Button>
              <DialogFooter>
                <Button onClick={() => {
                  setShow2FASetupDialog(false);
                  setSetupData(null);
                  setVerificationCode("");
                  setShowBackupCodes(false);
                }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {setupData && (
                <>
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-lg">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`}
                        alt="2FA QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{setupData.secret}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(setupData.secret)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Enter 6-digit code from your authenticator</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      className="text-center text-2xl tracking-widest font-mono"
                      data-testid="input-2fa-code"
                    />
                  </div>
                </>
              )}
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShow2FASetupDialog(false);
                  setSetupData(null);
                  setVerificationCode("");
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEnableSubmit}
                  disabled={verificationCode.length !== 6 || enable2FAMutation.isPending}
                  data-testid="button-verify-2fa"
                >
                  {enable2FAMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify & Enable
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={show2FADisableDialog} onOpenChange={setShow2FADisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter a 6-digit code from your authenticator app or a backup code to disable 2FA.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification code</Label>
              <Input
                type="text"
                maxLength={8}
                placeholder="000000 or backup code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                className="text-center text-xl tracking-widest font-mono"
                data-testid="input-disable-2fa-code"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShow2FADisableDialog(false);
              setVerificationCode("");
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDisableSubmit}
              disabled={verificationCode.length < 6 || disable2FAMutation.isPending}
              data-testid="button-confirm-disable-2fa"
            >
              {disable2FAMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
