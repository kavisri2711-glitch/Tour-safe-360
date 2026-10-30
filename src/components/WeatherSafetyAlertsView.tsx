import React, { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  AlertTriangle,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Wind,
} from 'lucide-react';
import { db } from '../firebase';
import {
  Coordinates,
  KeralaDistrictName,
  SafetyAlertRecord,
  WeatherTelemetryData,
} from '../types';
import {
  KERALA_DISTRICTS,
  STANDING_KERALA_SAFETY_GUIDELINES,
} from '../data/keralaData';
import { formatCoord } from '../utils/geo';

interface WeatherSafetyAlertsViewProps {
  currentCoords: Coordinates | null;
  initialDistrict?: KeralaDistrictName | null;
  onRequestStartTracking?: () => void;
}

export const WeatherSafetyAlertsView: React.FC<WeatherSafetyAlertsViewProps> = ({
  currentCoords,
  initialDistrict,
  onRequestStartTracking,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'GPS' | KeralaDistrictName>(
    initialDistrict || 'Ernakulam'
  );
  const [weather, setWeather] = useState<WeatherTelemetryData | null>(null);
  const [weatherSource, setWeatherSource] = useState<string>('');
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [publishedAlerts, setPublishedAlerts] = useState<SafetyAlertRecord[]>([]);

  useEffect(() => {
    if (initialDistrict) {
      setSelectedTarget(initialDistrict);
    }
  }, [initialDistrict]);

  // Listen to administrator-published safety advisories in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'safetyAlerts'),
      (snap) => {
        const list: SafetyAlertRecord[] = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            title: raw.title,
            district: raw.district,
            severity: raw.severity,
            category: raw.category,
            sourceAuthority: raw.sourceAuthority,
            issuedAtIso: raw.issuedAtIso,
            validUntilIso: raw.validUntilIso,
            description: raw.description,
            createdBy: raw.createdBy,
            isReferenceSample: false,
          };
        });
        setPublishedAlerts(list);
      },
      () => {
        // Fallback silently to standing guidelines if offline
      }
    );
    return () => unsub();
  }, []);

  const targetCoords = (() => {
    if (selectedTarget === 'GPS') {
      if (!currentCoords) return null;
      return {
        lat: currentCoords.latitude,
        lng: currentCoords.longitude,
        label: 'Your Live GPS Coordinates',
      };
    }
    const dist = KERALA_DISTRICTS.find((d) => d.name === selectedTarget) || KERALA_DISTRICTS[6];
    return {
      lat: dist.latitude,
      lng: dist.longitude,
      label: `${dist.name} District (${dist.malayalamName}) · HQ ${dist.headquarters}`,
    };
  })();

  const fetchLiveWeather = useCallback(async () => {
    if (!targetCoords) {
      setWeather(null);
      setWeatherError(null);
      return;
    }
    setLoadingWeather(true);
    setWeatherError(null);
    try {
      const res = await fetch(
        `/api/weather?lat=${encodeURIComponent(targetCoords.lat)}&lng=${encodeURIComponent(
          targetCoords.lng
        )}`
      );
      const json = await res.json();
      if (!res.ok) {
        setWeatherError(json.error || 'Real-time meteorological feed temporarily unavailable.');
        setWeather(null);
        return;
      }
      setWeather(json.data as WeatherTelemetryData);
      setWeatherSource(json.source || 'Live Meteorological Telemetry (IST)');
    } catch (err: unknown) {
      setWeatherError(
        err instanceof Error
          ? err.message
          : 'Network error retrieving real-time Kerala weather observations.'
      );
      setWeather(null);
    } finally {
      setLoadingWeather(false);
    }
  }, [targetCoords?.lat, targetCoords?.lng]);

  useEffect(() => {
    fetchLiveWeather();
  }, [fetchLiveWeather]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Kerala Live Weather Telemetry & Safety Advisories
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time district meteorological observations in IST paired with official KSDMA & IMD verification portals.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLiveWeather}
          disabled={loadingWeather || !targetCoords}
          className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingWeather ? 'animate-spin' : ''}`} />
          Refresh Telemetry
        </button>
      </div>

      {/* Honest Data Provenance & Official KSDMA / IMD Verification Links */}
      <div className="bg-emerald-950 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-semibold text-amber-300">
            Official Disaster & Monsoon Alert Verification
          </p>
          <p className="text-xs text-emerald-100 leading-relaxed">
            TourSafe 360 never fabricates unverified disaster, flood, or landslide warnings. Live temperature, rainfall, and wind readings below come from real-time meteorological telemetry. Always cross-check Red/Orange/Yellow district alerts directly with official Kerala & Government of India agencies:
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="https://sdma.kerala.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-semibold bg-white text-emerald-950 rounded-lg hover:bg-emerald-50 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            KSDMA Official Portal
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://mausam.imd.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-800 text-white border border-emerald-700 rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            IMD Weather Bulletins
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* District / GPS Location Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-semibold text-slate-800">
            Inspect Live Weather For:
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value as 'GPS' | KeralaDistrictName)}
              className="ml-2.5 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-900"
            >
              <option value="GPS">My Live GPS Coordinates</option>
              {KERALA_DISTRICTS.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.malayalamName})
                </option>
              ))}
            </select>
          </label>

          {targetCoords && (
            <span className="text-xs font-mono-tabular text-slate-500">
              {targetCoords.label} · {formatCoord(targetCoords.lat, 4)}, {formatCoord(targetCoords.lng, 4)}
            </span>
          )}
        </div>

        {!targetCoords ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <span>
              Live GPS tracking is currently off. Click Start GPS Tracking to fetch weather for your exact GPS coordinates, or select one of Kerala's 14 districts above.
            </span>
            {onRequestStartTracking && (
              <button
                type="button"
                onClick={onRequestStartTracking}
                className="px-3.5 py-2 font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 whitespace-nowrap"
              >
                Start GPS Tracking
              </button>
            )}
          </div>
        ) : loadingWeather ? (
          <div className="py-10 flex items-center justify-center gap-2.5 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
            <span>Fetching real-time meteorological telemetry...</span>
          </div>
        ) : weatherError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950">
            {weatherError} Please consult IMD or KSDMA portals above for live regional updates.
          </div>
        ) : weather ? (
          <div className="space-y-5">
            {/* Current Observations */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Temperature</span>
                  <Thermometer className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                  {weather.temperatureC.toFixed(1)} °C
                </p>
                <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                  Feels like {weather.apparentTempC.toFixed(1)} °C
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Sky & Visibility</span>
                  <CloudSun className="w-4 h-4 text-emerald-700" />
                </div>
                <p className="text-base font-bold text-slate-900 mt-2">{weather.conditionLabel}</p>
                <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                  Observed {weather.observedAtIst}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Current Precipitation</span>
                  <CloudRain className="w-4 h-4 text-sky-600" />
                </div>
                <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                  {weather.precipitationMm.toFixed(1)} mm
                </p>
                <p className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1 font-mono-tabular">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  Humidity {weather.humidityPct}%
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Surface Wind</span>
                  <Wind className="w-4 h-4 text-slate-700" />
                </div>
                <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                  {weather.windSpeedKmh.toFixed(1)} km/h
                </p>
                <p className="text-xs text-slate-600 mt-1">10m anemometer reading</p>
              </div>
            </div>

            {/* 3-Day Forecast Table */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-900">3-Day District Forecast (IST)</span>
                <span className="text-slate-500">Source: {weatherSource}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {weather.forecastDays.map((fd) => (
                  <div
                    key={fd.date}
                    className="border border-slate-200 rounded-lg p-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold font-mono-tabular text-slate-900">{fd.date}</p>
                      <p className="text-slate-600">{fd.conditionLabel}</p>
                    </div>
                    <div className="text-right font-mono-tabular space-y-0.5">
                      <p className="font-semibold text-slate-900">
                        {fd.maxTempC.toFixed(0)}° / {fd.minTempC.toFixed(0)}°C
                      </p>
                      <p className="text-slate-500">
                        Rain {fd.rainSumMm.toFixed(1)} mm · Wind {fd.maxWindKmh.toFixed(0)} km/h
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Administrator-Published Safety Advisories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Administrator-Published Travel Advisories
            </h3>
            <span className="text-xs text-slate-500 font-mono-tabular">
              {publishedAlerts.length} active
            </span>
          </div>

          {publishedAlerts.length === 0 ? (
            <div className="py-6 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">
                No custom emergency advisories currently posted by platform administrators.
              </p>
              <p>
                TourSafe 360 displays empty state honestly rather than inventing synthetic alerts. Check KSDMA / IMD links above for state bulletins.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {publishedAlerts.map((al) => (
                <div key={al.id} className="py-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{al.title}</span>
                    <span
                      className={`font-semibold uppercase ${
                        al.severity === 'warning'
                          ? 'text-red-700'
                          : al.severity === 'watch'
                          ? 'text-orange-700'
                          : 'text-emerald-800'
                      }`}
                    >
                      {al.severity}
                    </span>
                  </div>
                  <p className="text-slate-500">
                    District: <strong className="text-slate-800">{al.district}</strong> · {al.category} · Source: {al.sourceAuthority}
                  </p>
                  <p className="text-slate-700 leading-relaxed">{al.description}</p>
                  <p className="text-[11px] font-mono-tabular text-slate-400">
                    Issued: {al.issuedAtIso} · Valid Until: {al.validUntilIso}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Standing Seasonal Kerala Travel Preparedness Guidelines */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Standing Kerala Terrain & Coastal Preparedness Reference
          </h3>
          <div className="divide-y divide-slate-200">
            {STANDING_KERALA_SAFETY_GUIDELINES.map((g) => (
              <div key={g.id} className="py-3.5 space-y-1 text-xs">
                <p className="font-semibold text-slate-900">{g.title}</p>
                <p className="text-slate-500">
                  {g.district} · {g.category} · {g.sourceAuthority}
                </p>
                <p className="text-slate-700 leading-relaxed pt-0.5">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
