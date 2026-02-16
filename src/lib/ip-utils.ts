// ─── IP Address Utilities ─────────────────────────────

/**
 * Parse IP address to 32-bit integer
 */
function ipToLong(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Check if an IP matches a CIDR range
 * Supports: single IP "1.2.3.4", CIDR "1.2.3.0/24", wildcard "1.2.3.*"
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const trimmed = cidr.trim();

  // Handle wildcard notation (1.2.3.*)
  if (trimmed.includes("*")) {
    const pattern = trimmed.replace(/\./g, "\\.").replace(/\*/g, "\\d+");
    return new RegExp(`^${pattern}$`).test(ip);
  }

  // Handle CIDR notation (1.2.3.0/24)
  if (trimmed.includes("/")) {
    const [network, maskStr] = trimmed.split("/");
    const mask = parseInt(maskStr, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;

    const ipLong = ipToLong(ip);
    const networkLong = ipToLong(network);
    const maskBits = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;

    return (ipLong & maskBits) === (networkLong & maskBits);
  }

  // Exact match
  return ip === trimmed;
}

/**
 * Check if an IP is allowed by any CIDR in the list
 */
export function ipIsAllowed(ip: string, allowedCidrs: string[]): boolean {
  if (!allowedCidrs || allowedCidrs.length === 0) return true;
  return allowedCidrs.some((cidr) => ipMatchesCidr(ip, cidr));
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Validate CIDR format
 */
export function isValidCidr(cidr: string): boolean {
  const trimmed = cidr.trim();

  // Single IP
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return true;

  // CIDR
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(trimmed)) {
    const mask = parseInt(trimmed.split("/")[1], 10);
    return mask >= 0 && mask <= 32;
  }

  // Wildcard
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\*$/.test(trimmed)) return true;

  return false;
}
