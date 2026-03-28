import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    let payload: any;

    if (token.includes('.')) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (e) {
        console.error('JWT verification failed');
      }
    }

    if (!payload) {
      try {
        const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        payload = response.data;
      } catch (e) {
        res.status(401).json({ error: 'Invalid Google token' });
        return;
      }
    }

    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Invalid Google data' });
      return;
    }

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
    res.json({ 
      token: sessionToken, 
      user: { id: user._id.toString(), email: user.email, name: user.name, picture: user.picture } 
    });
  } catch (error) {
    console.error('Google auth error', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0]
    });

    await user.save();

    const sessionToken = generateToken(user._id.toString(), user.email);
    res.json({
      token: sessionToken,
      user: { id: user._id.toString(), email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const sessionToken = generateToken(user._id.toString(), user.email);
    res.json({
      token: sessionToken,
      user: { id: user._id.toString(), email: user.email, name: user.name, picture: user.picture }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};
