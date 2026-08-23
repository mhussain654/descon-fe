import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { List } from './List';

interface Item {
  id: string;
  name: string;
}

const items: Item[] = [
  { id: '1', name: 'Ahmed Khan' },
  { id: '2', name: 'علی حسن' },
];

describe('List', () => {
  it('shows the loading state while the first page is loading', () => {
    render(
      <List<Item>
        data={[]}
        isLoading
        loadingMessage="Loading…"
        renderItem={(item) => <Text>{item.name}</Text>}
        keyExtractor={(item) => item.id}
      />
    );
    expect(screen.getByRole('progressbar', { name: 'Loading…' })).toBeOnTheScreen();
  });

  it('shows the empty state once loading finishes with zero items', () => {
    render(
      <List<Item>
        data={[]}
        renderItem={(item) => <Text>{item.name}</Text>}
        keyExtractor={(item) => item.id}
        emptyState={{ title: 'No candidates found' }}
      />
    );
    expect(screen.getByText('No candidates found')).toBeOnTheScreen();
  });

  it('renders every item, including already-translated Urdu content', () => {
    render(<List<Item> data={items} renderItem={(item) => <Text>{item.name}</Text>} keyExtractor={(item) => item.id} />);
    expect(screen.getByText('Ahmed Khan')).toBeOnTheScreen();
    expect(screen.getByText('علی حسن')).toBeOnTheScreen();
  });
});
