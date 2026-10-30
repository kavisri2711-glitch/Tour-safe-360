import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mapWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Mist / Mountain Fog';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 65) return 'Rain Showers';
  if (code === 66 || code === 67) return 'Heavy Rain';
  if (code >= 80 && code <= 82) return 'Monsoon Rain Showers';
  if (code >= 95) return 'Thunderstorm Activity';
  return 'Variable Tropical Conditions';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  app.get('/api/health', (_req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      status: 'ok',
      region: 'Kerala, India (IST)',
      geminiConfigured: hasGemini,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Real-time Meteorological Observation & 3-Day Forecast for Kerala Districts (Asia/Kolkata IST)
   * Uses live Open-Meteo telemetry without fabricating fake government disaster warnings.
   */
  app.get('/api/weather', async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude parameters are required.' });
        return;
      }

      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat.toFixed(4));
      url.searchParams.set('longitude', lng.toFixed(4));
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m'
      );
      url.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max'
      );
      url.searchParams.set('timezone', 'Asia/Kolkata');
      url.searchParams.set('forecast_days', '3');

      const upstream = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: `Live meteorological provider returned HTTP ${upstream.status}.`,
        });
        return;
      }

      const raw = (await upstream.json()) as {
        current?: {
          time?: string;
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
        daily?: {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          wind_speed_10m_max?: number[];
        };
      };

      const currentCode = raw.current?.weather_code ?? 0;
      const dates = raw.daily?.time ?? [];
      const forecastDays = dates.map((d, idx) => {
        const dCode = raw.daily?.weather_code?.[idx] ?? 0;
        return {
          date: d,
          maxTempC: raw.daily?.temperature_2m_max?.[idx] ?? 0,
          minTempC: raw.daily?.temperature_2m_min?.[idx] ?? 0,
          rainSumMm: raw.daily?.precipitation_sum?.[idx] ?? 0,
          maxWindKmh: raw.daily?.wind_speed_10m_max?.[idx] ?? 0,
          conditionLabel: mapWmoWeatherCode(dCode),
        };
      });

      res.json({
        source: 'Open-Meteo Real-Time Meteorological Telemetry (Asia/Kolkata IST)',
        data: {
          latitude: lat,
          longitude: lng,
          observedAtIst: raw.current?.time ? `${raw.current.time.replace('T', ' ')} IST` : 'Live IST',
          temperatureC: raw.current?.temperature_2m ?? 0,
          apparentTempC: raw.current?.apparent_temperature ?? 0,
          humidityPct: raw.current?.relative_humidity_2m ?? 0,
          precipitationMm: raw.current?.precipitation ?? 0,
          windSpeedKmh: raw.current?.wind_speed_10m ?? 0,
          weatherCode: currentCode,
          conditionLabel: mapWmoWeatherCode(currentCode),
          forecastDays,
        },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Unable to retrieve live meteorological data.';
      res.status(502).json({ error: msg });
    }
  });

  app.post('/api/ai/recommendations', async (req, res) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in Settings > Secrets. Showing curated Kerala sample guidance instead.',
          code: 'GEMINI_UNCONFIGURED',
        });
        return;
      }

      const {
        mode = 'destinations',
        destinationQuery = 'Munnar, Kochi & Alleppey, Kerala',
        district = 'All Kerala',
        latitude,
        longitude,
        budgetInr = 25000,
        budget = 'moderate',
        numTourists = 2,
        travelType = 'family',
        durationDays = 3,
        interests = '',
        activities = '',
        accommodation = 'Heritage Homestay / Eco-Resort',
        language = 'en',
      } = req.body ?? {};

      const coordContext =
        typeof latitude === 'number' && typeof longitude === 'number'
          ? `Current Traveler Coordinates: Latitude ${latitude.toFixed(5)}, Longitude ${longitude.toFixed(5)}.`
          : 'Traveler coordinates in Kerala.';

      const langName =
        language === 'ml'
          ? 'Malayalam (മലയാളം)'
          : language === 'hi'
          ? 'Hindi (हिन्दी)'
          : 'English';

      const systemInstruction = `You are the TourSafe 360 Kerala Smart Tourism Safety & Travel Advisor.
Focus specifically on Kerala, India (14 districts, hill stations, beaches, backwaters, wildlife sanctuaries, heritage, pilgrimage, eco-tourism).
Use Indian Standard Time (IST), Indian Rupees (INR / ₹), kilometres (km), and metres (m).
Respond in ${langName} where natural while keeping JSON property keys strictly in English.
CRITICAL SAFETY DISCLOSURE RULES:
1. Frame all safety advice strictly as general AI travel preparedness suggestions, NOT verified real-time intelligence, police dispatch, or official IMD/KSDMA alerts.
2. Never invent fake active floods, landslides, or official government warnings. Remind travelers to verify live IMD (mausam.imd.gov.in) and KSDMA (sdma.kerala.gov.in) advisories.
3. Provide realistic INR (₹) cost estimates tailored to ${numTourists} traveler(s), ${durationDays} day(s), total budget ₹${budgetInr} (${budget}), ${travelType} style, and ${accommodation} preference.`;

      const prompt = `Request Mode: ${mode}
Target Kerala Destination / District: ${destinationQuery} (District Focus: ${district})
${coordContext}
Group & Budget: ${numTourists} tourist(s), ${travelType}, ${durationDays} days, Total Budget ₹${budgetInr} INR (${budget} tier).
Preferred Accommodation: ${accommodation}
Interests & Activities: ${interests || 'Backwaters, tea hills, cultural heritage'} | Activities: ${activities || 'Sightseeing, safe nature walks, local cuisine'}

Generate comprehensive Kerala travel, itinerary, INR budget breakdown, smart highway/medical stops, and safety preparedness guidance matching the JSON schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTitle: { type: Type.STRING },
              destinationOverview: { type: Type.STRING },
              disclaimer: { type: Type.STRING },
              budgetBreakdownInr: {
                type: Type.OBJECT,
                properties: {
                  accommodationInr: { type: Type.STRING },
                  localTransportInr: { type: Type.STRING },
                  foodAndDiningInr: { type: Type.STRING },
                  activitiesAndEntryInr: { type: Type.STRING },
                  totalEstimatedInr: { type: Type.STRING },
                },
              },
              recommendedPlaces: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    suitability: { type: Type.STRING },
                    estimatedCost: { type: Type.STRING },
                    bestTimeToVisit: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
              safetySuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    precaution: { type: Type.STRING },
                    recommendedWindow: { type: Type.STRING },
                  },
                },
              },
              smartJourneyChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              smartJourneyStops: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stopName: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                    safetyNote: { type: Type.STRING },
                  },
                },
              },
              itineraryPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayLabel: { type: Type.STRING },
                    morning: { type: Type.STRING },
                    afternoon: { type: Type.STRING },
                    evening: { type: Type.STRING },
                    safetyCheckpoint: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({
        source: 'gemini-3.8-flash',
        generatedAt: new Date().toISOString(),
        data: parsed,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate Kerala AI travel recommendations.';
      console.error('Gemini API Error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TourSafe 360 Kerala server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
