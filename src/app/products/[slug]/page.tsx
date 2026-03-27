import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProductDetailView, type ProductDetailData, type RelatedProductData } from "@/components/product/product-detail-view";

async function getProductData(slug: string): Promise<{ product: ProductDetailData; related: RelatedProductData[] } | null> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      prices: { orderBy: { price: "asc" } },
      gallery: { orderBy: { order: "asc" } },
      features: { orderBy: { order: "asc" } },
      specifications: { orderBy: { order: "asc" } },
      changelogs: {
        include: { changelog: true },
        orderBy: { changelog: { publishedAt: "desc" } },
        take: 6,
      },
    },
  });

  if (!product) return null;

  const relatedProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [{ category: product.category }, { isFeatured: true }],
    },
    include: {
      prices: { orderBy: { price: "asc" } },
      gallery: { where: { isThumbnail: true }, orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    take: 3,
  });

  const mapped: ProductDetailData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    status: product.status,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    longDescription: product.longDescription ?? "",
    technicalDescription: product.technicalDescription ?? "",
    currency: product.currency,
    updatedAt: product.updatedAt.toISOString(),
    prices: product.prices.map((price) => ({
      id: price.id,
      plan: price.plan,
      price: price.price,
    })),
    features: product.features.map((feature) => ({
      id: feature.id,
      title: feature.title,
      description: feature.description ?? "",
    })),
    specifications: product.specifications.map((spec) => ({
      id: spec.id,
      label: spec.label,
      value: spec.value,
    })),
    gallery: product.gallery.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText ?? product.name,
      isThumbnail: image.isThumbnail,
    })),
    changelog: product.changelogs
      .filter((entry) => !!entry.changelog && !entry.changelog.isDraft)
      .map((entry) => ({
        id: entry.changelog.id,
        title: entry.changelog.title,
        body: entry.changelog.body,
        type: entry.changelog.type,
        publishedAt: entry.changelog.publishedAt ? entry.changelog.publishedAt.toISOString() : null,
      })),
  };

  const related: RelatedProductData[] = relatedProducts.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortDescription: item.shortDescription ?? "No description",
    status: item.status,
    fromPrice: item.prices[0]?.price ?? 0,
    imageUrl: item.gallery[0]?.url ?? null,
    currency: item.currency,
  }));

  return { product: mapped, related };
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const data = await getProductData(params.slug);
  if (!data) {
    notFound();
  }

  return <ProductDetailView product={data.product} relatedProducts={data.related} />;
}
