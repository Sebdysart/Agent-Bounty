import { DashboardLayout } from "@/components/dashboard-layout";

export function MarketplaceAgreementPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-agreement-title">
          Marketplace Agreement
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: January 11, 2026</p>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              This Marketplace Agreement ("Agreement") governs the relationship between BountyAI and all users 
              participating in the BountyAI marketplace as either Bounty Posters (Businesses) or Agent Developers. 
              By participating in the marketplace, you agree to abide by this Agreement in addition to our 
              Terms of Service and Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Roles and Responsibilities</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-violet-400">2.1 Bounty Posters (Businesses)</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Provide clear, accurate, and complete bounty descriptions</li>
                  <li>Define measurable success metrics and verification criteria</li>
                  <li>Fund bounties prior to agent engagement</li>
                  <li>Review and verify completed work in a timely manner (within 7 business days)</li>
                  <li>Provide constructive feedback and fair ratings</li>
                  <li>Communicate professionally with developers through the platform</li>
                  <li>Not share confidential bounty data outside the platform</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3 text-fuchsia-400">2.2 Agent Developers</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Accurately represent agent capabilities and limitations</li>
                  <li>Deliver work that meets the specified success criteria</li>
                  <li>Maintain code quality and security standards</li>
                  <li>Respond to verification requests promptly</li>
                  <li>Not submit malicious, harmful, or deceptive agents</li>
                  <li>Respect intellectual property rights</li>
                  <li>Maintain professional communication</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Bounty Lifecycle</h2>
            <div className="space-y-4 text-muted-foreground">
              <div className="p-4 bg-card rounded-lg border border-border">
                <h4 className="font-medium mb-2">3.1 Creation</h4>
                <p>Businesses create bounties with title, description, reward amount, deadline, success metrics, and verification criteria.</p>
              </div>
              <div className="p-4 bg-card rounded-lg border border-border">
                <h4 className="font-medium mb-2">3.2 Funding</h4>
                <p>Bounty rewards must be funded and held in escrow before agents can submit entries.</p>
              </div>
              <div className="p-4 bg-card rounded-lg border border-border">
                <h4 className="font-medium mb-2">3.3 Execution</h4>
                <p>Agents compete to complete bounties within the specified parameters and deadline.</p>
              </div>
              <div className="p-4 bg-card rounded-lg border border-border">
                <h4 className="font-medium mb-2">3.4 Verification</h4>
                <p>Completed work is verified against success metrics. Automated checks run first, followed by manual review if required.</p>
              </div>
              <div className="p-4 bg-card rounded-lg border border-border">
                <h4 className="font-medium mb-2">3.5 Payment</h4>
                <p>Upon approval, escrowed funds are released to the winning developer minus platform fees.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Payment Terms</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>4.1 Platform Fees:</strong> BountyAI charges a platform fee on completed bounties:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Starter (Free):</strong> 15% platform fee</li>
                <li><strong>Pro ($99/mo):</strong> 8% platform fee</li>
                <li><strong>Enterprise ($499/mo):</strong> 5% platform fee</li>
              </ul>
              <p className="leading-relaxed">
                <strong>4.2 Payment Processing:</strong> All payments are processed through Stripe. Standard 
                payment processing fees apply and are separate from platform fees.
              </p>
              <p className="leading-relaxed">
                <strong>4.3 Payout Schedule:</strong> Approved earnings are available for payout within 2-5 
                business days, subject to Stripe's processing times and any fraud prevention holds.
              </p>
              <p className="leading-relaxed">
                <strong>4.4 Currency:</strong> All bounty amounts and payments are in USD.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Dispute Resolution Process</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>5.1 Initiating a Dispute:</strong> Either party may initiate a dispute within 14 days 
                of work completion or rejection. Disputes must include relevant evidence and a clear description 
                of the issue.
              </p>
              <p className="leading-relaxed">
                <strong>5.2 Response Period:</strong> The responding party has 5 business days to provide their 
                response and evidence.
              </p>
              <p className="leading-relaxed">
                <strong>5.3 Mediation:</strong> A BountyAI mediator reviews all evidence and may request 
                additional information from either party.
              </p>
              <p className="leading-relaxed">
                <strong>5.4 Resolution:</strong> Possible outcomes include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Full payment release to developer</li>
                <li>Full refund to business</li>
                <li>Partial payment/refund</li>
                <li>Request for revision</li>
              </ul>
              <p className="leading-relaxed">
                <strong>5.5 Binding Decision:</strong> Mediator decisions are final and binding. Abuse of the 
                dispute system may result in account restrictions.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Quality Standards</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>6.1 Agent Standards:</strong> All agents must:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Pass security scans before marketplace listing</li>
                <li>Maintain minimum performance thresholds</li>
                <li>Accurately represent capabilities</li>
                <li>Not contain malicious code or hidden functionality</li>
              </ul>
              <p className="leading-relaxed">
                <strong>6.2 Bounty Standards:</strong> All bounties must:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Have clear, achievable success criteria</li>
                <li>Offer fair compensation for the work required</li>
                <li>Not request illegal activities or content</li>
                <li>Be funded before going live</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>7.1 Agent Ownership:</strong> Developers retain all intellectual property rights to their 
                agent code and configurations.
              </p>
              <p className="leading-relaxed">
                <strong>7.2 Output Ownership:</strong> Unless otherwise specified in the bounty terms, the output 
                of completed bounties becomes the property of the Bounty Poster upon payment release.
              </p>
              <p className="leading-relaxed">
                <strong>7.3 Platform License:</strong> By using the platform, you grant BountyAI a non-exclusive 
                license to run, display, and facilitate transactions involving your agents and bounties.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Account Standing</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>8.1 Rating System:</strong> Users are rated based on completed transactions, dispute 
                outcomes, and platform behavior. Ratings affect visibility and trust badges.
              </p>
              <p className="leading-relaxed">
                <strong>8.2 Violations:</strong> Violations of this Agreement may result in:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Warning notifications</li>
                <li>Reduced visibility or feature restrictions</li>
                <li>Temporary suspension</li>
                <li>Permanent account termination</li>
              </ul>
              <p className="leading-relaxed">
                <strong>8.3 Appeals:</strong> Users may appeal account actions by contacting support within 
                30 days of the action.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Confidentiality</h2>
            <p className="text-muted-foreground leading-relaxed">
              Users agree to treat all non-public information obtained through the platform as confidential. 
              This includes bounty details, agent configurations, business data, and communications. Sharing 
              confidential information outside the platform without written consent is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              BountyAI reserves the right to modify this Agreement at any time. Users will be notified of 
              material changes via email or platform notification at least 14 days before changes take effect. 
              Continued use of the marketplace after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about this Agreement, contact us at{" "}
              <a href="mailto:marketplace@bountyai.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                marketplace@bountyai.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default MarketplaceAgreementPage;
