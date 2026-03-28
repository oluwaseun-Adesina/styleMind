import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This ensures it finds the .env file regardless of where you run the command from
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app';
import { connectDB } from './config/db';

const PORT = Number(process.env.PORT || 8787);

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`StyleMind backend modularized and listening on http://localhost:${PORT}`);
  });
};

startServer();
