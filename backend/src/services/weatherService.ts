import axios from 'axios';

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export async function getWeather(lat: number, lon: number) {
  if (!WEATHER_API_KEY) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
    const response = await axios.get(url);
    return {
      temp: response.data.main.temp,
      description: response.data.weather[0].description,
      city: response.data.name
    };
  } catch (error) {
    console.error('Failed to fetch weather', error);
    return null;
  }
}
