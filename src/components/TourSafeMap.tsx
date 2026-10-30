import React, { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  InfoWindow,
  Map,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Compass, Layers, LocateFixed, MapPin, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { calculateHaversineMeters, formatCoord, formatDistance } from '../utils/geo';
import { KERALA_DESTINATIONS } from '../data/keralaData';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  kind: 'tourist' | 'contact' | 'destination' | 'emergency' | 'geofence-center';
}

export interface MapCircleItem {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  label: string;
  status?: 'inside' | 'outside' | 'draft';
}

export interface TourSafeMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarkerItem[];
  circles?: MapCircleItem[];
  polylinePath?: { lat: number; lng: number }[];
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number; label: string } | null;
  showKeralaJumpSelector?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  heightClass?: string;
  hasMapsApiKey: boolean;
  lastUpdatedLabel?: string;
  sharingActive?: boolean;
  hasLiveGps?: boolean;
}

interface RouteSummaryState {
  distanceLabel: string;
  durationLabel: string;
  destinationLabel: string;
  isFallbackGeodesic: boolean;
}

/**
 * Smoothly pans/zooms the imperative Google Map instance when prop coordinates change,
 * without locking out user touch/mouse panning via controlled props.
 */
function CameraSyncController({
  center,
  zoom,
  recenterTrigger,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  recenterTrigger: number;
}) {
  const map = useMap();
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevZoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const centerChanged =
      !prevCenterRef.current ||
      Math.abs(prevCenterRef.current.lat - center.lat) > 0.000005 ||
      Math.abs(prevCenterRef.current.lng - center.lng) > 0.000005;
    const zoomChanged = prevZoomRef.current !== zoom;

    if (centerChanged) {
      map.panTo(center);
      prevCenterRef.current = center;
    }
    if (zoomChanged) {
      map.setZoom(zoom);
      prevZoomRef.current = zoom;
    }
  }, [map, center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!map || recenterTrigger === 0) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, recenterTrigger]);

  return null;
}

/**
 * Modern Routes API (`Route.computeRoutes`) overlay inside `<Map>`.
 * Uses `primaryRoute.createPolylines()` and falls back to a geodesic corridor line if Routes API is unavailable.
 */
function ModernRoutesOverlay({
  origin,
  destination,
  onRouteSummary,
}: {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number; label: string } | null;
  onRouteSummary: (summary: RouteSummaryState | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !origin || !destination) {
      onRouteSummary(null);
      return;
    }

    let cancelled = false;

    const applyGeodesicFallback = () => {
      if (cancelled || typeof google === 'undefined' || !google.maps?.Polyline) return;
      const straightMeters = calculateHaversineMeters(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng
      );
      const line = new google.maps.Polyline({
        map,
        path: [origin, { lat: destination.lat, lng: destination.lng }],
        geodesic: true,
        strokeColor: '#047857',
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      polylinesRef.current = [line];

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      map.fitBounds(bounds, 56);

      const estMins = Math.max(2, Math.round((straightMeters / 1000 / 35) * 60));
      onRouteSummary({
        distanceLabel: formatDistance(straightMeters),
        durationLabel: `~${estMins} min est.`,
        destinationLabel: destination.label,
        isFallbackGeodesic: true,
      });
    };

    const RouteClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes: (req: unknown) => Promise<{
            routes?: {
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: google.maps.LatLngBounds;
              createPolylines?: () => google.maps.Polyline[];
            }[];
          }>;
        };
      } | null
    )?.Route;

    if (!RouteClass?.computeRoutes) {
      applyGeodesicFallback();
      return () => {
        cancelled = true;
        polylinesRef.current.forEach((p) => p.setMap(null));
        polylinesRef.current = [];
      };
    }

    RouteClass.computeRoutes({
      origin,
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then((res) => {
        if (cancelled) return;
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) {
          applyGeodesicFallback();
          return;
        }

        const routeLines = primaryRoute.createPolylines ? primaryRoute.createPolylines() : [];
        routeLines.forEach((pl) => {
          pl.setOptions({
            map,
            strokeColor: '#047857',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
        });
        polylinesRef.current = routeLines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distM = primaryRoute.distanceMeters ?? 0;
        const durMin = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        onRouteSummary({
          distanceLabel: formatDistance(distM),
          durationLabel: `${durMin} min drive`,
          destinationLabel: destination.label,
          isFallbackGeodesic: false,
        });
      })
      .catch((err) => {
        console.warn('Routes API computeRoutes fallback notice:', err);
        applyGeodesicFallback();
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    destination?.label,
  ]);

  return null;
}

/**
 * Imperative Google Maps Circle & Polyline synchronizer inside `<Map>`.
 */
function GeometryOverlays({
  circles = [],
  polylinePath = [],
}: {
  circles?: MapCircleItem[];
  polylinePath?: { lat: number; lng: number }[];
}) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Circle) return;

    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = circles.map((item) => {
      let strokeColor = '#64748b';
      let fillColor = '#94a3b8';
      let fillOpacity = 0.08;

      if (item.status === 'draft') {
        strokeColor = '#0284c7';
        fillColor = '#0ea5e9';
        fillOpacity = 0.12;
      } else if (item.isActive) {
        if (item.status === 'inside') {
          strokeColor = '#059669';
          fillColor = '#10b981';
          fillOpacity = 0.2;
        } else {
          strokeColor = '#ea580c';
          fillColor = '#f97316';
          fillOpacity = 0.16;
        }
      }

      return new google.maps.Circle({
        map,
        center: { lat: item.latitude, lng: item.longitude },
        radius: item.radiusMeters,
        strokeColor,
        strokeOpacity: 0.9,
        strokeWeight: item.status === 'draft' ? 1.5 : 2,
        fillColor,
        fillOpacity,
        clickable: false,
      });
    });

    return () => {
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, circles]);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Polyline) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (polylinePath.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        map,
        path: polylinePath,
        geodesic: true,
        strokeColor: '#0f172a',
        strokeOpacity: 0.85,
        strokeWeight: 3,
      });
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, polylinePath]);

  return null;
}

function InteractiveAdvancedPin({ item }: { item: MapMarkerItem }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  const pinStyles: Record<
    MapMarkerItem['kind'],
    { bg: string; border: string; glyph: string }
  > = {
    tourist: { bg: '#16a34a', border: '#14532d', glyph: '#ffffff' },
    contact: { bg: '#0284c7', border: '#0c4a6e', glyph: '#ffffff' },
    destination: { bg: '#ea580c', border: '#7c2d12', glyph: '#ffffff' },
    emergency: { bg: '#dc2626', border: '#7f1d1d', glyph: '#ffffff' },
    'geofence-center': { bg: '#1e293b', border: '#0f172a', glyph: '#f97316' },
  };

  const colors = pinStyles[item.kind];

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.latitude, lng: item.longitude }}
        title={item.title}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Pin
          background={colors.bg}
          borderColor={colors.border}
          glyphColor={colors.glyph}
          scale={item.kind === 'tourist' ? 1.25 : 1.05}
        />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)} maxWidth={250}>
          <div className="p-1 text-slate-900">
            <p className="text-xs font-semibold">{item.title}</p>
            {item.subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{item.subtitle}</p>}
            <p className="text-[11px] font-mono-tabular text-slate-500 mt-1">
              {formatCoord(item.latitude, 6)}, {formatCoord(item.longitude, 6)}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

/**
 * Interactive SVG Vector Coordinate Canvas Fallback when Google Maps API key is unavailable or fails auth.
 */
function VectorRadarCanvas({
  center,
  markers = [],
  circles = [],
  polylinePath = [],
  routeOrigin,
  routeDestination,
  onMapClick,
  heightClass,
}: {
  center: { lat: number; lng: number };
  markers: MapMarkerItem[];
  circles: MapCircleItem[];
  polylinePath: { lat: number; lng: number }[];
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number; label: string } | null;
  onMapClick?: (lat: number, lng: number) => void;
  heightClass: string;
}) {
  const [scaleMeters, setScaleMeters] = useState(3500);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(10000, 111320 * Math.cos((center.lat * Math.PI) / 180));

  const project = (lat: number, lng: number) => {
    const dxMeters = (lng - center.lng) * metersPerDegLng;
    const dyMeters = (lat - center.lat) * metersPerDegLat;
    const x = 50 + (dxMeters / scaleMeters) * 45;
    const y = 50 - (dyMeters / scaleMeters) * 45;
    return { x, y };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    const dxMeters = ((relX - 50) / 45) * scaleMeters;
    const dyMeters = ((50 - relY) / 45) * scaleMeters;
    const clickedLat = center.lat + dyMeters / metersPerDegLat;
    const clickedLng = center.lng + dxMeters / metersPerDegLng;
    onMapClick(Number(clickedLat.toFixed(6)), Number(clickedLng.toFixed(6)));
  };

  const markerColor = (kind: MapMarkerItem['kind']) => {
    if (kind === 'tourist') return '#16a34a';
    if (kind === 'emergency') return '#dc2626';
    if (kind === 'destination') return '#ea580c';
    if (kind === 'contact') return '#0284c7';
    return '#0f172a';
  };

  const combinedPath =
    routeOrigin && routeDestination
      ? [routeOrigin, { lat: routeDestination.lat, lng: routeDestination.lng }]
      : polylinePath;

  return (
    <div
      className={`relative w-full ${heightClass} bg-emerald-950 rounded-xl overflow-hidden border border-emerald-900 select-none`}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        onClick={handleSvgClick}
        className={`w-full h-full ${onMapClick ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        <defs>
          <pattern id="gridPatternKl" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(167,243,208,0.12)" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#gridPatternKl)" />

        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(167,243,208,0.2)" strokeWidth="0.3" strokeDasharray="1.5,1.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(167,243,208,0.2)" strokeWidth="0.3" strokeDasharray="1.5,1.5" />

        {circles.map((c) => {
          const pos = project(c.latitude, c.longitude);
          const rSvg = (c.radiusMeters / scaleMeters) * 45;
          const isInside = c.status === 'inside';
          return (
            <g key={c.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={Math.max(1.5, rSvg)}
                fill={
                  !c.isActive
                    ? 'rgba(148,163,184,0.10)'
                    : isInside
                    ? 'rgba(16,185,129,0.22)'
                    : 'rgba(249,115,22,0.2)'
                }
                stroke={!c.isActive ? '#94a3b8' : isInside ? '#10b981' : '#f97316'}
                strokeWidth="0.55"
              />
            </g>
          );
        })}

        {combinedPath.length >= 2 && (
          <polyline
            fill="none"
            stroke="#34d399"
            strokeWidth="0.8"
            points={combinedPath
              .map((pt) => {
                const p = project(pt.lat, pt.lng);
                return `${p.x},${p.y}`;
              })
              .join(' ')}
          />
        )}

        {markers.map((m) => {
          const pos = project(m.latitude, m.longitude);
          if (pos.x < -5 || pos.x > 105 || pos.y < -5 || pos.y > 105) return null;
          return (
            <g key={m.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={m.kind === 'tourist' ? 2.2 : 1.6}
                fill={markerColor(m.kind)}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
              <text
                x={pos.x}
                y={pos.y - 2.8}
                textAnchor="middle"
                fill="#ecfdf5"
                fontSize="2.3"
                fontFamily="sans-serif"
              >
                {m.title.slice(0, 22)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute top-3 left-3 bg-slate-950/85 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 text-xs flex items-center gap-2">
        <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Coordinate Grid · Span ±{formatDistance(scaleMeters)}</span>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setScaleMeters((s) => Math.max(300, Math.round(s * 0.65)))}
          className="p-2 rounded-lg bg-slate-950/90 text-white border border-slate-700 hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setScaleMeters((s) => Math.min(250000, Math.round(s * 1.5)))}
          className="p-2 rounded-lg bg-slate-950/90 text-white border border-slate-700 hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function GoogleMapInner({
  center,
  zoom = 13,
  markers = [],
  circles = [],
  polylinePath = [],
  routeOrigin,
  routeDestination,
  showKeralaJumpSelector = false,
  onMapClick,
  heightClass = 'h-[420px]',
}: Omit<TourSafeMapProps, 'hasMapsApiKey'>) {
  const status = useApiLoadingStatus();
  const [targetCamera, setTargetCamera] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: center.lat,
    lng: center.lng,
    zoom,
  });
  const [recenterTick, setRecenterTick] = useState(0);
  const [routeSummary, setRouteSummary] = useState<RouteSummaryState | null>(null);

  useEffect(() => {
    setTargetCamera({ lat: center.lat, lng: center.lng, zoom });
  }, [center.lat, center.lng, zoom]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return (
      <VectorRadarCanvas
        center={center}
        markers={markers}
        circles={circles}
        polylinePath={polylinePath}
        routeOrigin={routeOrigin}
        routeDestination={routeDestination}
        onMapClick={onMapClick}
        heightClass={heightClass}
      />
    );
  }

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-200 bg-slate-100`}>
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        zoomControl={true}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        onClick={(ev) => {
          if (onMapClick && ev.detail.latLng) {
            onMapClick(
              Number(ev.detail.latLng.lat.toFixed(6)),
              Number(ev.detail.latLng.lng.toFixed(6))
            );
          }
        }}
        className="w-full h-full"
      >
        <CameraSyncController
          center={{ lat: targetCamera.lat, lng: targetCamera.lng }}
          zoom={targetCamera.zoom}
          recenterTrigger={recenterTick}
        />
        <GeometryOverlays circles={circles} polylinePath={polylinePath} />
        <ModernRoutesOverlay
          origin={routeOrigin}
          destination={routeDestination}
          onRouteSummary={setRouteSummary}
        />
        {markers.map((m) => (
          <InteractiveAdvancedPin key={m.id} item={m} />
        ))}
      </Map>

      {showKeralaJumpSelector && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur border border-slate-300 shadow-xs rounded-lg px-2.5 py-1.5 flex items-center gap-2 max-w-[calc(100%-24px)]">
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap hidden sm:inline">
            Jump to Kerala Spot:
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              const found = KERALA_DESTINATIONS.find((d) => d.id === e.target.value);
              if (found) {
                setTargetCamera({ lat: found.latitude, lng: found.longitude, zoom: 13 });
                setRecenterTick((n) => n + 1);
              }
            }}
            className="text-xs font-medium text-slate-900 bg-transparent focus:outline-none truncate"
          >
            <option value="">Select destination...</option>
            {KERALA_DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.district})
              </option>
            ))}
          </select>
        </div>
      )}

      {routeSummary && (
        <div className="absolute top-3 right-14 z-10 bg-emerald-950/95 text-white px-3.5 py-2 rounded-lg shadow-sm text-xs flex items-center gap-2 font-mono-tabular max-w-[calc(100%-72px)]">
          <Navigation className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="truncate">
            To {routeSummary.destinationLabel}: {routeSummary.distanceLabel} · {routeSummary.durationLabel}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setTargetCamera({ lat: center.lat, lng: center.lng, zoom });
          setRecenterTick((n) => n + 1);
        }}
        className="absolute bottom-4 left-4 bg-white text-slate-900 border border-slate-300 shadow-sm px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors whitespace-nowrap"
      >
        <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
        Re-center
      </button>
    </div>
  );
}

export const TourSafeMap: React.FC<TourSafeMapProps> = (props) => {
  const {
    center,
    markers = [],
    circles = [],
    polylinePath = [],
    routeOrigin,
    routeDestination,
    onMapClick,
    heightClass = 'h-[420px]',
    hasMapsApiKey,
    lastUpdatedLabel,
    sharingActive,
    hasLiveGps = false,
  } = props;

  return (
    <div className="space-y-2.5">
      {hasMapsApiKey ? (
        <GoogleMapInner {...props} heightClass={heightClass} />
      ) : (
        <VectorRadarCanvas
          center={center}
          markers={markers}
          circles={circles}
          polylinePath={polylinePath}
          routeOrigin={routeOrigin}
          routeDestination={routeDestination}
          onMapClick={onMapClick}
          heightClass={heightClass}
        />
      )}

      {/* Clean unboxed map metadata footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1">
        <div className="flex flex-wrap items-center gap-2 font-mono-tabular">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          {hasLiveGps ? (
            <>
              <span className="text-emerald-800 font-semibold">Live GPS:</span>
              <span>Lat {formatCoord(center.lat, 6)}</span>
              <span aria-hidden="true">·</span>
              <span>Lng {formatCoord(center.lng, 6)}</span>
            </>
          ) : (
            <span>
              Map View Center: {formatCoord(center.lat, 4)}, {formatCoord(center.lng, 4)} (GPS Not Active)
            </span>
          )}
          {lastUpdatedLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {lastUpdatedLabel}</span>
            </>
          )}
          {typeof sharingActive === 'boolean' && (
            <>
              <span aria-hidden="true">·</span>
              <span className={sharingActive ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                {sharingActive ? 'Live Sharing Active' : 'Sharing Off'}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Legend:
          </span>
          <span className="text-emerald-700 font-medium">Live GPS / Inside Zone</span>
          <span aria-hidden="true">·</span>
          <span className="text-sky-700 font-medium">Contacts</span>
          <span aria-hidden="true">·</span>
          <span className="text-orange-700 font-medium">Outside Zone / Attractions</span>
          <span aria-hidden="true">·</span>
          <span className="text-red-700 font-medium">Emergency</span>
        </div>
      </div>
    </div>
  );
};
