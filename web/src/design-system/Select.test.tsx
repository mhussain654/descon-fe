import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

describe('Select', () => {
  it('associates the label with the field via htmlFor/id', () => {
    render(<Select label="Role" options={ROLE_OPTIONS} />);
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
  });

  it('renders every option', () => {
    render(<Select label="Role" options={ROLE_OPTIONS} />);
    const select = screen.getByLabelText('Role') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['admin', 'manager', 'viewer']);
  });

  it('reflects the controlled value', () => {
    render(<Select label="Role" options={ROLE_OPTIONS} value="manager" onChange={() => {}} />);
    expect(screen.getByLabelText('Role')).toHaveValue('manager');
  });

  it('switches to the validation message and marks the field invalid when there is an error', () => {
    render(<Select label="Role" options={ROLE_OPTIONS} helperText="Pick one" errorMessage="Role is required" />);
    const select = screen.getByLabelText('Role');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Role is required');
    expect(screen.queryByText('Pick one')).not.toBeInTheDocument();
  });

  it('disables the field when disabled is set', () => {
    render(<Select label="Role" options={ROLE_OPTIONS} disabled />);
    expect(screen.getByLabelText('Role')).toBeDisabled();
  });
});
