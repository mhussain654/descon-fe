// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import {
  createMockCandidateAuthClient,
  MOCK_MAX_ATTEMPTS,
  MOCK_REQUEST_FAILURE_CNIC,
  MOCK_VALID_OTP,
} from './candidateAuthClient';

const CNIC = '1234512345671';

describe('createMockCandidateAuthClient', () => {
  it('requestOtp succeeds identically for any well-formed CNIC, never disclosing existence', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const challenge = await client.requestOtp(CNIC);
    expect(challenge.challengeId).toEqual(expect.any(String));
    expect(challenge.expiresInSeconds).toBeGreaterThan(0);
    expect(challenge.resendAfterSeconds).toBeGreaterThan(0);
  });

  it('requestOtp fails generically for the reserved failure CNIC, with the same shape a real transient failure would have', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    await expect(client.requestOtp(MOCK_REQUEST_FAILURE_CNIC)).rejects.toEqual({ code: 'OTP_REQUEST_FAILED' });
  });

  it('rejects with OFFLINE before doing anything else when the device is offline', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0, isOnline: () => false });
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'OFFLINE' });
  });

  it('verifyOtp succeeds with the documented mock code and returns a session', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const challenge = await client.requestOtp(CNIC);
    const session = await client.verifyOtp(challenge.challengeId, MOCK_VALID_OTP);
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.candidateId).toEqual(expect.any(String));
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyOtp rejects an incorrect code with OTP_INVALID', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const challenge = await client.requestOtp(CNIC);
    await expect(client.verifyOtp(challenge.challengeId, '000000')).rejects.toEqual({ code: 'OTP_INVALID' });
  });

  it('locks out after MOCK_MAX_ATTEMPTS incorrect codes', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const challenge = await client.requestOtp(CNIC);

    for (let attempt = 1; attempt < MOCK_MAX_ATTEMPTS; attempt += 1) {
      await expect(client.verifyOtp(challenge.challengeId, '000000')).rejects.toEqual({ code: 'OTP_INVALID' });
    }
    await expect(client.verifyOtp(challenge.challengeId, '000000')).rejects.toEqual({ code: 'OTP_MAX_ATTEMPTS' });
    // Even the correct code no longer works once locked out.
    await expect(client.verifyOtp(challenge.challengeId, MOCK_VALID_OTP)).rejects.toEqual({
      code: 'OTP_MAX_ATTEMPTS',
    });
  });

  it('verifyOtp rejects an expired challenge with OTP_EXPIRED', async () => {
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const client = createMockCandidateAuthClient({ delayMs: 0 });
      const challenge = await client.requestOtp(CNIC);
      now += (challenge.expiresInSeconds + 1) * 1000;
      await expect(client.verifyOtp(challenge.challengeId, MOCK_VALID_OTP)).rejects.toEqual({ code: 'OTP_EXPIRED' });
    } finally {
      Date.now = originalNow;
    }
  });

  it('verifyOtp rejects an unknown challenge id with CHALLENGE_NOT_FOUND', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    await expect(client.verifyOtp('does-not-exist', MOCK_VALID_OTP)).rejects.toEqual({
      code: 'CHALLENGE_NOT_FOUND',
    });
  });

  it('resendOtp enforces the cooldown and reports remaining seconds', async () => {
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const client = createMockCandidateAuthClient({ delayMs: 0 });
      const challenge = await client.requestOtp(CNIC);

      now += 5000; // still within the cooldown
      await expect(client.resendOtp(challenge.challengeId)).rejects.toEqual({
        code: 'RESEND_COOLDOWN',
        retryAfterSeconds: challenge.resendAfterSeconds - 5,
      });

      now += challenge.resendAfterSeconds * 1000; // cooldown elapsed
      const resent = await client.resendOtp(challenge.challengeId);
      expect(resent.challengeId).toBe(challenge.challengeId);
    } finally {
      Date.now = originalNow;
    }
  });

  it('resendOtp resets the attempt count, so a fresh code gets fresh attempts', async () => {
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const client = createMockCandidateAuthClient({ delayMs: 0 });
      const challenge = await client.requestOtp(CNIC);
      await expect(client.verifyOtp(challenge.challengeId, '000000')).rejects.toEqual({ code: 'OTP_INVALID' });

      now += challenge.resendAfterSeconds * 1000;
      await client.resendOtp(challenge.challengeId);

      // Should have MOCK_MAX_ATTEMPTS fresh attempts again, not just one left.
      for (let attempt = 1; attempt < MOCK_MAX_ATTEMPTS; attempt += 1) {
        await expect(client.verifyOtp(challenge.challengeId, '000000')).rejects.toEqual({ code: 'OTP_INVALID' });
      }
      const session = await client.verifyOtp(challenge.challengeId, '000000').catch((error) => error);
      expect(session).toEqual({ code: 'OTP_MAX_ATTEMPTS' });
    } finally {
      Date.now = originalNow;
    }
  });
});
