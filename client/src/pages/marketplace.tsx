import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Package, Bot, Plug, Search, Star, Download, ExternalLink, 
  Check, Zap, Database, Mail, MessageSquare, BarChart3, FileText, Loader2 
} from "lucide-react";
import { Link } from "wouter";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rating: number;
  downloads: number;
  verified: boolean;
  price: string;
  features: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: "openai",
    name: "OpenAI GPT-4",
    description: "Power your agents with the latest GPT-4 models for superior task completion",
    category: "ai",
    icon: "zap",
    rating: 4.9,
    downloads: 15420,
    verified: true,
    price: "Usage-based",
    features: ["GPT-4 & GPT-4o access", "Function calling", "Vision capabilities", "JSON mode"],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Access Claude 3 models for thoughtful and harmless AI assistance",
    category: "ai",
    icon: "bot",
    rating: 4.8,
    downloads: 8932,
    verified: true,
    price: "Usage-based",
    features: ["Claude 3 Opus/Sonnet", "200K context window", "Tool use", "Constitutional AI"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send real-time notifications and updates to your Slack workspace",
    category: "communication",
    icon: "message",
    rating: 4.7,
    downloads: 12350,
    verified: true,
    price: "Free",
    features: ["Channel notifications", "Direct messages", "Rich formatting", "Webhooks"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Create and update Notion pages directly from your bounty outputs",
    category: "productivity",
    icon: "file",
    rating: 4.6,
    downloads: 7821,
    verified: true,
    price: "Free",
    features: ["Page creation", "Database updates", "Block editing", "Comments"],
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Sync bounty data and outputs with your Airtable bases",
    category: "database",
    icon: "database",
    rating: 4.5,
    downloads: 5420,
    verified: true,
    price: "Free",
    features: ["Record CRUD", "Attachment handling", "Formula fields", "Views"],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect BountyAI to 5,000+ apps with automated workflows",
    category: "automation",
    icon: "zap",
    rating: 4.8,
    downloads: 18730,
    verified: true,
    price: "Subscription",
    features: ["5000+ app integrations", "Multi-step Zaps", "Filters & paths", "Webhooks"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Export bounty results and analytics to Google Sheets",
    category: "productivity",
    icon: "chart",
    rating: 4.7,
    downloads: 11200,
    verified: true,
    price: "Free",
    features: ["Read/write cells", "Create sheets", "Charts", "Formulas"],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send email notifications and reports from your agents",
    category: "communication",
    icon: "mail",
    rating: 4.5,
    downloads: 6540,
    verified: true,
    price: "Usage-based",
    features: ["Transactional email", "Templates", "Analytics", "Deliverability"],
  },
];

const ICON_MAP: Record<string, any> = {
  zap: Zap,
  bot: Bot,
  message: MessageSquare,
  file: FileText,
  database: Database,
  chart: BarChart3,
  mail: Mail,
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI Models" },
  { id: "communication", label: "Communication" },
  { id: "productivity", label: "Productivity" },
  { id: "database", label: "Database" },
  { id: "automation", label: "Automation" },
];

export function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filteredIntegrations = INTEGRATIONS.filter((int) => {
    const matchesSearch = int.name.toLowerCase().includes(search.toLowerCase()) ||
      int.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || int.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Integration Marketplace
            </h1>
            <p className="text-sm text-muted-foreground">Connect tools and extend capabilities</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={category === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.id)}
              data-testid={`category-${cat.id}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => {
            const Icon = ICON_MAP[integration.icon] || Plug;
            return (
              <Card key={integration.id} className="flex flex-col" data-testid={`integration-${integration.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      {integration.verified && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-3">{integration.name}</CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning fill-warning" />
                      {integration.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      {integration.downloads.toLocaleString()}
                    </span>
                    <Badge variant="outline">{integration.price}</Badge>
                  </div>
                  <div className="space-y-1">
                    {integration.features.slice(0, 3).map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-3 h-3 text-success" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {integration.features.length > 3 && (
                      <div className="text-sm text-muted-foreground">
                        +{integration.features.length - 3} more features
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button className="flex-1" data-testid={`button-install-${integration.id}`}>
                    Install
                  </Button>
                  <Button variant="outline" size="icon">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">No integrations found</p>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </main>
    </div>
  );
}
