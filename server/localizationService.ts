import { db } from "./db";
import { 
  translations, userLanguagePrefs,
  type Translation, type UserLanguagePref,
  type InsertTranslation, type InsertUserLanguagePref,
  supportedLanguages
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type SupportedLanguage = typeof supportedLanguages[number];

export interface TranslationNamespace {
  namespace: string;
  keys: Record<string, string>;
}

const DEFAULT_TRANSLATIONS: Record<string, Record<string, string>> = {
  common: {
    "app.name": "BountyAI",
    "app.tagline": "AI-Powered Bounty Marketplace",
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.bounties": "Bounties",
    "nav.agents": "Agents",
    "nav.leaderboard": "Leaderboard",
    "nav.pricing": "Pricing",
    "nav.settings": "Settings",
    "action.submit": "Submit",
    "action.cancel": "Cancel",
    "action.save": "Save",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.create": "Create",
    "action.search": "Search",
    "action.filter": "Filter",
    "action.login": "Log In",
    "action.logout": "Log Out",
    "action.signup": "Sign Up",
    "status.loading": "Loading...",
    "status.error": "Error",
    "status.success": "Success",
    "status.pending": "Pending",
    "status.completed": "Completed",
    "status.failed": "Failed",
  },
  bounty: {
    "bounty.create": "Create Bounty",
    "bounty.title": "Bounty Title",
    "bounty.description": "Description",
    "bounty.reward": "Reward",
    "bounty.deadline": "Deadline",
    "bounty.category": "Category",
    "bounty.status.open": "Open",
    "bounty.status.in_progress": "In Progress",
    "bounty.status.completed": "Completed",
    "bounty.status.cancelled": "Cancelled",
    "bounty.success_metrics": "Success Metrics",
    "bounty.verification": "Verification Criteria",
  },
  agent: {
    "agent.create": "Create Agent",
    "agent.name": "Agent Name",
    "agent.description": "Description",
    "agent.capabilities": "Capabilities",
    "agent.rating": "Rating",
    "agent.earnings": "Total Earnings",
    "agent.upload": "Upload Agent",
    "agent.test": "Test Agent",
    "agent.publish": "Publish Agent",
  },
  dashboard: {
    "dashboard.welcome": "Welcome back",
    "dashboard.overview": "Platform Overview",
    "dashboard.my_bounties": "My Bounties",
    "dashboard.my_agents": "My Agents",
    "dashboard.recent_activity": "Recent Activity",
    "dashboard.earnings": "Earnings",
    "dashboard.spending": "Spending",
  },
  settings: {
    "settings.profile": "Profile Settings",
    "settings.security": "Security",
    "settings.notifications": "Notifications",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.timezone": "Timezone",
  },
};

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
  ru: "Русский",
  nl: "Nederlands",
  sv: "Svenska",
  pl: "Polski",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
};

class LocalizationService {
  async initializeDefaultTranslations(): Promise<void> {
    for (const [namespace, keys] of Object.entries(DEFAULT_TRANSLATIONS)) {
      for (const [key, value] of Object.entries(keys)) {
        const existing = await db.select()
          .from(translations)
          .where(and(
            eq(translations.key, key),
            eq(translations.language, "en")
          ))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(translations).values({
            key,
            language: "en",
            value,
            namespace,
            isVerified: true,
          });
        }
      }
    }
  }

  async getTranslation(key: string, language: SupportedLanguage): Promise<string | null> {
    const [translation] = await db.select()
      .from(translations)
      .where(and(
        eq(translations.key, key),
        eq(translations.language, language)
      ));

    if (translation) return translation.value;

    if (language !== "en") {
      const [fallback] = await db.select()
        .from(translations)
        .where(and(
          eq(translations.key, key),
          eq(translations.language, "en")
        ));
      return fallback?.value || null;
    }

    return null;
  }

  async getNamespaceTranslations(
    namespace: string,
    language: SupportedLanguage
  ): Promise<Record<string, string>> {
    const results = await db.select()
      .from(translations)
      .where(and(
        eq(translations.namespace, namespace),
        eq(translations.language, language)
      ));

    const translationMap: Record<string, string> = {};
    for (const t of results) {
      translationMap[t.key] = t.value;
    }

    if (language !== "en") {
      const englishResults = await db.select()
        .from(translations)
        .where(and(
          eq(translations.namespace, namespace),
          eq(translations.language, "en")
        ));

      for (const t of englishResults) {
        if (!translationMap[t.key]) {
          translationMap[t.key] = t.value;
        }
      }
    }

    return translationMap;
  }

  async getAllTranslations(language: SupportedLanguage): Promise<Record<string, Record<string, string>>> {
    const results = await db.select()
      .from(translations)
      .where(eq(translations.language, language));

    const grouped: Record<string, Record<string, string>> = {};
    for (const t of results) {
      const ns = t.namespace || "common";
      if (!grouped[ns]) grouped[ns] = {};
      grouped[ns][t.key] = t.value;
    }

    return grouped;
  }

  async addTranslation(
    key: string,
    language: SupportedLanguage,
    value: string,
    namespace: string = "common",
    context?: string
  ): Promise<Translation> {
    const existing = await db.select()
      .from(translations)
      .where(and(
        eq(translations.key, key),
        eq(translations.language, language)
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(translations)
        .set({ value, context, updatedAt: new Date() })
        .where(eq(translations.id, existing[0].id))
        .returning();
      return updated;
    }

    const [translation] = await db.insert(translations).values({
      key,
      language,
      value,
      namespace,
      context,
      isVerified: language === "en",
    }).returning();

    return translation;
  }

  async verifyTranslation(translationId: number, verifierId: string): Promise<Translation> {
    const [updated] = await db.update(translations)
      .set({
        isVerified: true,
        verifiedById: verifierId,
        updatedAt: new Date(),
      })
      .where(eq(translations.id, translationId))
      .returning();

    return updated;
  }

  async getUserLanguagePreference(userId: string): Promise<UserLanguagePref | null> {
    const [pref] = await db.select()
      .from(userLanguagePrefs)
      .where(eq(userLanguagePrefs.userId, userId));
    return pref || null;
  }

  async setUserLanguagePreference(
    userId: string,
    preferences: Partial<InsertUserLanguagePref>
  ): Promise<UserLanguagePref> {
    const existing = await this.getUserLanguagePreference(userId);

    if (existing) {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (preferences.preferredLanguage) updateData.preferredLanguage = preferences.preferredLanguage;
      if (preferences.fallbackLanguage) updateData.fallbackLanguage = preferences.fallbackLanguage;
      if (preferences.autoDetect !== undefined) updateData.autoDetect = preferences.autoDetect;
      if (preferences.dateFormat) updateData.dateFormat = preferences.dateFormat;
      if (preferences.numberFormat) updateData.numberFormat = preferences.numberFormat;
      if (preferences.timezone) updateData.timezone = preferences.timezone;
      
      const [updated] = await db.update(userLanguagePrefs)
        .set(updateData)
        .where(eq(userLanguagePrefs.userId, userId))
        .returning();
      return updated;
    }

    const [pref] = await db.insert(userLanguagePrefs).values({
      userId,
      preferredLanguage: (preferences.preferredLanguage || "en") as any,
      fallbackLanguage: (preferences.fallbackLanguage || "en") as any,
      autoDetect: preferences.autoDetect ?? true,
      dateFormat: preferences.dateFormat || "MM/DD/YYYY",
      numberFormat: preferences.numberFormat || "en-US",
      timezone: preferences.timezone || "UTC",
    }).returning();

    return pref;
  }

  detectLanguageFromHeaders(acceptLanguage: string | undefined): SupportedLanguage {
    if (!acceptLanguage) return "en";

    const languages = acceptLanguage
      .split(",")
      .map(lang => {
        const [code, q = "q=1"] = lang.trim().split(";");
        return {
          code: code.split("-")[0].toLowerCase(),
          quality: parseFloat(q.split("=")[1] || "1"),
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const lang of languages) {
      if (supportedLanguages.includes(lang.code as SupportedLanguage)) {
        return lang.code as SupportedLanguage;
      }
    }

    return "en";
  }

  getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string }> {
    return supportedLanguages.map(code => ({
      code,
      name: LANGUAGE_NAMES[code],
    }));
  }

  async getTranslationStats(): Promise<{
    totalKeys: number;
    byLanguage: Record<string, { total: number; verified: number }>;
    coverageByLanguage: Record<string, number>;
  }> {
    const englishKeys = await db.select()
      .from(translations)
      .where(eq(translations.language, "en"));

    const totalKeys = englishKeys.length;
    const byLanguage: Record<string, { total: number; verified: number }> = {};
    const coverageByLanguage: Record<string, number> = {};

    for (const lang of supportedLanguages) {
      const langTranslations = await db.select()
        .from(translations)
        .where(eq(translations.language, lang));

      const verified = langTranslations.filter(t => t.isVerified).length;
      byLanguage[lang] = { total: langTranslations.length, verified };
      coverageByLanguage[lang] = totalKeys > 0 ? (langTranslations.length / totalKeys) * 100 : 0;
    }

    return { totalKeys, byLanguage, coverageByLanguage };
  }

  async getMissingTranslations(language: SupportedLanguage): Promise<string[]> {
    const englishKeys = await db.select({ key: translations.key })
      .from(translations)
      .where(eq(translations.language, "en"));

    const translatedKeys = await db.select({ key: translations.key })
      .from(translations)
      .where(eq(translations.language, language));

    const translatedSet = new Set(translatedKeys.map(t => t.key));
    return englishKeys
      .map(t => t.key)
      .filter(key => !translatedSet.has(key));
  }

  formatDate(date: Date, format: string, locale: string = "en-US"): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: format.includes("YYYY") ? "numeric" : undefined,
        month: format.includes("MM") ? "2-digit" : format.includes("MMM") ? "short" : undefined,
        day: format.includes("DD") ? "2-digit" : undefined,
        hour: format.includes("HH") ? "2-digit" : undefined,
        minute: format.includes("mm") ? "2-digit" : undefined,
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }

  formatNumber(value: number, locale: string = "en-US", options?: Intl.NumberFormatOptions): string {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      return value.toString();
    }
  }

  formatCurrency(value: number, currency: string = "USD", locale: string = "en-US"): string {
    return this.formatNumber(value, locale, {
      style: "currency",
      currency,
    });
  }
}

export const localizationService = new LocalizationService();
