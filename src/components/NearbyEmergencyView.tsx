import React, { useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Ambulance,
  ExternalLink,
  Flame,
  Hospital,
  Loader2,
  LocateFixed,
  Navigation,
  Phone,
  Pill,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Coordinates, KeralaDistrictName, NearbyFacilityCategory, NearbyServiceItem } from '../types';
import { buildKeralaDemoNearbyServices, KERALA_DISTRICTS } from '../data/keralaData';
import { calculateHaversineMeters, formatDistance } from '../utils/geo';
import { MapCircleItem, MapMarkerItem, TourSafeMap } from './TourSafeMap';

interface NearbyEmergencyViewProps {
  currentCoords: Coordinates | null;
  hasMapsApiKey: boolean;
  geofences: MapCircleItem[];
  onRequestStartTracking?: () => void;
}

type FilterOption = 'all' | NearbyFacilityCategory;

const CATEGORY_LABELS: Record<NearbyFacilityCategory, string> = {
  police: 'Police Station',
  gov_hospital: 'Government Hospital',
  priv_hospital: 'Private Hospital',
  ambulance: 'Ambulance Service',
  pharmacy: 'Pharmacy',
  fire_rescue: 'Fire & Rescue Station',
};

function classifyPlaceCategory(
  name: string,
  primaryType: string,
  requestedFilter: FilterOption
): NearbyFacilityCategory {
  const lowerName = name.toLowerCase();
  const pType = primaryType.toLowerCase();

  if (pType.includes('police') || lowerName.includes('police')) return 'police';
  if (pType.includes('fire') || lowerName.includes('fire')) return 'fire_rescue';
  if (pType.includes('pharmacy') || pType.includes('drugstore') || lowerName.includes('pharmac') || lowerName.includes('medicals')) {
    return 'pharmacy';
  }
  if (lowerName.includes('ambulance') || lowerName.includes('108')) return 'ambulance';

  if (pType.includes('hospital') || pType.includes('doctor') || lowerName.includes('hospital') || lowerName.includes('medical')) {
    if (
      lowerName.includes('govt') ||
      lowerName.includes('government') ||
      lowerName.includes('general hospital') ||
      lowerName.includes('taluk') ||
      lowerName.includes('district hospital') ||
      lowerName.includes('medical college') ||
      lowerName.includes('phc') ||
      lowerName.includes('chc')
    ) {
      return 'gov_hospital';
    }
    if (requestedFilter === 'ambulance') return 'ambulance';
    if (requestedFilter === 'gov_hospital') return 'gov_hospital';
    return 'priv_hospital';
  }

  return requestedFilter === 'all' ? 'priv_hospital' : requestedFilter;
}

function PlacesNearbyFetcher({
  center,
  categoryFilter,
  onResults,
  onError,
  setLoading,
}: {
  center: { lat: number; lng: number };
  categoryFilter: FilterOption;
  onResults: (items: NearbyServiceItem[]) => void;
  onError: (msg: string | null) => void;
  setLoading: (val: boolean) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchPlaces() {
      if (!placesLib || !placesLib.Place?.searchNearby) {
        return;
      }

      setLoading(true);
      onError(null);

      const typeMap: Record<FilterOption, string[]> = {
        all: ['police', 'hospital', 'pharmacy', 'fire_station'],
        police: ['police'],
        gov_hospital: ['hospital'],
        priv_hospital: ['hospital'],
        ambulance: ['hospital'],
        pharmacy: ['pharmacy'],
        fire_rescue: ['fire_station'],
      };

      try {
        const { places } = await placesLib.Place.searchNearby({
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'nationalPhoneNumber',
            'rating',
            'googleMapsURI',
            'primaryType',
          ],
          locationRestriction: {
            center,
            radius: 8000,
          },
          includedPrimaryTypes: typeMap[categoryFilter],
          maxResultCount: 18,
        });

        if (cancelled) return;

        const mapped: NearbyServiceItem[] = (places ?? []).map(
          (p: google.maps.places.Place, idx: number) => {
            const lat = p.location?.lat() ?? center.lat;
            const lng = p.location?.lng() ?? center.lng;
            const displayName = p.displayName || 'Kerala Emergency Facility';
            const cat = classifyPlaceCategory(displayName, p.primaryType ?? '', categoryFilter);

            return {
              id: p.id || `kl_place_${idx}`,
              name: displayName,
              category: cat,
              address: p.formattedAddress || 'Address available in Google Maps',
              phone: p.nationalPhoneNumber || undefined,
              latitude: lat,
              longitude: lng,
              distanceMeters: calculateHaversineMeters(center.lat, center.lng, lat, lng),
              rating: p.rating ?? undefined,
              googleMapsUri: p.googleMapsURI || undefined,
              isDemo: false,
            };
          }
        );

        mapped.sort((a, b) => a.distanceMeters - b.distanceMeters);
        onResults(mapped);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load live nearby places. Please check your network or API configuration.';
        onError(message);
        onResults(buildKeralaDemoNearbyServices(center.lat, center.lng));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlaces();
    return () => {
      cancelled = true;
    };
  }, [placesLib, center.lat, center.lng, categoryFilter, refreshTick]);

  return (
    <button
      type="button"
      onClick={() => setRefreshTick((t) => t + 1)}
      className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      Refresh Live Search
    </button>
  );
}

export const NearbyEmergencyView: React.FC<NearbyEmergencyViewProps> = ({
  currentCoords,
  hasMapsApiKey,
  geofences,
  onRequestStartTracking,
}) => {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [fallbackDistrict, setFallbackDistrict] = useState<KeralaDistrictName>('Ernakulam');

  const selectedDistrictMeta =
    KERALA_DISTRICTS.find((d) => d.name === fallbackDistrict) ?? KERALA_DISTRICTS[6];

  const searchCenter = currentCoords
    ? { lat: currentCoords.latitude, lng: currentCoords.longitude }
    : { lat: selectedDistrictMeta.latitude, lng: selectedDistrictMeta.longitude };

  const [items, setItems] = useState<NearbyServiceItem[]>(() =>
    buildKeralaDemoNearbyServices(searchCenter.lat, searchCenter.lng)
  );
  const [loading, setLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [routeTarget, setRouteTarget] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!hasMapsApiKey) {
      setItems(buildKeralaDemoNearbyServices(searchCenter.lat, searchCenter.lng));
    }
  }, [hasMapsApiKey, searchCenter.lat, searchCenter.lng]);

  const filteredItems = items.filter((item) => (filter === 'all' ? true : item.category === filter));
  const isShowingDemo = filteredItems.some((i) => i.isDemo);

  const mapMarkers: MapMarkerItem[] = [
    ...(currentCoords
      ? [
          {
            id: 'self_tourist',
            latitude: currentCoords.latitude,
            longitude: currentCoords.longitude,
            title: 'Your Live GPS Position',
            subtitle: `Accuracy ±${currentCoords.accuracy}m`,
            kind: 'tourist' as const,
          },
        ]
      : []),
    ...filteredItems.map((srv) => ({
      id: srv.id,
      latitude: srv.latitude,
      longitude: srv.longitude,
      title: srv.name,
      subtitle: `${CATEGORY_LABELS[srv.category]} · ${formatDistance(srv.distanceMeters)}`,
      kind: 'emergency' as const,
    })),
  ];

  const categoryIcon = (cat: NearbyFacilityCategory) => {
    if (cat === 'police') return <ShieldAlert className="w-4 h-4 text-slate-900 shrink-0" />;
    if (cat === 'gov_hospital') return <Hospital className="w-4 h-4 text-emerald-700 shrink-0" />;
    if (cat === 'priv_hospital') return <Hospital className="w-4 h-4 text-red-600 shrink-0" />;
    if (cat === 'ambulance') return <Ambulance className="w-4 h-4 text-red-600 shrink-0" />;
    if (cat === 'pharmacy') return <Pill className="w-4 h-4 text-sky-700 shrink-0" />;
    return <Flame className="w-4 h-4 text-orange-600 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Nearby Kerala Emergency & Medical Services
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Find police stations, government & private hospitals, 108 ambulance points, pharmacies, and fire & rescue units within 8 km.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!currentCoords && (
            <select
              aria-label="Reference Kerala district for nearby search"
              value={fallbackDistrict}
              onChange={(e) => setFallbackDistrict(e.target.value as KeralaDistrictName)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800"
            >
              {KERALA_DISTRICTS.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} District HQ
                </option>
              ))}
            </select>
          )}
          {hasMapsApiKey && (
            <PlacesNearbyFetcher
              center={searchCenter}
              categoryFilter={filter}
              onResults={setItems}
              onError={setApiNotice}
              setLoading={setLoading}
            />
          )}
        </div>
      </div>

      {!currentCoords && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <span>
            Live GPS tracking is currently off. Showing emergency services near{' '}
            <strong>{selectedDistrictMeta.name} District HQ</strong>. Start GPS tracking to find
            services around your exact coordinates.
          </span>
          {onRequestStartTracking && (
            <button
              type="button"
              onClick={onRequestStartTracking}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              Start GPS Tracking
            </button>
          )}
        </div>
      )}

      {/* Verified India & Kerala Direct Helpline Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-800">
          Verified Kerala Emergency Helplines (24x7 Direct Dial):
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="tel:112"
            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 inline-flex items-center gap-1.5 font-mono-tabular whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" />
            112 National Emergency
          </a>
          <a
            href="tel:100"
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1.5 font-mono-tabular whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5 text-slate-700" />
            100 Police
          </a>
          <a
            href="tel:108"
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1.5 font-mono-tabular whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-700" />
            108 Ambulance
          </a>
          <a
            href="tel:101"
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1.5 font-mono-tabular whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5 text-orange-600" />
            101 Fire & Rescue
          </a>
        </div>
      </div>

      {/* All 6 Module 13 Facility Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'all', label: 'All Services' },
              { id: 'police', label: 'Police Stations' },
              { id: 'gov_hospital', label: 'Govt Hospitals' },
              { id: 'priv_hospital', label: 'Private Hospitals' },
              { id: 'ambulance', label: 'Ambulance' },
              { id: 'pharmacy', label: 'Pharmacies' },
              { id: 'fire_rescue', label: 'Fire & Rescue' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-emerald-950 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-600">
          {isShowingDemo ? (
            <span className="text-amber-700 font-medium">
              Source: Sample Reference Markers {apiNotice ? `(${apiNotice})` : ''}
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">
              Source: Google Maps Places API (New) Live Data
            </span>
          )}
        </div>
      </div>

      <TourSafeMap
        center={searchCenter}
        zoom={14}
        markers={mapMarkers}
        circles={geofences}
        routeOrigin={
          currentCoords ? { lat: currentCoords.latitude, lng: currentCoords.longitude } : null
        }
        routeDestination={currentCoords ? routeTarget : null}
        hasMapsApiKey={hasMapsApiKey}
        hasLiveGps={Boolean(currentCoords)}
        heightClass="h-[380px]"
      />

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Searching nearby emergency facilities...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No matching facilities returned for this specific filter within 8 km.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Switch to "All Services" or dial 112 / 108 immediately for urgent assistance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((srv) => {
            const directionsHref =
              srv.googleMapsUri ||
              (currentCoords
                ? `https://www.google.com/maps/dir/?api=1&origin=${currentCoords.latitude},${currentCoords.longitude}&destination=${srv.latitude},${srv.longitude}&utm_campaign=gmp_mcp_codeassist_v1_aistudio`
                : `https://www.google.com/maps/dir/?api=1&destination=${srv.latitude},${srv.longitude}&utm_campaign=gmp_mcp_codeassist_v1_aistudio`);

            return (
              <div
                key={srv.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {categoryIcon(srv.category)}
                      <h3 className="text-sm font-semibold text-slate-900">{srv.name}</h3>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-600 shrink-0">
                      {formatDistance(srv.distanceMeters)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{srv.address}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                    <span>{CATEGORY_LABELS[srv.category]}</span>
                    {srv.rating && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">Rating {srv.rating.toFixed(1)}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{srv.isDemo ? 'Sample Reference' : 'Verified Places Data'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {currentCoords ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRouteTarget({
                          lat: srv.latitude,
                          lng: srv.longitude,
                          label: srv.name,
                        });
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-900 text-white rounded-lg hover:bg-emerald-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Plot Route
                    </button>
                  ) : onRequestStartTracking ? (
                    <button
                      type="button"
                      onClick={onRequestStartTracking}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      Start GPS for Route
                    </button>
                  ) : null}

                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Google Maps
                    <ExternalLink className="w-3 h-3 opacity-75" />
                  </a>

                  {srv.phone && (
                    <a
                      href={`tel:${srv.phone}`}
                      className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap font-mono-tabular"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-700" />
                      Call {srv.phone}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
