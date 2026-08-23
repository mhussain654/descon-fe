import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardDescription, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies padding by default and omits it with noPadding', () => {
    const { rerender } = render(<Card>content</Card>);
    expect(screen.getByText('content').className).toMatch(/\bp-6\b/);

    rerender(<Card noPadding>content</Card>);
    expect(screen.getByText('content').className).not.toMatch(/\bp-6\b/);
  });

  it('renders long Urdu title/description text without clipping', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>درخواست کی حیثیت اور مکمل تفصیلات</CardTitle>
          <CardDescription>
            یہ متن جان بوجھ کر لمبا رکھا گیا ہے تاکہ یہ یقینی بنایا جا سکے کہ یہ کارڈ کے اندر درست طریقے سے لپٹتا ہے۔
          </CardDescription>
        </CardHeader>
      </Card>
    );
    const title = screen.getByText('درخواست کی حیثیت اور مکمل تفصیلات');
    expect(title.className).not.toMatch(/truncate|overflow-hidden|text-ellipsis/);
  });
});
