import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { SignupInput, LoginInput, GoogleAuthInput } from '../utils/schemas.js';

const JWT_SECRET = env.JWT_SECRET;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '1h';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
};

const generateToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
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

  if (token.includes('.')) {
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
    try {
      const tokenInfo = await fetchGoogleJson<GooglePayload>(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
      );

      // Access tokens return "audience", ID tokens return "aud"
      const aud = tokenInfo.audience ?? tokenInfo.aud;
      if (aud !== GOOGLE_CLIENT_ID) {
        throw new AppError('Invalid Google token audience', 401);
      }

      payload = await fetchGoogleJson<GooglePayload>('https://www.googleapis.com/oauth2/v3/userinfo', token);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid Google token', 401);
    }
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

  const sessionToken = generateToken(user._id.toString(), user.email);
  
  return {
    token: sessionToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name || payload.email.split('@')[0],
      picture: user.picture || undefined,
    },
  };
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

  const sessionToken = generateToken(user._id.toString(), user.email);

  return {
    token: sessionToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name || email.split('@')[0],
    },
  };
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

  const sessionToken = generateToken(user._id.toString(), user.email);

  return {
    token: sessionToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name || '',
      picture: user.picture || undefined,
    },
  };
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
