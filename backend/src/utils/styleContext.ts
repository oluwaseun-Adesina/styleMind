export type StyleContext = {
  timeOfDay: string;
  season: string;
};

const NORTHERN_SEASONS = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
];
const SOUTHERN_SEASONS = [
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
];

export const AUTO_STYLE_PROMPT =
  'Pick the best outfit for me to wear right now, based on the current time of day, season, and weather.';

export const getTimeOfDay = (hour: number): string => {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

export const getSeason = (month: number, lat?: number): string => {
  const seasons = typeof lat === 'number' && lat < 0 ? SOUTHERN_SEASONS : NORTHERN_SEASONS;
  return seasons[month];
};

export const buildStyleContext = (
  localHour: number | undefined,
  localDate: string | undefined,
  lat: number | undefined
): StyleContext => {
  const now = new Date();
  // localDate is the client's calendar date; only the month matters for the season
  const month = localDate ? Number(localDate.slice(5, 7)) - 1 : now.getMonth();
  const hour = typeof localHour === 'number' ? localHour : now.getHours();

  return {
    timeOfDay: getTimeOfDay(hour),
    season: getSeason(month, lat),
  };
};
