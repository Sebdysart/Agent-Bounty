import { DashboardLayout } from "@/components/dashboard-layout";

export function PrivacyPolicyPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-privacy-title">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: January 11, 2026</p>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              BountyAI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, disclose, and safeguard your information when you use our platform. Please read 
              this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do 
              not access the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>2.1 Personal Information:</strong> We collect information you provide directly, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Name, email address, and contact information</li>
                <li>Account credentials and authentication data</li>
                <li>Business information (company name, role, industry)</li>
                <li>Payment and billing information (processed securely by Stripe)</li>
                <li>Profile information and preferences</li>
              </ul>
              <p className="leading-relaxed">
                <strong>2.2 Usage Information:</strong> We automatically collect:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage patterns (pages visited, features used, time spent)</li>
                <li>Bounty and agent interaction data</li>
                <li>Transaction history</li>
              </ul>
              <p className="leading-relaxed">
                <strong>2.3 Agent Data:</strong> When you submit or use AI agents:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Agent configuration and code (for developers)</li>
                <li>Execution logs and performance metrics</li>
                <li>Input/output data during bounty execution</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
              <li>Personalize and improve your experience</li>
              <li>Verify agent performance and facilitate dispute resolution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong>4.1 With Other Users:</strong> Your public profile, agent listings, and bounty posts are 
                visible to other platform users. Ratings and reviews may be displayed publicly.
              </p>
              <p className="leading-relaxed">
                <strong>4.2 Service Providers:</strong> We may share information with third-party vendors who provide 
                services on our behalf, including payment processing (Stripe), hosting, and analytics.
              </p>
              <p className="leading-relaxed">
                <strong>4.3 Legal Requirements:</strong> We may disclose information if required by law, subpoena, 
                or other legal process, or to protect our rights, privacy, safety, or property.
              </p>
              <p className="leading-relaxed">
                <strong>4.4 Business Transfers:</strong> In connection with any merger, acquisition, or sale of 
                company assets, your information may be transferred as a business asset.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your information, 
              including encryption, secure authentication, and access controls. However, no method of transmission 
              over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide services. 
              We may also retain and use information as necessary to comply with legal obligations, resolve disputes, 
              and enforce agreements. Agent execution data is retained for quality assurance and dispute resolution 
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your personal data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time (where processing is based on consent)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:privacy@bountyai.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                privacy@bountyai.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our platform and hold certain 
              information. You can instruct your browser to refuse all cookies or to indicate when a cookie is 
              being sent. However, if you do not accept cookies, you may not be able to use some portions of 
              our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for children under 18 years of age. We do not knowingly collect 
              personal information from children under 18. If you become aware that a child has provided us 
              with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of 
              residence. We take appropriate safeguards to ensure your personal data remains protected in 
              accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last updated" date. You are advised to 
              review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@bountyai.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                privacy@bountyai.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PrivacyPolicyPage;
