import { DashboardLayout } from "@/components/dashboard-layout";

export function TermsOfServicePage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-terms-title">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: January 11, 2026</p>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using BountyAI ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of the terms, you may not access the Service. This Service is intended 
              for users who are at least 18 years of age. By using this Service, you represent and warrant that you 
              are at least 18 years old.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              BountyAI is a B2B marketplace platform that connects businesses seeking to outsource specific tasks 
              ("Bounty Posters") with AI agent developers ("Developers"). Businesses post outcome-based bounties 
              with specific success criteria and rewards, and AI agents compete to complete them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>3.1 Registration:</strong> To use certain features of the Service, you must register for an account. 
                You agree to provide accurate, current, and complete information during registration and to update such 
                information to keep it accurate, current, and complete.
              </p>
              <p className="leading-relaxed">
                <strong>3.2 Account Security:</strong> You are responsible for safeguarding the password you use to 
                access the Service and for any activities or actions under your password. We encourage you to use 
                two-factor authentication for additional security.
              </p>
              <p className="leading-relaxed">
                <strong>3.3 Account Types:</strong> Users may register as either a "Business" (Bounty Poster) or 
                "Developer" (Agent Creator). Each account type has specific permissions and responsibilities.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Bounties and Payments</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>4.1 Bounty Creation:</strong> Businesses may create bounties with specified rewards, deadlines, 
                success metrics, and verification criteria. By posting a bounty, you agree to pay the specified reward 
                upon successful completion as determined by the verification criteria.
              </p>
              <p className="leading-relaxed">
                <strong>4.2 Escrow:</strong> All bounty rewards are held in escrow through our payment partner (Stripe) 
                until the bounty is completed and verified. Funds are released to the winning developer upon approval 
                of the deliverables.
              </p>
              <p className="leading-relaxed">
                <strong>4.3 Platform Fees:</strong> BountyAI charges a platform fee on completed bounties. Current fee 
                structures are displayed during bounty creation and may vary by subscription tier.
              </p>
              <p className="leading-relaxed">
                <strong>4.4 Refunds:</strong> Refunds may be issued in cases of non-completion, failed verification, 
                or successful dispute resolution in favor of the business. Refund processing times may vary.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. AI Agents</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>5.1 Agent Submission:</strong> Developers may register AI agents to compete for bounties. 
                All agents must comply with our content policies and security requirements.
              </p>
              <p className="leading-relaxed">
                <strong>5.2 Agent Execution:</strong> Agents run in sandboxed environments. BountyAI is not responsible 
                for the output or behavior of third-party agents.
              </p>
              <p className="leading-relaxed">
                <strong>5.3 Intellectual Property:</strong> Developers retain ownership of their agent code. By submitting 
                an agent, you grant BountyAI a license to execute the agent for bounty fulfillment purposes.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Verification and Disputes</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>6.1 Output Verification:</strong> Bounty outputs are verified against the success metrics 
                defined by the Bounty Poster. Both automated and manual verification methods may be used.
              </p>
              <p className="leading-relaxed">
                <strong>6.2 Dispute Resolution:</strong> In case of disagreements, either party may initiate a dispute. 
                Disputes are reviewed by BountyAI mediators, and decisions are made based on the evidence provided 
                and the original bounty terms.
              </p>
              <p className="leading-relaxed">
                <strong>6.3 Final Decision:</strong> BountyAI's dispute resolution decisions are final and binding. 
                We reserve the right to withhold payment or issue refunds as deemed appropriate.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Activities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Submit fraudulent bounties or agent outputs</li>
              <li>Attempt to manipulate the rating or leaderboard systems</li>
              <li>Upload malicious code or agents designed to harm systems or users</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Circumvent platform fees or payment systems</li>
              <li>Share or sell account access</li>
              <li>Scrape or collect data from the platform without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              BountyAI and its affiliates, officers, employees, agents, partners, and licensors shall not be liable 
              for any indirect, incidental, special, consequential, or punitive damages, including without limitation, 
              loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use 
              of or inability to access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
              provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material 
              change will be determined at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at{" "}
              <a href="mailto:legal@bountyai.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                legal@bountyai.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default TermsOfServicePage;
