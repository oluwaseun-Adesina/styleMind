import { describe, it, expect } from 'vitest';
import { isAllowedAudience } from '../audience.js';

const WEB = 'web-client-id.apps.googleusercontent.com';
const ANDROID = 'android-client-id.apps.googleusercontent.com';
const ALLOWED = [WEB, ANDROID];

describe('isAllowedAudience', () => {
  it('accepts a token audience that matches one of our client IDs', () => {
    expect(isAllowedAudience(WEB, ALLOWED)).toBe(true);
    expect(isAllowedAudience(ANDROID, ALLOWED)).toBe(true);
  });

  it('rejects a token minted for a different OAuth app (confused deputy)', () => {
    expect(isAllowedAudience('attacker-app.apps.googleusercontent.com', ALLOWED)).toBe(false);
  });

  it('rejects missing / empty audiences', () => {
    expect(isAllowedAudience(undefined, ALLOWED)).toBe(false);
    expect(isAllowedAudience('', ALLOWED)).toBe(false);
  });

  it('rejects everything when no audiences are configured', () => {
    expect(isAllowedAudience(WEB, [])).toBe(false);
  });
});
