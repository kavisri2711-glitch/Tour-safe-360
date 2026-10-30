import {
  AIRecommendationResponse,
  DestinationGuideRecord,
  EmergencyContact,
  GeofenceZone,
  LocationLogEntry,
  NearbyServiceItem,
} from '../types';

export const HERO_BANNER_IMAGE = '/src/assets/images/toursafe_hero_coastal_1793369337685.jpg';
export const DEST_FORT_IMAGE = '/src/assets/images/destination_heritage_fort_1793369339118.jpg';
export const DEST_BAY_IMAGE = '/src/assets/images/destination_botanical_bay_1793369339322.jpg';

// Default presentation coordinates (Chennai Marina / Fort St. George corridor — matches user's example 13.0827, 80.2707)
export const DEMO_DEFAULT_COORDS = {
  latitude: 13.0827,
  longitude: 80.2707,
  accuracy: 14,
};

export const DEMO_CONTACTS: EmergencyContact[] = [
  {
    id: 'demo_c1',
    ownerId: 'demo_user',
    name: 'Ananya Sundaram (Demo)',
    phone: '+91-98400-11223',
    email: 'ananya.demo@example.com',
    relationship: 'Family Contact',
    notifyOnSos: true,
    notifyOnGeofence: true,
  },
  {
    id: 'demo_c2',
    ownerId: 'demo_user',
    name: 'Rajesh Menon (Demo)',
    phone: '+91-98400-44556',
    email: 'rajesh.demo@example.com',
    relationship: 'Tour Coordinator',
    notifyOnSos: true,
    notifyOnGeofence: false,
  },
];

export const DEMO_GEOFENCES: GeofenceZone[] = [
  {
    id: 'demo_geo_1',
    ownerId: 'demo_user',
    name: 'Central Heritage Safe Corridor (Demo)',
    latitude: 13.0827,
    longitude: 80.2707,
    radiusMeters: 500,
    isActive: true,
    notifyContacts: true,
  },
  {
    id: 'demo_geo_2',
    ownerId: 'demo_user',
    name: 'Marina Promenade Zone (Demo)',
    latitude: 13.0500,
    longitude: 80.2824,
    radiusMeters: 850,
    isActive: true,
    notifyContacts: false,
  },
];

export const DEMO_DESTINATIONS: DestinationGuideRecord[] = [
  {
    id: 'dest_fort_st_george',
    name: 'Coastal Heritage Citadel & Lighthouse',
    region: 'Coromandel Waterfront',
    category: 'Heritage & Family',
    latitude: 13.0796,
    longitude: 80.2875,
    safetyNotes: 'Well-lit paved pedestrian promenade until 21:00. Keep hydrated during midday hours and stay on designated seawall walkways.',
    emergencyNumber: '112',
    createdBy: 'system_demo',
    isDemo: true,
    imageUrl: DEST_FORT_IMAGE,
  },
  {
    id: 'dest_botanical_bay',
    name: 'Botanical Bay Eco-Boardwalk',
    region: 'Estuary Sanctuary',
    category: 'Nature & Budget-Friendly',
    latitude: 13.0145,
    longitude: 80.2738,
    safetyNotes: 'Shaded family boardwalk with ranger kiosks every 400 meters. Entry closes at 17:30 before dusk.',
    emergencyNumber: '112',
    createdBy: 'system_demo',
    isDemo: true,
    imageUrl: DEST_BAY_IMAGE,
  },
];

export const DEMO_LOCATION_LOGS: LocationLogEntry[] = [
  {
    id: 'demo_log_1',
    ownerId: 'demo_user',
    tripId: 'demo_morning_walk',
    latitude: 13.0802,
    longitude: 80.2685,
    accuracy: 16,
    source: 'demo',
    createdAtMs: Date.now() - 45 * 60 * 1000,
  },
  {
    id: 'demo_log_2',
    ownerId: 'demo_user',
    tripId: 'demo_morning_walk',
    latitude: 13.0815,
    longitude: 80.2696,
    accuracy: 12,
    source: 'demo',
    createdAtMs: Date.now() - 30 * 60 * 1000,
  },
  {
    id: 'demo_log_3',
    ownerId: 'demo_user',
    tripId: 'demo_morning_walk',
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 11,
    source: 'demo',
    createdAtMs: Date.now() - 15 * 60 * 1000,
  },
];

export const DEMO_AI_RECOMMENDATION: AIRecommendationResponse = {
  summaryTitle: 'Sample Personalized Coastal Heritage & Safety Plan (Demo Fallback)',
  destinationOverview:
    'A balanced coastal and cultural itinerary designed around walkable waterfront boulevards, museums, and family-friendly parks with clear access to civic facilities.',
  disclaimer:
    'AI-Generated Suggestion Notice: These travel and safety points are general planning suggestions and do not represent verified real-time safety intelligence or official emergency advisories.',
  recommendedPlaces: [
    {
      name: 'Heritage Maritime Museum & Fort Precinct',
      category: 'Historical Landmark',
      suitability: 'Ideal for families and groups; accessible walkways and moderate ticket pricing.',
      estimatedCost: '$5 – $12 per person',
      bestTimeToVisit: '09:00 AM – 11:30 AM',
      description: 'Guided architectural courtyard with shaded galleries and staffed tourist assistance desk.',
    },
    {
      name: 'Sanctuary Eco-Boardwalk & Botanical Gardens',
      category: 'Nature & Leisure',
      suitability: 'Budget-friendly outdoor stop suitable for solo travelers and families.',
      estimatedCost: 'Free – $4 entry',
      bestTimeToVisit: '03:30 PM – 05:30 PM',
      description: 'Elevated timber walkway along calm estuary waters with clear signage and rest pavilions.',
    },
    {
      name: 'Waterfront Promenade Viewing Deck',
      category: 'Scenic Attraction',
      suitability: 'Popular sunset gathering spot with active lighting and public transit links.',
      estimatedCost: 'Free public access',
      bestTimeToVisit: '05:30 PM – 07:30 PM',
      description: 'Wide pedestrian deck overlooking the bay with nearby cafés and public rest areas.',
    },
  ],
  safetySuggestions: [
    {
      topic: 'Daylight & Promenade Transit',
      precaution: 'Prefer main illuminated boulevards after dusk and use verified app-based or official metered transit.',
      recommendedWindow: '07:00 AM – 09:00 PM',
    },
    {
      topic: 'Heat & Coastal Weather Preparedness',
      precaution: 'Carry 1L+ drinking water, sun protection, and observe coastal tide warning flags near beaches.',
      recommendedWindow: 'Avoid peak UV 12:30 PM – 03:00 PM',
    },
    {
      topic: 'Emergency Readiness & Battery Backup',
      precaution: 'Keep a charged power bank, enable TourSafe 360 geofence alerts, and save local emergency numbers offline.',
      recommendedWindow: 'Before departing hotel',
    },
  ],
  smartJourneyChecklist: [
    'Confirm GPS permission and set a 500m safe-zone geofence around your accommodation.',
    'Share a time-limited live tracking session ID with at least one trusted emergency contact.',
    'Carry physical copies of ID, travel insurance details, and hotel address card.',
    'Note the nearest 24/7 hospital and tourist police outpost on the Nearby Services tab.',
  ],
  itineraryPlan: [
    {
      dayLabel: 'Day 1 · Heritage & Waterfront Orientation',
      morning: 'Explore the Heritage Fort Precinct and museum galleries before midday heat.',
      afternoon: 'Relaxed lunch at a central civic plaza followed by indoor artisan gallery visit.',
      evening: 'Sunset stroll along the lit Coastal Promenade Deck; check in with trusted contacts.',
      safetyCheckpoint: 'Verify accommodation geofence active status before evening walk.',
    },
    {
      dayLabel: 'Day 2 · Botanical Bay & Cultural Markets',
      morning: 'Guided walk through the Botanical Bay Eco-Boardwalk and birdwatching pavilion.',
      afternoon: 'Browse regulated craft bazaar and enjoy regional cuisine.',
      evening: 'Early harbor view dinner and return via main transit corridor.',
      safetyCheckpoint: 'Keep phone battery above 35% and confirm live session expiry window.',
    },
  ],
};

export function buildDemoNearbyServices(lat: number, lng: number): NearbyServiceItem[] {
  return [
    {
      id: 'demo_hosp_1',
      name: 'Civic General Multi-Specialty Hospital (Demo Sample)',
      category: 'gov_hospital',
      address: 'Sample Reference Marker (+0.8 km NE of current position)',
      phone: '108',
      latitude: lat + 0.0055,
      longitude: lng + 0.0048,
      distanceMeters: 810,
      isDemo: true,
    },
    {
      id: 'demo_pol_1',
      name: 'Tourist Assistance & Metropolitan Police Station (Demo Sample)',
      category: 'police',
      address: 'Sample Reference Marker (+0.5 km NW of current position)',
      phone: '100',
      latitude: lat + 0.0032,
      longitude: lng - 0.0036,
      distanceMeters: 530,
      isDemo: true,
    },
    {
      id: 'demo_pharm_1',
      name: '24x7 Lifeline Medical Pharmacy (Demo Sample)',
      category: 'pharmacy',
      address: 'Sample Reference Marker (+0.4 km SE of current position)',
      phone: '112',
      latitude: lat - 0.0028,
      longitude: lng + 0.0029,
      distanceMeters: 440,
      isDemo: true,
    },
    {
      id: 'demo_emerg_1',
      name: 'District Disaster & Emergency Response Center (Demo Sample)',
      category: 'fire_rescue',
      address: 'Sample Reference Marker (+1.1 km SW of current position)',
      phone: '112',
      latitude: lat - 0.0072,
      longitude: lng - 0.0065,
      distanceMeters: 1080,
      isDemo: true,
    },
  ];
}
