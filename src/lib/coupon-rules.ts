export type CouponRuleConfig = {
  firstPurchaseOnly?: boolean;
  allowedProductIds?: string[];
  allowedCategories?: string[];
  allowedPlans?: string[];
  customerRoleAllowlist?: string[];
  maxDiscountAmount?: number | null;
};

type CouponMetaEnvelope = {
  text?: string;
  rules?: CouponRuleConfig;
};

const COUPON_META_PREFIX = "__LITY_COUPON_RULES_V1__:";

function normalizeStringArray(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return Array.from(
    new Set(
      input
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
}

function sanitizeRuleConfig(input?: CouponRuleConfig | null): CouponRuleConfig {
  const next: CouponRuleConfig = {};
  if (!input) return next;

  if (input.firstPurchaseOnly === true) next.firstPurchaseOnly = true;

  const allowedProductIds = normalizeStringArray(input.allowedProductIds);
  if (allowedProductIds.length) next.allowedProductIds = allowedProductIds;

  const allowedCategories = normalizeStringArray(input.allowedCategories).map((v) => v.toUpperCase());
  if (allowedCategories.length) next.allowedCategories = allowedCategories;

  const allowedPlans = normalizeStringArray(input.allowedPlans).map((v) => v.toUpperCase());
  if (allowedPlans.length) next.allowedPlans = allowedPlans;

  const customerRoleAllowlist = normalizeStringArray(input.customerRoleAllowlist).map((v) => v.toUpperCase());
  if (customerRoleAllowlist.length) next.customerRoleAllowlist = customerRoleAllowlist;

  if (input.maxDiscountAmount !== undefined && input.maxDiscountAmount !== null) {
    const n = Number(input.maxDiscountAmount);
    if (Number.isFinite(n) && n > 0) next.maxDiscountAmount = n;
  }

  return next;
}

function hasAnyRules(rules: CouponRuleConfig) {
  return Boolean(
    rules.firstPurchaseOnly ||
    (rules.allowedProductIds && rules.allowedProductIds.length) ||
    (rules.allowedCategories && rules.allowedCategories.length) ||
    (rules.allowedPlans && rules.allowedPlans.length) ||
    (rules.customerRoleAllowlist && rules.customerRoleAllowlist.length) ||
    (rules.maxDiscountAmount && rules.maxDiscountAmount > 0)
  );
}

export function parseCouponDescription(rawDescription: string | null | undefined) {
  const raw = String(rawDescription || "");
  if (!raw.startsWith(COUPON_META_PREFIX)) {
    return {
      description: raw || null,
      ruleConfig: {} as CouponRuleConfig,
    };
  }

  try {
    const json = raw.slice(COUPON_META_PREFIX.length);
    const parsed = JSON.parse(json) as CouponMetaEnvelope;
    const description = String(parsed?.text || "").trim() || null;
    const ruleConfig = sanitizeRuleConfig(parsed?.rules || {});
    return { description, ruleConfig };
  } catch {
    return {
      description: rawDescription || null,
      ruleConfig: {} as CouponRuleConfig,
    };
  }
}

export function encodeCouponDescription(description: string | null | undefined, ruleConfig?: CouponRuleConfig | null) {
  const cleanDescription = String(description || "").trim() || null;
  const cleanRules = sanitizeRuleConfig(ruleConfig || {});
  if (!hasAnyRules(cleanRules)) return cleanDescription;

  const envelope: CouponMetaEnvelope = {
    text: cleanDescription || "",
    rules: cleanRules,
  };
  return `${COUPON_META_PREFIX}${JSON.stringify(envelope)}`;
}

export function sanitizeCouponRuleConfig(input?: CouponRuleConfig | null) {
  return sanitizeRuleConfig(input || {});
}
