import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from '../../config/env.js';
import { escapeHtml, sendWelcomeEmail } from '../emailService.js';

const originalKey = env.RESEND_API_KEY;

afterEach(() => {
  env.RESEND_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;'
    );
  });

  it('leaves plain names untouched', () => {
    expect(escapeHtml('Oluwaseun')).toBe('Oluwaseun');
  });
});

describe('sendWelcomeEmail', () => {
  it('escapes the user-supplied name in the HTML body', async () => {
    env.RESEND_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendWelcomeEmail('a@example.com', '<a href="https://evil.example">Claim prize</a>');

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.html).not.toContain('<a href');
    expect(body.html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;Claim prize&lt;/a&gt;');
  });
});
