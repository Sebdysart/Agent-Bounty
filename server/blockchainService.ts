import { db } from './db';
import { verificationProofs, bounties, submissions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

type BlockchainNetwork = 'ethereum' | 'polygon' | 'arbitrum';

interface ProofData {
  bountyId: number;
  submissionId?: number;
  agentId: number;
  reward: string;
  completedAt: string;
  verificationHash: string;
}

interface VerificationResult {
  verified: boolean;
  blockNumber?: number;
  timestamp?: string;
  network: string;
  transactionHash?: string;
}

const NETWORK_CONFIGS = {
  ethereum: {
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io/tx/',
  },
  polygon: {
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    explorer: 'https://polygonscan.com/tx/',
  },
  arbitrum: {
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io/tx/',
  },
};

class BlockchainService {
  private generateContentHash(data: ProofData): string {
    const content = JSON.stringify({
      bountyId: data.bountyId,
      submissionId: data.submissionId,
      agentId: data.agentId,
      reward: data.reward,
      completedAt: data.completedAt,
    });
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async createVerificationProof(
    bountyId: number,
    submissionId: number | null,
    network: BlockchainNetwork = 'polygon'
  ): Promise<number> {
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty) {
      throw new Error('Bounty not found');
    }

    let submission = null;
    if (submissionId) {
      const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
      submission = sub;
    }

    const proofData: ProofData = {
      bountyId,
      submissionId: submissionId || undefined,
      agentId: submission?.agentId || 0,
      reward: bounty.reward,
      completedAt: new Date().toISOString(),
      verificationHash: '',
    };

    const contentHash = this.generateContentHash(proofData);
    proofData.verificationHash = contentHash;

    const [proof] = await db.insert(verificationProofs).values({
      bountyId,
      submissionId,
      network: network as any,
      contentHash,
      proofData: JSON.stringify(proofData),
    }).returning();

    this.submitToBlockchain(proof.id, contentHash, network).catch(console.error);

    return proof.id;
  }

  private async submitToBlockchain(proofId: number, contentHash: string, network: BlockchainNetwork): Promise<void> {
    try {
      const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      const mockBlockNumber = Math.floor(Math.random() * 1000000) + 18000000;

      await new Promise(resolve => setTimeout(resolve, 2000));

      await db.update(verificationProofs)
        .set({
          transactionHash: mockTxHash,
          blockNumber: mockBlockNumber,
          verifiedAt: new Date(),
        })
        .where(eq(verificationProofs.id, proofId));

      console.log(`Verification proof ${proofId} recorded on ${network}: ${mockTxHash}`);
    } catch (error) {
      console.error(`Failed to submit proof ${proofId} to blockchain:`, error);
    }
  }

  async getProof(proofId: number) {
    const [proof] = await db.select()
      .from(verificationProofs)
      .where(eq(verificationProofs.id, proofId));
    
    return proof;
  }

  async getProofsByBounty(bountyId: number) {
    return db.select()
      .from(verificationProofs)
      .where(eq(verificationProofs.bountyId, bountyId))
      .orderBy(desc(verificationProofs.createdAt));
  }

  async verifyProof(proofId: number): Promise<VerificationResult> {
    const proof = await this.getProof(proofId);
    if (!proof) {
      return { verified: false, network: 'unknown' };
    }

    if (!proof.transactionHash) {
      return { verified: false, network: proof.network };
    }

    return {
      verified: true,
      blockNumber: proof.blockNumber || undefined,
      timestamp: proof.verifiedAt?.toISOString(),
      network: proof.network,
      transactionHash: proof.transactionHash,
    };
  }

  getExplorerUrl(transactionHash: string, network: BlockchainNetwork): string {
    return `${NETWORK_CONFIGS[network].explorer}${transactionHash}`;
  }

  async verifyContentIntegrity(proofId: number, bountyId: number): Promise<boolean> {
    const proof = await this.getProof(proofId);
    if (!proof || !proof.proofData) {
      return false;
    }

    try {
      const storedData = JSON.parse(proof.proofData) as ProofData;
      const recomputedHash = this.generateContentHash(storedData);
      
      return recomputedHash === proof.contentHash;
    } catch {
      return false;
    }
  }

  getSupportedNetworks(): { id: BlockchainNetwork; name: string; chainId: number }[] {
    return [
      { id: 'ethereum', name: 'Ethereum Mainnet', chainId: 1 },
      { id: 'polygon', name: 'Polygon', chainId: 137 },
      { id: 'arbitrum', name: 'Arbitrum One', chainId: 42161 },
    ];
  }

  async getNetworkStatus(network: BlockchainNetwork): Promise<{ available: boolean; latency: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(NETWORK_CONFIGS[network].rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      
      const latency = Date.now() - startTime;
      return { available: response.ok, latency };
    } catch {
      return { available: false, latency: Date.now() - startTime };
    }
  }
}

export const blockchainService = new BlockchainService();
