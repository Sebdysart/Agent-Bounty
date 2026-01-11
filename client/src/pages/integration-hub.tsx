import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Zap, MessageSquare, Database, BarChart3, DollarSign, 
  Code, Plug, ExternalLink, Star, CheckCircle, Crown
} from "lucide-react";
import { SiOpenai, SiSlack, SiZapier, SiStripe, SiTwilio, SiGithub, SiNotion, SiAirtable } from "react-icons/si";
import type { IntegrationConnector } from "@shared/schema";

const categoryIcons: Record<string, React.ElementType> = {
  ai_ml: Zap,
  communication: MessageSquare,
  data: Database,
  productivity: BarChart3,
  payment: DollarSign,
  developer: Code,
  marketing: Star,
};

const integrationLogos: Record<string, React.ElementType> = {
  openai: SiOpenai,
  slack: SiSlack,
  zapier: SiZapier,
  stripe: SiStripe,
  twilio: SiTwilio,
  github: SiGithub,
  notion: SiNotion,
  airtable: SiAirtable,
};

const defaultIntegrations = [
  { name: "OpenAI", slug: "openai", description: "GPT-4, DALL-E, and Whisper APIs for AI capabilities", category: "ai_ml", isPremium: false, usageCount: 1250 },
  { name: "Slack", slug: "slack", description: "Send messages and notifications to Slack channels", category: "communication", isPremium: false, usageCount: 890 },
  { name: "Zapier", slug: "zapier", description: "Connect to 5000+ apps with Zapier automation", category: "productivity", isPremium: true, usageCount: 654 },
  { name: "Stripe", slug: "stripe", description: "Process payments and manage subscriptions", category: "payment", isPremium: false, usageCount: 432 },
  { name: "Twilio", slug: "twilio", description: "SMS, voice calls, and WhatsApp messaging", category: "communication", isPremium: false, usageCount: 321 },
  { name: "GitHub", slug: "github", description: "Access repositories, issues, and pull requests", category: "developer", isPremium: false, usageCount: 567 },
  { name: "Notion", slug: "notion", description: "Read and write to Notion databases and pages", category: "productivity", isPremium: false, usageCount: 234 },
  { name: "Airtable", slug: "airtable", description: "Manage Airtable bases and records", category: "data", isPremium: false, usageCount: 189 },
  { name: "Google Sheets", slug: "google-sheets", description: "Read and write spreadsheet data", category: "data", isPremium: false, usageCount: 445 },
  { name: "HubSpot", slug: "hubspot", description: "CRM, marketing, and sales automation", category: "marketing", isPremium: true, usageCount: 234 },
  { name: "Anthropic", slug: "anthropic", description: "Claude AI models for advanced reasoning", category: "ai_ml", isPremium: true, usageCount: 567 },
  { name: "SendGrid", slug: "sendgrid", description: "Email delivery and marketing automation", category: "communication", isPremium: false, usageCount: 345 },
];

const categories = [
  { id: "all", name: "All Integrations" },
  { id: "ai_ml", name: "AI & ML" },
  { id: "communication", name: "Communication" },
  { id: "data", name: "Data" },
  { id: "productivity", name: "Productivity" },
  { id: "payment", name: "Payment" },
  { id: "developer", name: "Developer" },
  { id: "marketing", name: "Marketing" },
];

export default function IntegrationHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: integrations = [] } = useQuery<IntegrationConnector[]>({
    queryKey: ["/api/integrations"],
  });

  const displayIntegrations = integrations.length > 0 ? integrations : defaultIntegrations;

  const filteredIntegrations = displayIntegrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="integration-hub-page">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Integration Hub</h1>
            <p className="text-muted-foreground">
              Connect your agents to 100+ popular APIs and services
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Plug className="w-3 h-3" />
              {displayIntegrations.length} Available
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-integrations"
            />
          </div>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="flex-wrap h-auto gap-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-sm" data-testid={`tab-category-${cat.id}`}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration, index) => {
            const Logo = integrationLogos[integration.slug] || Plug;
            const CategoryIcon = categoryIcons[integration.category] || Plug;
            
            return (
              <Card key={integration.slug || index} className="hover-elevate transition-all" data-testid={`card-integration-${integration.slug}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Logo className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {integration.name}
                          {integration.isPremium && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          <CategoryIcon className="w-3 h-3 mr-1" />
                          {integration.category.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="line-clamp-2">
                    {integration.description}
                  </CardDescription>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {integration.usageCount?.toLocaleString() || 0} agents using
                    </span>
                    <Button size="sm" variant={integration.isPremium ? "default" : "outline"} data-testid={`button-connect-${integration.slug}`}>
                      {integration.isPremium ? (
                        <>
                          <Crown className="w-3 h-3 mr-1" />
                          Upgrade
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connect
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredIntegrations.length === 0 && (
          <Card className="p-12 text-center">
            <Plug className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No integrations found</h3>
            <p className="text-muted-foreground text-sm">
              Try adjusting your search or category filter
            </p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
