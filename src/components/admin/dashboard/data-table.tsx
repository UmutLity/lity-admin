import { ReactNode } from "react";

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
    <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
      <table className="w-full border-collapse text-left">
        <thead className="bg-white/[0.03]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500 ${column.className || ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-xs text-zinc-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-white/[0.06] text-xs text-zinc-300 hover:bg-white/[0.02]">
                {columns.map((column) => (
                  <td key={`${column.key}-${index}`} className={`px-3 py-2.5 ${column.className || ""}`}>
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

