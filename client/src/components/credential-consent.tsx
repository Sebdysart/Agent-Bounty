import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Key, 
  Lock, 
  AlertTriangle, 
  Check, 
  Eye, 
  EyeOff,
  Loader2,
  Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";

interface CredentialRequirement {
  id: number;
  bountyId: number;
  credentialType: string;
  serviceName: string;
  description: string;
  isRequired: boolean;
}

interface Props {
  bountyId: number;
  agentId?: number;
  onConsentComplete: () => void;
  onCancel: () => void;
}

const credentialIcons: Record<string, typeof Key> = {
  login: Lock,
  api_key: Key,
  oauth: Shield,
  database: Key,
  ssh: Key,
  other: Key,
};

export function CredentialConsentForm({ bountyId, agentId, onConsentComplete, onCancel }: Props) {
  const [credentials, setCredentials] = useState<Record<number, Record<string, string>>>({});
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [consented, setConsented] = useState<Record<number, boolean>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const { data, isLoading } = useQuery<{ requirements: CredentialRequirement[] }>({
    queryKey: ["/api/bounties", bountyId, "credentials"],
  });

  const consentMutation = useMutation({
    mutationFn: async (requirementId: number) => {
      const requirement = data?.requirements.find(r => r.id === requirementId);
      const consentText = `I consent to allow the selected agent to access my ${requirement?.serviceName} credentials for the purpose of completing bounty #${bountyId}. I understand that credentials are stored securely in my session only and are not persisted.`;
      
      // Include credentials with consent (stored in session only on server)
      const creds = credentials[requirementId] || {};
      
      return apiRequest("POST", `/api/credentials/${requirementId}/consent`, {
        agentId,
        consentText,
        credentials: creds,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    },
    onSuccess: (_, requirementId) => {
      setConsented({ ...consented, [requirementId]: true });
      // Clear local credential state after successful consent
      setCredentials(prev => {
        const updated = { ...prev };
        delete updated[requirementId];
        return updated;
      });
      
      const allRequired = data?.requirements
        .filter(r => r.isRequired)
        .every(r => consented[r.id] || r.id === requirementId);
      
      if (allRequired) {
        onConsentComplete();
      }
    },
  });

  const handleCredentialChange = (requirementId: number, field: string, value: string) => {
    setCredentials({
      ...credentials,
      [requirementId]: {
        ...credentials[requirementId],
        [field]: value,
      },
    });
  };

  const handleConsent = async (requirementId: number) => {
    await consentMutation.mutateAsync(requirementId);
  };

  const togglePassword = (requirementId: number) => {
    setShowPasswords({ ...showPasswords, [requirementId]: !showPasswords[requirementId] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading requirements...</p>
        </CardContent>
      </Card>
    );
  }

  const requirements = data?.requirements || [];

  if (requirements.length === 0) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" />
          Credential Access Required
        </CardTitle>
        <CardDescription>
          This bounty requires access to your accounts. Review each requirement carefully.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-6">
        <motion.div 
          className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Security Notice</p>
            <p className="text-muted-foreground">
              Your credentials are stored securely in your session only and are never persisted to our database.
              Access is logged for your protection and consent can be revoked at any time.
            </p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {requirements.map((requirement, index) => {
            const Icon = credentialIcons[requirement.credentialType] || Key;
            const isConsented = consented[requirement.id];
            
            return (
              <motion.div
                key={requirement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={isConsented ? "border-green-500/30" : ""}>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{requirement.serviceName}</h4>
                            <Badge variant="outline" className="capitalize">
                              {requirement.credentialType.replace("_", " ")}
                            </Badge>
                            {requirement.isRequired && (
                              <Badge variant="secondary">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {requirement.description}
                          </p>
                        </div>
                      </div>
                      {isConsented && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <Check className="w-3 h-3 mr-1" />
                          Consented
                        </Badge>
                      )}
                    </div>

                    {!isConsented && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          {requirement.credentialType === "login" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`username-${requirement.id}`}>Username/Email</Label>
                                <Input
                                  id={`username-${requirement.id}`}
                                  placeholder="Enter username or email"
                                  value={credentials[requirement.id]?.username || ""}
                                  onChange={(e) => handleCredentialChange(requirement.id, "username", e.target.value)}
                                  data-testid={`input-username-${requirement.id}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`password-${requirement.id}`}>Password</Label>
                                <div className="relative">
                                  <Input
                                    id={`password-${requirement.id}`}
                                    type={showPasswords[requirement.id] ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={credentials[requirement.id]?.password || ""}
                                    onChange={(e) => handleCredentialChange(requirement.id, "password", e.target.value)}
                                    data-testid={`input-password-${requirement.id}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full"
                                    onClick={() => togglePassword(requirement.id)}
                                  >
                                    {showPasswords[requirement.id] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {requirement.credentialType === "api_key" && (
                            <div className="space-y-2">
                              <Label htmlFor={`apikey-${requirement.id}`}>API Key</Label>
                              <div className="relative">
                                <Input
                                  id={`apikey-${requirement.id}`}
                                  type={showPasswords[requirement.id] ? "text" : "password"}
                                  placeholder="Enter API key"
                                  value={credentials[requirement.id]?.apiKey || ""}
                                  onChange={(e) => handleCredentialChange(requirement.id, "apiKey", e.target.value)}
                                  data-testid={`input-apikey-${requirement.id}`}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-full"
                                  onClick={() => togglePassword(requirement.id)}
                                >
                                  {showPasswords[requirement.id] ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={() => handleConsent(requirement.id)}
                            disabled={consentMutation.isPending}
                            className="w-full"
                            data-testid={`button-consent-${requirement.id}`}
                          >
                            {consentMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4 mr-2" />
                                Grant Access
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-start space-x-3">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            data-testid="checkbox-terms"
          />
          <div className="space-y-1">
            <Label htmlFor="terms" className="text-sm cursor-pointer">
              I understand and agree to the credential access terms
            </Label>
            <p className="text-xs text-muted-foreground">
              By granting access, you authorize the selected agent to use these credentials 
              solely for completing this bounty. Access expires after 24 hours or upon bounty completion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Info className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            All credential access is logged and auditable. You can revoke access at any time from your security settings.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-consent">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
