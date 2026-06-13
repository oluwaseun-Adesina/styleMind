import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { Wardrobe } from '../models/Wardrobe.js';
import { SavedOutfit } from '../models/SavedOutfit.js';
import { Event } from '../models/Event.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { isAllowedAudience } from '../utils/audience.js';
import { logger } from '../utils/logger.js';
import { sendPasswordResetEmail } from './emailService.js';
import type {
  SignupInput,
  LoginInput,
  GoogleAuthInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
  DeleteAccountInput,
} from '../utils/schemas.js';

const JWT_SECRET = env.JWT_SECRET;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

// Every client ID whose tokens we trust. verifyIdToken accepts an array; the
// access-token path checks membership explicitly.
const ALLOWED_AUDIENCES = [GOOGLE_CLIENT_ID, ...env.GOOGLE_ALLOWED_AUDIENCES];

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export type AuthResult = {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
};

const generateToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const buildAuthResult = (user: {
  _id: { toString(): string };
  email: string;
  name?: string | null;
  picture?: string | null;
}): AuthResult => {
  const userId = user._id.toString();
  return {
    token: generateToken(userId, user.email),
    refreshToken: generateRefreshToken(userId, user.email),
    user: {
      id: userId,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      picture: user.picture || undefined,
    },
  };
};

/**
 * Exchange a valid refresh token for a fresh access + refresh token pair.
 */
export const refreshSession = async (refreshToken: string): Promise<AuthResult> => {
  let decoded: { userId: string; email: string; type?: string };
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET) as typeof decoded;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new AppError('User not found', 401);
  }

  return buildAuthResult(user);
};

type GooglePayload = {
  aud?: string;       // ID tokens
  audience?: string;  // access tokens (tokeninfo endpoint)
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  picture?: string;
};

// tokeninfo response for an OAuth access token. `aud`/`azp` bind the token to a
// specific OAuth client; we must verify this before trusting the token.
type GoogleTokenInfo = {
  aud?: string;
  azp?: string;
  email?: string;
  email_verified?: boolean | string;
  expires_in?: string;
};

const fetchGoogleJson = async <T>(url: string, token?: string): Promise<T> => {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new AppError('Invalid Google token', 401);
  }

  return response.json() as Promise<T>;
};

/**
 * Authenticate with Google OAuth
 */
export const googleAuth = async (input: GoogleAuthInput): Promise<AuthResult> => {
  const { token } = input;

  let payload: GooglePayload | undefined;

  // JWT ID tokens have exactly 3 dot-separated parts (header.payload.signature)
  if (token.split('.').length === 3) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload() as GooglePayload | undefined;
    } catch {
      throw new AppError('Invalid Google token', 401);
    }
  } else {
    // OAuth access token. The userinfo endpoint returns a profile for ANY valid
    // access token regardless of which OAuth client minted it, so we must first
    // verify the token's audience via tokeninfo before trusting it. Skipping
    // this allows a token issued to a different app to be replayed here for
    // account takeover (OAuth confused-deputy / token substitution).
    let tokenInfo: GoogleTokenInfo;
    try {
      tokenInfo = await fetchGoogleJson<GoogleTokenInfo>(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
      );
    } catch {
      throw new AppError('Invalid Google token', 401);
    }

    const audience = tokenInfo.aud || tokenInfo.azp;
    if (!isAllowedAudience(audience, ALLOWED_AUDIENCES)) {
      throw new AppError('Google token was not issued for this application', 401);
    }

    // Audience verified — safe to enrich the profile (name/picture) from userinfo.
    let profile: GooglePayload = {};
    try {
      profile = await fetchGoogleJson<GooglePayload>('https://www.googleapis.com/oauth2/v3/userinfo', token);
    } catch {
      // Non-fatal: fall back to tokeninfo fields if userinfo is unavailable.
    }

    payload = {
      email: profile.email || tokenInfo.email,
      email_verified: profile.email_verified ?? tokenInfo.email_verified,
      name: profile.name,
      given_name: profile.given_name,
      picture: profile.picture,
    };
  }

  if (!payload?.email) {
    throw new AppError('Invalid Google data', 400);
  }

  if (payload.email_verified === false || payload.email_verified === 'false') {
    throw new AppError('Google email is not verified', 401);
  }

  // Find or create user
  let user = await User.findOne({ email: payload.email });

  if (!user) {
    user = new User({
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      picture: payload.picture,
    });
    await user.save();
  }

  return buildAuthResult(user);
};

/**
 * Register new user
 */
export const signup = async (input: SignupInput): Promise<AuthResult> => {
  const { email, password, name } = input;

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = new User({
    email,
    password: hashedPassword,
    name: name || email.split('@')[0],
  });

  try {
    await user.save();
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError('User already exists', 409);
    }
    throw err;
  }

  return buildAuthResult(user);
};

/**
 * Login existing user
 */
export const login = async (input: LoginInput): Promise<AuthResult> => {
  const { email, password } = input;

  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !user.password) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  return buildAuthResult(user);
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;

/**
 * Start a password reset: email the user a short-lived 6-digit code.
 * Always resolves successfully so the endpoint can't be used to probe
 * which emails have accounts.
 */
export const forgotPassword = async (input: ForgotPasswordInput): Promise<void> => {
  const user = await User.findOne({ email: input.email });
  if (!user) return;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  user.set({
    resetCodeHash: await bcrypt.hash(code, SALT_ROUNDS),
    resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    resetCodeAttempts: 0,
  });
  await user.save();

  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (err) {
    // Don't leak account existence through error responses; just log.
    logger.error('[Auth] Failed to send password reset email', err as Error);
  }
};

/**
 * Complete a password reset: verify the emailed code and set the new password.
 * Logs the user in on success.
 */
export const resetPassword = async (input: ResetPasswordInput): Promise<AuthResult> => {
  const { email, code, newPassword } = input;

  const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiresAt +resetCodeAttempts');
  const invalid = new AppError('Invalid or expired reset code', 401);

  if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt || user.resetCodeExpiresAt.getTime() < Date.now()) {
    throw invalid;
  }

  if ((user.resetCodeAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) {
    throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
  }

  const isMatch = await bcrypt.compare(code, user.resetCodeHash);
  if (!isMatch) {
    user.resetCodeAttempts = (user.resetCodeAttempts ?? 0) + 1;
    await user.save();
    throw invalid;
  }

  user.set({
    password: await bcrypt.hash(newPassword, SALT_ROUNDS),
    resetCodeHash: undefined,
    resetCodeExpiresAt: undefined,
    resetCodeAttempts: 0,
  });
  await user.save();

  return buildAuthResult(user);
};

/**
 * Change (or, for Google-only accounts, set) the password of a logged-in user.
 */
export const changePassword = async (userId: string, input: ChangePasswordInput): Promise<void> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.password) {
    if (!input.currentPassword) {
      throw new AppError('Current password is required', 400);
    }
    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401);
    }
  }

  user.password = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await user.save();
};

/**
 * Current user's profile. `hasPassword` tells the client whether to ask for a
 * current password (email accounts) or offer to set one (Google-only accounts).
 */
export const getMe = async (userId: string) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    picture: user.picture || undefined,
    hasPassword: Boolean(user.password),
  };
};

/**
 * Update profile fields the user is allowed to change.
 */
export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const user = await User.findByIdAndUpdate(userId, { name: input.name }, { new: true, runValidators: true });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    picture: user.picture || undefined,
  };
};

/**
 * Permanently delete the account and all user data (wardrobe, saved outfits,
 * events). Accounts with a password must re-verify it; Google-only accounts
 * confirm with the typed phrase alone (validated by the schema).
 * Required for Play Store account-deletion compliance.
 */
export const deleteAccount = async (userId: string, input: DeleteAccountInput): Promise<{ email: string }> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.password) {
    if (!input.password) {
      throw new AppError('Password is required to delete this account', 400);
    }
    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new AppError('Password is incorrect', 401);
    }
  }

  const email = user.email;
  // Remove the user's data first so a failure can't leave an orphaned login.
  await Promise.all([
    Wardrobe.deleteMany({ uid: user._id }),
    SavedOutfit.deleteMany({ uid: user._id }),
    Event.deleteMany({ uid: user._id }),
  ]);
  await user.deleteOne();

  return { email };
};
