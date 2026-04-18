export type RecommendedProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  price: number;
  buyUrl?: string | null;
};

export type CustomerLicense = {
  id: string;
  productName: string;
  productSlug: string;
  licenseKey: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
  downloadUrl: string | null;
};

export type FaqItem = {
  question: string;
  answer: string;
};

