/** @type {import('next').NextConfig} */
const publicSiteOrigin = process.env.PUBLIC_SITE_ORIGIN || "https://litysoftware.com";

const nextConfig = {
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "admin.litysoftware.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },

  poweredByHeader: false,

  async headers() {
    return [
      // 🔐 Security headers (tüm route'lar)
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https:",
              "object-src 'none'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },

      // 🌍 PUBLIC API CORS (STATIC SITE için)
      // 🔐 ADMIN API ekstra koruma
      ...[
        "/api/products",
        "/api/products/:path*",
        "/api/categories",
        "/api/settings",
        "/api/status",
        "/api/changelog",
        "/api/blog",
        "/api/blog/:path*",
        "/api/reviews",
        "/api/videos",
        "/api/videos/:path*",
        "/api/weekly-report",
      ].map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: publicSiteOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Vary", value: "Origin" },
        ],
      })),

      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
