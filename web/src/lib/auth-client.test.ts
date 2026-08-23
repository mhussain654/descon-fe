import { describe, expect, it } from 'vitest';
import { selectCandidateAuthClient } from './auth-client';

describe('selectCandidateAuthClient', () => {
  it('selects the mock client in development, which accepts the documented mock OTP', async () => {
    const client = selectCandidateAuthClient(true);
    const challenge = await client.requestOtp('1234512345671');
    await expect(client.verifyOtp(challenge.challengeId, '123456')).resolves.toMatchObject({
      accessToken: expect.any(String),
    });
  });

  it('never selects the mock client outside development -- every call fails safely instead', async () => {
    const client = selectCandidateAuthClient(false);
    await expect(client.requestOtp('1234512345671')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
    await expect(client.resendOtp('any')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
    await expect(client.verifyOtp('any', '123456')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('rejects the production client even with the mock-only OTP value', async () => {
    const client = selectCandidateAuthClient(false);
    await expect(client.verifyOtp('any-challenge', '123456')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
  });
});
