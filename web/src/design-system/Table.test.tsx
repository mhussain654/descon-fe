import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './Table';

interface Candidate {
  id: number;
  name: string;
  stage: string;
}

const columns: DataTableColumn<Candidate>[] = [
  { key: 'name', header: 'Candidate', render: (row) => row.name },
  { key: 'stage', header: 'Stage', render: (row) => row.stage },
];

const rows: Candidate[] = [
  { id: 1, name: 'Ahmed Khan', stage: 'Documents Uploaded' },
  { id: 2, name: 'علی حسن', stage: 'زیر التواء' },
];

describe('DataTable', () => {
  it('renders a semantic table with translated headers and every row', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(row) => row.id} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getByText('علی حسن')).toBeInTheDocument();
  });

  it('renders the empty state instead of the table when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(row) => row.id}
        emptyState={<p>No candidates found</p>}
      />
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No candidates found')).toBeInTheDocument();
  });
});
