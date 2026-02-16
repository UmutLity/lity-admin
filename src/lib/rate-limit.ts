// ━━━ Enhanced Rate Limiter ━━━
// In-memory sliding window rate limiter

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockUntil: number;
}

const rateLimit = new Map<string, RateLimitEntry>();

const DEFAULTS = {
  general: { window: 60_000, max: 60, blockDuration: 120_000 },
  login: { window: 60_000, max: 5, blockDuration: 300_000 },     // 5 attempts → block 5 min
  api: { window: 60_000, max: 100, blockDuration: 60_000 },
  sensitive: { window: 60_000, max: 10, blockDuration: 180_000 }, // settings, users, security
};

type RateLimitType = keyof typeof DEFAULTS;

export function checkRateLimit(
  ip: string,
  type: RateLimitType = "general"
): { success: boolean; remaining: number; retryAfter?: number } {
  const config = DEFAULTS[type];
  const key = `${type}:${ip}`;
  const now = Date.now();

  const entry = rateLimit.get(key);

  // Check if currently blocked
  if (entry?.blocked && now < entry.blockUntil) {
    const retryAfter = Math.ceil((entry.blockUntil - now) / 1000);
    return { success: false, remaining: 0, retryAfter };
  }

  // Reset if window expired or block lifted
  if (!entry || now > entry.resetAt || (entry.blocked && now >= entry.blockUntil)) {
    rateLimit.set(key, { count: 1, resetAt: now + config.window, blocked: false, blockUntil: 0 });
    return { success: true, remaining: config.max - 1 };
  }

  if (entry.count >= config.max) {
    // Exceeded — engage block
    entry.blocked = true;
    entry.blockUntil = now + config.blockDuration;
    const retryAfter = Math.ceil(config.blockDuration / 1000);
    return { success: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { success: true, remaining: config.max - entry.count };
}

// ━━━ IP Reputation Tracker ━━━
// Track IPs that repeatedly get rate limited or send suspicious requests

const ipReputation = new Map<string, { strikes: number; lastStrike: number }>();
const MAX_STRIKES = 10;
const STRIKE_WINDOW = 30 * 60 * 1000; // 30 minutes
const BAN_DURATION = 60 * 60 * 1000;  // 1 hour

export function recordStrike(ip: string): boolean {
  const now = Date.now();
  const entry = ipReputation.get(ip);

  if (!entry || now - entry.lastStrike > STRIKE_WINDOW) {
    ipReputation.set(ip, { strikes: 1, lastStrike: now });
    return false;
  }

  entry.strikes++;
  entry.lastStrike = now;

  if (entry.strikes >= MAX_STRIKES) {
    // Auto-ban this IP for 1 hour
    const banKey = `banned:${ip}`;
    rateLimit.set(banKey, {
      count: 999,
      resetAt: now + BAN_DURATION,
      blocked: true,
      blockUntil: now + BAN_DURATION,
    });
    return true; // IP is now banned
  }

  return false;
}

export function isIpBanned(ip: string): boolean {
  const banKey = `banned:${ip}`;
  const entry = rateLimit.get(banKey);
  if (!entry) return false;
  if (Date.now() >= entry.blockUntil) {
    rateLimit.delete(banKey);
    return false;
  }
  return entry.blocked;
}

// ━━━ Cleanup ━━━
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimit.entries()) {
    if (now > entry.resetAt && (!entry.blocked || now >= entry.blockUntil)) {
      rateLimit.delete(key);
    }
  }
  for (const [key, entry] of ipReputation.entries()) {
    if (now - entry.lastStrike > STRIKE_WINDOW * 2) {
      ipReputation.delete(key);
    }
  }
}, 120_000);
