import { ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  emptyText = "No data found.",
}: {
  columns: Array<Column<T>>;
  rows: T[];
  emptyText?: string;
}) {
  return (
    <div className="admin-table-scroll overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
      <table className="premium-table w-full border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-500 ${column.className || ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4">
                <EmptyState title={emptyText} description="There is nothing to show here yet." className="border-0 py-10 shadow-none" />
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="text-xs text-zinc-300 transition-colors hover:bg-white/[0.035]">
                {columns.map((column) => (
                  <td key={`${column.key}-${index}`} className={`px-4 py-3 ${column.className || ""}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
