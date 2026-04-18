import { FaqItem } from "@/types/customer-dashboard";

const defaultItems: FaqItem[] = [
  { question: "Is it safe?", answer: "Our products are regularly updated." },
  { question: "Is delivery instant?", answer: "Yes, delivery is automatic after payment." },
  { question: "Can I get a refund?", answer: "Refund is only possible if the license was not activated." },
  { question: "Do I need special setup?", answer: "No, instructions are provided in your dashboard." },
  { question: "Do you provide support?", answer: "Yes, via ticket system and Discord." },
];

export function FAQSection({ items = defaultItems }: { items?: FaqItem[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-100">Frequently Asked Questions</h2>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 open:border-violet-300/25 open:bg-violet-500/[0.06]"
          >
            <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">
              {item.question}
            </summary>
            <p className="mt-2 text-xs text-zinc-400">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

