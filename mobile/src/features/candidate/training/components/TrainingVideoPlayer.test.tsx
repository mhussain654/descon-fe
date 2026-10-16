import { act, render, screen } from '@testing-library/react-native';
import { TrainingVideoPlayer } from './TrainingVideoPlayer';

type StatusListener = (event: { status: string }) => void;

// expo-video's useVideoPlayer returns the same player on every render, so the mock must too.
jest.mock('expo-video', () => {
  const remove = jest.fn();
  const addListener = jest.fn(() => ({ remove }));
  const player = { loop: false, addListener };
  return { VideoView: 'VideoView', useVideoPlayer: () => player, __player: player, __remove: remove };
});

const { __player: player, __remove: remove } = jest.requireMock('expo-video') as {
  __player: { addListener: jest.Mock };
  __remove: jest.Mock;
};

function emitStatus(status: string) {
  const listener = player.addListener.mock.calls.at(-1)?.[1] as StatusListener;
  act(() => listener({ status }));
}

describe('TrainingVideoPlayer', () => {
  beforeEach(() => {
    player.addListener.mockClear();
    remove.mockClear();
  });

  it('shows no error while the video loads and plays', () => {
    render(<TrainingVideoPlayer url="https://example.test/signed" language="en" errorMessage="Could not play" />);
    emitStatus('readyToPlay');
    expect(screen.queryByText('Could not play')).not.toBeOnTheScreen();
  });

  it('shows the translated message instead of a silent black box when playback fails', () => {
    render(<TrainingVideoPlayer url="https://example.test/signed" language="ur" errorMessage="ویڈیو نہیں چل سکی" />);
    emitStatus('error');
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText('ویڈیو نہیں چل سکی')).toBeOnTheScreen();
  });

  it('removes its listener on unmount', () => {
    const { unmount } = render(<TrainingVideoPlayer url="https://example.test/signed" language="en" errorMessage="x" />);
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
