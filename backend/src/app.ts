import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import wardrobeRoutes from './routes/wardrobeRoutes';
import lookbookRoutes from './routes/lookbookRoutes';
import aiRoutes from './routes/aiRoutes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wardrobes', wardrobeRoutes);
app.use('/api/saved_outfits', lookbookRoutes);
app.use('/api', aiRoutes);

app.get('/health', (_, res) => res.json({ ok: true }));

export default app;
