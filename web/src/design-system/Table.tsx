// Re-uses @lshay/ui's shadcn table primitives (already an installed
// dependency, already themed via our CSS variables) rather than hand-rolling
// table markup. Its outer `overflow-auto` wrapper is the small-screen
// strategy AGENTS.md asks for ("controlled scrolling").
import {
  Table as TableRoot,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lshay/ui/components/default/table';
import type { ReactNode } from 'react';

export { TableBody, TableCell, TableHead, TableHeader, TableRoot, TableRow };

export interface DataTableColumn<T> {
  key: string;
  /** Already-translated column header. */
  header: string;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  /** Rendered instead of the table when `rows` is empty, e.g. an EmptyState. */
  emptyState?: ReactNode;
}

/** Generic data table: columns + rows in, a horizontally-scrollable table (or empty state) out. */
export function DataTable<T>({ columns, rows, getRowId, emptyState }: DataTableProps<T>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <TableRoot>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowId(row)}>
            {columns.map((column) => (
              <TableCell key={column.key} className={column.cellClassName}>
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </TableRoot>
  );
}
