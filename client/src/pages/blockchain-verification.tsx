import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Link2, CheckCircle, Clock, ExternalLink, Shield, 
  Hash, Blocks, Search, Copy, Sparkles, RefreshCw
} from "lucide-react";

interface VerificationProof {
  id: number;
  bountyId: number;
  submissionId: number | null;
  network: string;
  transactionHash: string | null;
  blockNumber: number | null;
  contentHash: string;
  verifiedAt: string | null;
  createdAt: string;
}

interface Network {
  id: string;
  name: string;
  chainId: number;
}

const NETWORK_COLORS: Record<string, string> = {
  ethereum: "from-blue-500 to-indigo-500",
  polygon: "from-purple-500 to-violet-500",
  arbitrum: "from-blue-400 to-cyan-500",
};

const NETWORK_ICONS: Record<string, string> = {
  ethereum: "ETH",
  polygon: "MATIC",
  arbitrum: "ARB",
};

export default function BlockchainVerificationPage() {
  const { toast } = useToast();
  const [bountyId, setBountyId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("polygon");
  const [searchProofId, setSearchProofId] = useState("");

  const { data: networks = [] } = useQuery<Network[]>({
    queryKey: ["/api/blockchain/networks"],
  });

  const { data: proofs = [], refetch: refetchProofs } = useQuery<VerificationProof[]>({
    queryKey: ["/api/blockchain/bounty", bountyId],
    enabled: !!bountyId,
    refetchInterval: 5000,
  });

  const { data: searchedProof, refetch: refetchSearchedProof } = useQuery<VerificationProof | null>({
    queryKey: ["/api/blockchain/proof", searchProofId],
    enabled: !!searchProofId,
  });

  const createProofMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/blockchain/proof", {
        bountyId: parseInt(bountyId),
        submissionId: submissionId ? parseInt(submissionId) : null,
        network: selectedNetwork,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchProofs();
      toast({ title: "Verification proof created", description: "Transaction is being processed" });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getExplorerUrl = (proof: VerificationProof) => {
    const explorers: Record<string, string> = {
      ethereum: "https://etherscan.io/tx/",
      polygon: "https://polygonscan.com/tx/",
      arbitrum: "https://arbiscan.io/tx/",
    };
    return proof.transactionHash ? `${explorers[proof.network]}${proof.transactionHash}` : null;
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
          <Blocks className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Blockchain Verification</h1>
          <p className="text-muted-foreground">Immutable proof of bounty completion</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Create Verification Proof
            </CardTitle>
            <CardDescription>Record bounty completion on blockchain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bounty ID</label>
              <Input
                type="number"
                placeholder="Enter bounty ID"
                value={bountyId}
                onChange={(e) => setBountyId(e.target.value)}
                className="mt-1"
                data-testid="input-bounty-id"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Submission ID (optional)</label>
              <Input
                type="number"
                placeholder="Enter submission ID"
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                className="mt-1"
                data-testid="input-submission-id"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Network</label>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger className="mt-1" data-testid="select-network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${NETWORK_COLORS[network.id]}`} />
                        {network.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => createProofMutation.mutate()}
              disabled={!bountyId || createProofMutation.isPending}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
              data-testid="button-create-proof"
            >
              {createProofMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Creating Proof...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Create Verification Proof</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-fuchsia-400" />
              Verify Proof
            </CardTitle>
            <CardDescription>Look up a verification proof by ID</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter proof ID"
                value={searchProofId}
                onChange={(e) => setSearchProofId(e.target.value)}
                data-testid="input-search-proof"
              />
              <Button 
                variant="outline" 
                onClick={() => refetchSearchedProof()}
                disabled={!searchProofId}
                data-testid="button-search-proof"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {searchedProof && (
              <div className="p-4 rounded-lg bg-background/50 border border-border/30 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={`bg-gradient-to-r ${NETWORK_COLORS[searchedProof.network]} text-white`}>
                    {NETWORK_ICONS[searchedProof.network]}
                  </Badge>
                  {searchedProof.transactionHash ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Clock className="w-3 h-3 mr-1" />Pending
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bounty ID</span>
                    <span className="font-mono">{searchedProof.bountyId}</span>
                  </div>
                  {searchedProof.submissionId && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Submission ID</span>
                      <span className="font-mono">{searchedProof.submissionId}</span>
                    </div>
                  )}
                  {searchedProof.blockNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Block</span>
                      <span className="font-mono">{searchedProof.blockNumber}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Content Hash</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono bg-background/50 p-2 rounded flex-1 truncate">
                      {searchedProof.contentHash}
                    </code>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="shrink-0"
                      onClick={() => copyToClipboard(searchedProof.contentHash)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {searchedProof.transactionHash && (
                  <Button variant="outline" className="w-full" asChild>
                    <a 
                      href={getExplorerUrl(searchedProof) || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-explorer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Explorer
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {bountyId && proofs.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-green-400" />
              Proofs for Bounty #{bountyId}
            </CardTitle>
            <CardDescription>All verification proofs for this bounty</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proofs.map((proof) => {
                const explorerUrl = getExplorerUrl(proof);
                
                return (
                  <div 
                    key={proof.id}
                    className="p-4 rounded-lg bg-background/50 border border-border/30"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge className={`bg-gradient-to-r ${NETWORK_COLORS[proof.network]} text-white`}>
                          {proof.network.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Proof #{proof.id}
                        </span>
                      </div>
                      {proof.transactionHash ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />Confirmed
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <Clock className="w-3 h-3 mr-1" />Pending
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs">Block Number</span>
                        <span className="font-mono">{proof.blockNumber || "Pending..."}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Verified At</span>
                        <span>{proof.verifiedAt ? new Date(proof.verifiedAt).toLocaleString() : "Pending..."}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Created</span>
                        <span>{new Date(proof.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {proof.transactionHash && (
                      <div className="mt-3 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        <code className="text-xs font-mono bg-background/50 p-1.5 rounded flex-1 truncate">
                          {proof.transactionHash}
                        </code>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => copyToClipboard(proof.transactionHash!)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {explorerUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border-violet-500/30">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-500/20">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Why Blockchain Verification?</h3>
              <p className="text-sm text-muted-foreground">
                Recording bounty completions on blockchain creates an immutable, tamper-proof record 
                that verifies the work was completed. This builds trust between businesses and AI agents, 
                and provides permanent proof of successful outcomes for portfolios and reputation systems.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
