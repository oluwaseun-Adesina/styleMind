import { Response } from 'express';
import { generateOutfitSuggestion, analyzeItemImage } from '../services/geminiService';
import { getWeather } from '../services/weatherService';

export const getSuggestion = async (req: any, res: Response) => {
  const { prompt, wardrobe, lat, lon, lockedItemId } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required.' });
    return;
  }

  try {
    let weatherInfo = null;
    if (typeof lat === 'number' && typeof lon === 'number') {
      weatherInfo = await getWeather(lat, lon);
    }

    const payload = await generateOutfitSuggestion(prompt, wardrobe, weatherInfo, lockedItemId);
    res.json(payload);
  } catch (error) {
    console.error('Failed to generate outfit suggestion', error);
    res.status(500).json({ error: 'Failed to generate outfit suggestion.' });
  }
};

export const analyzeItem = async (req: any, res: Response) => {
  const { imageBase64, mimeType, hint } = req.body;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: 'Image data and mime type are required.' });
    return;
  }

  try {
    const payload = await analyzeItemImage(imageBase64, mimeType, hint);
    res.json(payload);
  } catch (error) {
    console.error('Failed to analyze item image', error);
    res.status(500).json({ error: 'Failed to analyze item image.' });
  }
};
