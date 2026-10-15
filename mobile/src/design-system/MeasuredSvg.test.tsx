import { fireEvent, render, screen } from '@testing-library/react-native';
import Svg, { Rect } from 'react-native-svg';
import { MeasuredSvg } from './MeasuredSvg';

it('sizes SVG artwork to the measured native surface', () => {
  render(<MeasuredSvg><Rect width="100%" height="100%" fill="blue" /></MeasuredSvg>);
  expect(screen.UNSAFE_queryByType(Svg)).toBeNull();
  fireEvent(screen.getByTestId('measured-svg-surface'), 'layout', { nativeEvent: { layout: { width: 320, height: 180 } } });
  const svg = screen.UNSAFE_getByType(Svg);
  expect(svg.props.width).toBe(320);
  expect(svg.props.height).toBe(180);
});
