import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FileText } from 'lucide-react-native';
import { QuickActionTile } from './QuickActionTile';

describe('QuickActionTile', () => {
  it.each([['en'], ['ur']])('has an opaque base colour so Android never shows its elevation shadow through (%s)', (language) => {
    render(
      <QuickActionTile
        language={language}
        tone="green"
        icon={FileText}
        title="Application Status"
        subtitle="Check your progress"
        onPress={() => {}}
      />
    );

    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.backgroundColor).toBe('#EAFBF1');
  });
});
