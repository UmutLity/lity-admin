import Link from "next/link";
import { RecommendedProduct } from "@/types/customer-dashboard";

type RecommendedProductsProps = {
  products: RecommendedProduct[];
  ownedProductIds: string[];
  className?: string;
};

function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

export function RecommendedProducts({
  products,
  ownedProductIds,
  className,
}: RecommendedProductsProps) {
  const owned = new Set(ownedProductIds);
  const visible = products.filter((product) => !owned.has(product.id)).slice(0, 4);

  return (
    <section className={className}>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-100">Recommended for you</h3>
        <p className="mt-1 text-xs text-zinc-500">Based on your current licenses</p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-zinc-500">
          No new recommendations available right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-3"
            >
              <div className="mb-3 h-28 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-600">No image</div>
                )}
              </div>

              <h4 className="line-clamp-1 text-sm font-semibold text-zinc-100">{product.name}</h4>
              <p className="mt-1 line-clamp-2 min-h-[30px] text-xs text-zinc-500">
                {product.shortDescription || "Premium product ready for instant delivery."}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-300">{formatPrice(product.price)}</span>
                <Link
                  href={product.buyUrl || `/products/${product.slug}`}
                  className="inline-flex h-8 items-center rounded-lg border border-violet-300/30 bg-violet-500/10 px-2.5 text-xs font-medium text-violet-100 hover:bg-violet-500/15"
                >
                  Buy
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

