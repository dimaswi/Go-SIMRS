import type { ColumnDef } from "@tanstack/react-table";

export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    header: () => <div className="text-center w-10">No</div>,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <div className="text-center font-mono text-xs text-neutral-500 w-10">
          {pageIndex * pageSize + row.index + 1}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  };
}

export type { ColumnDef };
