import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card, CardDescription, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <Text>Body content</Text>
      </Card>
    );
    expect(screen.getByText('Body content')).toBeOnTheScreen();
  });

  it('renders long Urdu title/description text', () => {
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
    expect(screen.getByText('درخواست کی حیثیت اور مکمل تفصیلات')).toBeOnTheScreen();
  });
});
