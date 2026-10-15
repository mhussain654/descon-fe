import { statusCopyStyle } from './StatusPresentation';

describe('statusCopyStyle', () => {
  it('gives Urdu text a line height of twice its font size so Nastaliq is not clipped', () => {
    expect(statusCopyStyle('ur').lineHeight).toBe(30);
    expect(statusCopyStyle('ur', 25).lineHeight).toBe(50);
    expect(statusCopyStyle('ur', 21).lineHeight).toBe(42);
  });

  it('leaves English line height to each style', () => {
    expect(statusCopyStyle('en', 25)).not.toHaveProperty('lineHeight');
  });
});
