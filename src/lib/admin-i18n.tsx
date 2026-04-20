"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AdminLang = "en" | "tr";

type AdminI18nContextValue = {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
  t: (key: string, fallback?: string) => string;
};

const STORAGE_KEY = "lity_admin_lang";

const MESSAGES: Record<AdminLang, Record<string, string>> = {
  en: {
    "lang.en": "EN",
    "lang.tr": "TR",

    "sidebar.group.overview": "Overview",
    "sidebar.group.commerce": "Commerce",
    "sidebar.group.content": "Content",

    "sidebar.dashboard": "Dashboard",
    "sidebar.analytics": "Analytics",
    "sidebar.executive": "Executive",
    "sidebar.orders": "Orders",
    "sidebar.pendingDeliveries": "Pending Deliveries",
    "sidebar.tickets": "Tickets",
    "sidebar.users": "Users",
    "sidebar.security": "Security Center",
    "sidebar.sessions": "Sessions",
    "sidebar.roles": "Roles",

    "sidebar.products": "Products",
    "sidebar.categories": "Categories",
    "sidebar.licenses": "Licenses",
    "sidebar.payments": "Payments",
    "sidebar.topups": "Top-up Requests",
    "sidebar.coupons": "Coupons",
    "sidebar.resellers": "Resellers",
    "sidebar.reviews": "Reviews",

    "sidebar.changelogs": "Changelogs",
    "sidebar.guides": "Guides",
    "sidebar.blog": "Blog",
    "sidebar.media": "Media",
    "sidebar.coverGenerator": "Cover Generator",
    "sidebar.notifications": "Notifications",
    "sidebar.webhooks": "Webhook Center",
    "sidebar.insights": "Insights",
    "sidebar.timeline": "Timeline",
    "sidebar.performance": "Performance",
    "sidebar.seo": "SEO",
    "sidebar.system": "System",
    "sidebar.logs": "Logs",
    "sidebar.audit": "Audit Log",
    "sidebar.settings": "Settings",

    "header.searchPlaceholder": "Search pages, tools, and admin sections...",
    "header.notifications": "Notifications",
    "header.noNotifications": "No notifications",
    "header.settings": "Settings",
    "header.logout": "Logout",
    "header.live": "Live",
    "header.new": "new",
  },
  tr: {
    "lang.en": "EN",
    "lang.tr": "TR",

    "sidebar.group.overview": "Genel",
    "sidebar.group.commerce": "Ticaret",
    "sidebar.group.content": "Icerik",

    "sidebar.dashboard": "Panel",
    "sidebar.analytics": "Analitik",
    "sidebar.executive": "Yonetsel",
    "sidebar.orders": "Siparisler",
    "sidebar.pendingDeliveries": "Bekleyen Teslimatlar",
    "sidebar.tickets": "Talepler",
    "sidebar.users": "Kullanicilar",
    "sidebar.security": "Guvenlik Merkezi",
    "sidebar.sessions": "Oturumlar",
    "sidebar.roles": "Roller",

    "sidebar.products": "Urunler",
    "sidebar.categories": "Kategoriler",
    "sidebar.licenses": "Lisanslar",
    "sidebar.payments": "Odemeler",
    "sidebar.topups": "Bakiye Yukleme",
    "sidebar.coupons": "Kuponlar",
    "sidebar.resellers": "Bayiler",
    "sidebar.reviews": "Yorumlar",

    "sidebar.changelogs": "Degisim Kayitlari",
    "sidebar.guides": "Rehberler",
    "sidebar.blog": "Blog",
    "sidebar.media": "Medya",
    "sidebar.coverGenerator": "Kapak Uretici",
    "sidebar.notifications": "Bildirimler",
    "sidebar.webhooks": "Webhook Merkezi",
    "sidebar.insights": "Icgoruler",
    "sidebar.timeline": "Zaman Cizelgesi",
    "sidebar.performance": "Performans",
    "sidebar.seo": "SEO",
    "sidebar.system": "Sistem",
    "sidebar.logs": "Kayitlar",
    "sidebar.audit": "Denetim Kaydi",
    "sidebar.settings": "Ayarlar",

    "header.searchPlaceholder": "Sayfa, arac ve admin bolumu ara...",
    "header.notifications": "Bildirimler",
    "header.noNotifications": "Bildirim yok",
    "header.settings": "Ayarlar",
    "header.logout": "Cikis",
    "header.live": "Canli",
    "header.new": "yeni",
  },
};

const AdminI18nContext = createContext<AdminI18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key, fallback) => fallback || key,
});

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "tr" || stored === "en") {
        setLangState(stored);
        return;
      }
      const navLang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
      if (navLang.startsWith("tr")) {
        setLangState("tr");
      }
    } catch {}
  }, []);

  const setLang = (next: AdminLang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const t = (key: string, fallback?: string) => {
    return MESSAGES[lang]?.[key] || fallback || MESSAGES.en[key] || key;
  };

  const value = useMemo<AdminI18nContextValue>(() => ({ lang, setLang, t }), [lang]);
  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n() {
  return useContext(AdminI18nContext);
}
