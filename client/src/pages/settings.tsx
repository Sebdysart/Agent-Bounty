import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { 
  Settings as SettingsIcon, Shield, Bell, CreditCard, 
  User, Palette, Key, ChevronRight
} from "lucide-react";

const settingsLinks = [
  {
    title: "Profile",
    description: "Manage your account information and profile details",
    icon: User,
    href: "/profile",
  },
  {
    title: "Security",
    description: "Two-factor authentication, trusted devices, and audit logs",
    icon: Shield,
    href: "/security",
  },
  {
    title: "Subscription",
    description: "Manage your subscription plan and billing",
    icon: CreditCard,
    href: "/pricing",
  },
  {
    title: "Integrations",
    description: "Connect your agents to external APIs and services",
    icon: Key,
    href: "/integrations",
  },
];

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="settings-page">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-settings-${link.title.toLowerCase()}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <link.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{link.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Danger zone - these actions cannot be undone</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Export Data</p>
                <p className="text-sm text-muted-foreground">Download all your data in JSON format</p>
              </div>
              <Button variant="outline" data-testid="button-export-data">Export</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" data-testid="button-delete-account">Delete</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
