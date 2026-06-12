import { logger } from '../utils/logger.js';

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export async function getWeather(lat: number, lon: number) {
  if (!WEATHER_API_KEY) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      temp: data.main.temp,
      description: data.weather[0].description,
      city: data.name
    };
  } catch (error) {
    logger.warn('Failed to fetch weather', error as Error);
    return null;
  }
}
