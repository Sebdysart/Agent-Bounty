import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, Key, Lock, RefreshCw, AlertTriangle, 
  Check, X, Eye, EyeOff, Fingerprint, Cpu
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function QuantumSecurity() {
  const { toast } = useToast();
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("kyber768");
  const [keyType, setKeyType] = useState("encryption");

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/quantum/dashboard"],
  });

  const { data: keys = [] } = useQuery<any[]>({
    queryKey: ["/api/quantum/keys"],
  });

  const { data: encrypted = [] } = useQuery<any[]>({
    queryKey: ["/api/quantum/encrypted"],
  });

  const { data: algorithms = {} } = useQuery<Record<string, any>>({
    queryKey: ["/api/quantum/algorithms"],
  });

  const { data: rotationHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/quantum/rotation-history"],
  });

  const generateKeyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/quantum/keys", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/dashboard"] });
      toast({ title: "Key generated", description: "New quantum-safe key has been created" });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: (keyId: number) => apiRequest("POST", `/api/quantum/keys/${keyId}/rotate`, { reason: "manual" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/rotation-history"] });
      toast({ title: "Key rotated", description: "Key has been successfully rotated" });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: number) => apiRequest("POST", `/api/quantum/keys/${keyId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/keys"] });
      toast({ title: "Key revoked", description: "Key has been revoked" });
    },
  });

  const activeKeys = keys.filter((k: any) => k.status === "active");
  const deprecatedKeys = keys.filter((k: any) => k.status === "deprecated" || k.status === "revoked");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
          Quantum-Safe Encryption
        </h1>
        <p className="text-muted-foreground mt-2">
          Post-quantum cryptography for future-proof security
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Keys</p>
                <p className="text-2xl font-bold">{dashboard?.activeKeys || 0}</p>
              </div>
              <Key className="h-8 w-8 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Encrypted Items</p>
                <p className="text-2xl font-bold">{dashboard?.encryptedItems || 0}</p>
              </div>
              <Lock className="h-8 w-8 text-fuchsia-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rotations (Month)</p>
                <p className="text-2xl font-bold">{dashboard?.rotationsThisMonth || 0}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Level</p>
                <p className="text-2xl font-bold">NIST L3</p>
              </div>
              <Shield className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {dashboard?.recommendations && dashboard.recommendations.length > 0 && (
        <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-400">Security Recommendations</h3>
                <ul className="mt-2 space-y-1">
                  {dashboard.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="keys" data-testid="tab-keys">Keys</TabsTrigger>
          <TabsTrigger value="encrypted" data-testid="tab-encrypted">Encrypted Data</TabsTrigger>
          <TabsTrigger value="algorithms" data-testid="tab-algorithms">Algorithms</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generate New Key</CardTitle>
              <CardDescription>Create a new quantum-safe encryption key</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Select value={keyType} onValueChange={setKeyType}>
                  <SelectTrigger className="w-40" data-testid="select-key-type">
                    <SelectValue placeholder="Key Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="encryption">Encryption</SelectItem>
                    <SelectItem value="signing">Signing</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
                  <SelectTrigger className="w-40" data-testid="select-algorithm">
                    <SelectValue placeholder="Algorithm" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(algorithms).map((algo) => (
                      <SelectItem key={algo} value={algo}>
                        {algo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => generateKeyMutation.mutate({ keyType, algorithm: selectedAlgorithm })}
                  disabled={generateKeyMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                  data-testid="button-generate-key"
                >
                  <Key className="h-4 w-4 mr-2" />
                  {generateKeyMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Active Keys</h3>
            {activeKeys.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Key className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active keys</h3>
                  <p className="text-muted-foreground text-center">
                    Generate your first quantum-safe key to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeKeys.map((key: any) => (
                  <Card key={key.id} className="hover-elevate" data-testid={`card-key-${key.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-5 w-5 text-violet-400" />
                          <CardTitle className="text-base font-mono text-sm">
                            {key.keyFingerprint?.substring(0, 16)}...
                          </CardTitle>
                        </div>
                        <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span>{key.keyType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Algorithm:</span>
                          <Badge variant="outline">{key.algorithm}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                        </div>
                        {key.expiresAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Expires:</span>
                            <span>{new Date(key.expiresAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rotateKeyMutation.mutate(key.id)}
                          disabled={rotateKeyMutation.isPending}
                          data-testid={`button-rotate-${key.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                          disabled={revokeKeyMutation.isPending}
                          data-testid={`button-revoke-${key.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {deprecatedKeys.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-muted-foreground">Deprecated Keys</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deprecatedKeys.map((key: any) => (
                  <Card key={key.id} className="opacity-60" data-testid={`card-deprecated-${key.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-mono text-sm">
                          {key.keyFingerprint?.substring(0, 16)}...
                        </CardTitle>
                        <Badge variant="secondary">{key.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {key.algorithm} - {key.keyType}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="encrypted" className="space-y-6">
          {encrypted.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No encrypted data</h3>
                <p className="text-muted-foreground text-center">
                  Your encrypted secrets and credentials will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {encrypted.map((item: any) => (
                <Card key={item.id} data-testid={`card-encrypted-${item.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-violet-400" />
                        <div>
                          <p className="font-medium">{item.dataType}</p>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.algorithm}</Badge>
                        <Button size="icon" variant="ghost" data-testid={`button-view-${item.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="algorithms" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(algorithms).map(([name, info]: [string, any]) => (
              <Card key={name} className="hover-elevate" data-testid={`card-algo-${name}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{name}</CardTitle>
                    <Badge className="bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-violet-400">
                      Level {info.securityLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Key Size:</span>
                      <span>{info.keySize} bytes</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2">
                      {info.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                NIST Security Levels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-4">
                  <Badge className="w-16 justify-center">Level 1</Badge>
                  <span>At least as hard to break as AES-128</span>
                </div>
                <div className="flex gap-4">
                  <Badge className="w-16 justify-center">Level 2</Badge>
                  <span>At least as hard to break as SHA-256/AES-192</span>
                </div>
                <div className="flex gap-4">
                  <Badge className="w-16 justify-center">Level 3</Badge>
                  <span>At least as hard to break as AES-192</span>
                </div>
                <div className="flex gap-4">
                  <Badge className="w-16 justify-center">Level 5</Badge>
                  <span>At least as hard to break as AES-256</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
