import { communicationChannelLabel, communicationStatusLabel, communicationStatusTone } from './communicationLabels';

const t = (key: string) => `t:${key}`;

describe('communicationChannelLabel', () => {
  it('translates a known channel_code', () => {
    expect(communicationChannelLabel('ai_voice_call', t)).toBe('t:adminCommunicationChannelAiVoiceCall');
  });

  it('humanizes an unrecognized channel_code instead of crashing or showing a raw key', () => {
    expect(communicationChannelLabel('sms', t)).toBe('Sms');
  });
});

describe('communicationStatusLabel', () => {
  it('translates every known status_code', () => {
    expect(communicationStatusLabel('requested', t)).toBe('t:adminCommunicationStatusRequested');
    expect(communicationStatusLabel('completed', t)).toBe('t:adminCommunicationStatusCompleted');
    expect(communicationStatusLabel('failed', t)).toBe('t:adminCommunicationStatusFailed');
  });

  it('humanizes an unrecognized status_code', () => {
    expect(communicationStatusLabel('delivered', t)).toBe('Delivered');
  });
});

describe('communicationStatusTone', () => {
  it('maps completed to success and failed to danger', () => {
    expect(communicationStatusTone('completed')).toBe('success');
    expect(communicationStatusTone('failed')).toBe('danger');
  });

  it('falls back to neutral for an unrecognized status_code', () => {
    expect(communicationStatusTone('delivered')).toBe('neutral');
  });
});
