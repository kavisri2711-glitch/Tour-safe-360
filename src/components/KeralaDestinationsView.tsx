import React, { useMemo, useState } from 'react';
import {
  CloudSun,
  Compass,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShieldPlus,
} from 'lucide-react';
import {
  Coordinates,
  DestinationGuideRecord,
  KeralaDestinationCategory,
  KeralaDistrictName,
} from '../types';
import {
  KERALA_DESTINATION_CATEGORIES,
  KERALA_DISTRICTS,
  KeralaDistrictInfo,
} from '../data/keralaData';
import { calculateHaversineMeters, formatCoord, formatDistance } from '../utils/geo';
import { formatInr } from '../utils/i18n';
import { MapCircleItem, MapMarkerItem, TourSafeMap } from './TourSafeMap';

interface KeralaDestinationsViewProps {
  currentCoords: Coordinates | null;
  destinations: DestinationGuideRecord[];
  geofences: MapCircleItem[];
  hasMapsApiKey: boolean;
  onAddDestinationGeofence: (dest: DestinationGuideRecord) => void;
  onOpenDistrictWeather: (districtName: KeralaDistrictName) => void;
  onRequestStartTracking?: () => void;
}

export const KeralaDestinationsView: React.FC<KeralaDestinationsViewProps> = ({
  currentCoords,
  destinations,
  geofences,
  hasMapsApiKey,
  onAddDestinationGeofence,
  onOpenDistrictWeather,
  onRequestStartTracking,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<'ALL' | KeralaDistrictName>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | KeralaDestinationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: 10.1632,
    lng: 76.6413,
    zoom: 7,
  });
  const [routeTarget, setRouteTarget] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [routeNeedsGpsNotice, setRouteNeedsGpsNotice] = useState(false);
  const [geofenceAddedId, setGeofenceAddedId] = useState<string | null>(null);

  const activeDistrictObj: KeralaDistrictInfo | undefined = useMemo(
    () => KERALA_DISTRICTS.find((d) => d.name === selectedDistrict),
    [selectedDistrict]
  );

  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      const matchesDistrict =
        selectedDistrict === 'ALL' ||
        d.district?.toLowerCase() === selectedDistrict.toLowerCase() ||
        d.region.toLowerCase().includes(selectedDistrict.toLowerCase());
      const matchesCategory =
        selectedCategory === 'ALL' ||
        d.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q);
      return matchesDistrict && matchesCategory && matchesQuery;
    });
  }, [destinations, selectedDistrict, selectedCategory, searchQuery]);

  const mapMarkers: MapMarkerItem[] = useMemo(() => {
    const base: MapMarkerItem[] = filteredDestinations.map((d) => ({
      id: `kl_dest_${d.id}`,
      latitude: d.latitude,
      longitude: d.longitude,
      title: d.name,
      subtitle: `${d.district || d.region} · ${d.category}`,
      kind: 'destination' as const,
    }));
    if (currentCoords) {
      return [
        {
          id: 'self_tourist_kl',
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          title: 'Your Live GPS Position',
          subtitle: `Accuracy ±${currentCoords.accuracy}m`,
          kind: 'tourist' as const,
        },
        ...base,
      ];
    }
    return base;
  }, [currentCoords, filteredDestinations]);

  const handleSelectDistrict = (distName: 'ALL' | KeralaDistrictName) => {
    setSelectedDistrict(distName);
    if (distName === 'ALL') {
      setMapFocus({ lat: 10.1632, lng: 76.6413, zoom: 7 });
    } else {
      const found = KERALA_DISTRICTS.find((d) => d.name === distName);
      if (found) {
        setMapFocus({ lat: found.latitude, lng: found.longitude, zoom: 10 });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Kerala Tourism System · 14 Districts & Verified Destinations
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Explore hill stations, backwaters, beaches, wildlife sanctuaries, heritage forts, and pilgrimage centers with IST timings and INR budgets.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Munnar, Varkala, backwaters..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
      </div>

      {/* All 14 Kerala Districts Interactive Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Select a Kerala District (All 14 Districts)
          </h3>
          <span className="text-xs text-slate-500 font-mono-tabular">
            Showing {filteredDestinations.length} destination(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectDistrict('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedDistrict === 'ALL'
                ? 'bg-emerald-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Kerala (14)
          </button>
          {KERALA_DISTRICTS.map((dist, idx) => (
            <button
              key={dist.id}
              type="button"
              onClick={() => handleSelectDistrict(dist.name)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedDistrict === dist.name
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {idx + 1}. {dist.name}
            </button>
          ))}
        </div>

        {/* Selected District Overview Strip */}
        {activeDistrictObj && (
          <div className="pt-3 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <p className="text-sm font-bold text-emerald-950">
                {activeDistrictObj.name} ({activeDistrictObj.malayalamName}) · HQ: {activeDistrictObj.headquarters}
              </p>
              <p className="text-slate-600">
                {activeDistrictObj.terrain} · Key Attractions: {activeDistrictObj.highlights}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={`tel:${activeDistrictObj.districtControlPhone}`}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono-tabular font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                Control Room: {activeDistrictObj.districtControlPhone}
              </a>
              <button
                type="button"
                onClick={() => onOpenDistrictWeather(activeDistrictObj.name)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <CloudSun className="w-3.5 h-3.5" />
                District Live Weather
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Kerala Map with Route Visualization */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Interactive Kerala Destination & Route Map
            </h3>
            <p className="text-xs text-slate-500">
              Click "Route on Map" on any destination below to compute road distance, travel time, and route path from your current coordinates.
            </p>
          </div>
          {routeTarget && (
            <button
              type="button"
              onClick={() => setRouteTarget(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
            >
              Clear Active Route ({routeTarget.label})
            </button>
          )}
        </div>

        {routeNeedsGpsNotice && !currentCoords && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <span>
              Enable live GPS tracking to plot driving routes from your actual location.
            </span>
            {onRequestStartTracking && (
              <button
                type="button"
                onClick={() => {
                  setRouteNeedsGpsNotice(false);
                  onRequestStartTracking();
                }}
                className="px-3 py-1.5 font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 whitespace-nowrap"
              >
                Start GPS Tracking
              </button>
            )}
          </div>
        )}

        <TourSafeMap
          center={{ lat: mapFocus.lat, lng: mapFocus.lng }}
          zoom={mapFocus.zoom}
          markers={mapMarkers}
          circles={geofences}
          routeOrigin={
            currentCoords
              ? { lat: currentCoords.latitude, lng: currentCoords.longitude }
              : null
          }
          routeDestination={currentCoords ? routeTarget : null}
          hasMapsApiKey={hasMapsApiKey}
          hasLiveGps={Boolean(currentCoords)}
          heightClass="h-[420px]"
        />
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-xl">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          All Categories
        </button>
        {KERALA_DESTINATION_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Destinations Grid */}
      {filteredDestinations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            No Kerala destinations match your current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDistrict('ALL');
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDestinations.map((dest) => {
            const distFromUser = currentCoords
              ? calculateHaversineMeters(
                  currentCoords.latitude,
                  currentCoords.longitude,
                  dest.latitude,
                  dest.longitude
                )
              : null;
            const justAdded = geofenceAddedId === dest.id;

            return (
              <div
                key={dest.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 bg-emerald-950 relative overflow-hidden">
                    {dest.imageUrl ? (
                      <img
                        src={dest.imageUrl}
                        alt={`${dest.name} in Kerala`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-300">
                        <Compass className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-4 flex flex-col justify-end">
                      <h3 className="text-base font-bold text-white">{dest.name}</h3>
                      <p className="text-xs text-slate-200">
                        {dest.district || dest.region} · {dest.category}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    {/* Unboxed Metadata with Middot Separators */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-mono-tabular">
                      <span>
                        {distFromUser !== null
                          ? `${formatDistance(distFromUser)} from GPS`
                          : 'Start GPS for distance'}
                      </span>
                      {dest.typicalBudgetInr && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>~{formatInr(dest.typicalBudgetInr)}/day</span>
                        </>
                      )}
                      {dest.bestSeason && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{dest.bestSeason}</span>
                        </>
                      )}
                    </div>

                    {dest.description && (
                      <p className="text-xs text-slate-700 leading-relaxed">{dest.description}</p>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                      <p className="text-slate-800">
                        <span className="font-semibold text-emerald-900">Safety Note:</span>{' '}
                        {dest.safetyNotes}
                      </p>
                      {dest.visitingHours && (
                        <p className="text-slate-500">
                          Visiting Hours: <span className="font-mono-tabular">{dest.visitingHours}</span> · Helpline:{' '}
                          <span className="font-mono-tabular">{dest.emergencyNumber}</span>
                        </p>
                      )}
                      <p className="text-[11px] font-mono-tabular text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {formatCoord(dest.latitude, 4)}, {formatCoord(dest.longitude, 4)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMapFocus({ lat: dest.latitude, lng: dest.longitude, zoom: 12 });
                      if (!currentCoords) {
                        setRouteNeedsGpsNotice(true);
                      } else {
                        setRouteNeedsGpsNotice(false);
                        setRouteTarget({
                          lat: dest.latitude,
                          lng: dest.longitude,
                          label: dest.name,
                        });
                      }
                      window.scrollTo({ top: 220, behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-900 rounded-lg hover:bg-emerald-950 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    {currentCoords ? 'Route on Map' : 'View on Map'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddDestinationGeofence(dest);
                      setGeofenceAddedId(dest.id);
                      setTimeout(() => setGeofenceAddedId(null), 2500);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ShieldPlus className="w-3.5 h-3.5 text-orange-600" />
                    {justAdded ? 'Safe Zone Added' : 'Add Safe Geofence'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
