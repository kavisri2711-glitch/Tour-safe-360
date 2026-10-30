export type NavSection =
  | 'dashboard'
  | 'tourist-id'
  | 'gps-tracking'
  | 'live-sharing'
  | 'geofencing'
  | 'ai-recommendations'
  | 'kerala-destinations'
  | 'nearby-emergency'
  | 'emergency-sos'
  | 'weather-alerts'
  | 'location-history'
  | 'notifications'
  | 'profile'
  | 'admin-panel';

export type AppLanguage = 'en' | 'ml' | 'hi';

export type KeralaDistrictName =
  | 'Thiruvananthapuram'
  | 'Kollam'
  | 'Pathanamthitta'
  | 'Alappuzha'
  | 'Kottayam'
  | 'Idukki'
  | 'Ernakulam'
  | 'Thrissur'
  | 'Palakkad'
  | 'Malappuram'
  | 'Kozhikode'
  | 'Wayanad'
  | 'Kannur'
  | 'Kasaragod';

export type KeralaDestinationCategory =
  | 'Hill stations'
  | 'Beaches'
  | 'Backwaters'
  | 'Wildlife sanctuaries'
  | 'Historical attractions'
  | 'Religious tourism'
  | 'Adventure tourism'
  | 'Eco-tourism';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: 'gps' | 'demo';
}

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  touristId?: string;
  verificationToken?: string;
  nationality?: string;
  photoUrl?: string;
  registeredDateIso?: string;
  accountStatus?: 'active' | 'suspended';
  trackingConsent: boolean;
  sharingConsent: boolean;
  trackingIntervalSec: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  dob?: string;
  stateRegion?: string;
  country?: string;
  personalInfoConsent?: boolean;
  travelStyle: string;
  budgetTier: string;
  updatedAt?: unknown;
}

export interface TouristVerificationRecord {
  token: string;
  touristId: string;
  uid: string;
  displayName: string;
  nationality: string;
  photoUrl: string;
  registeredDateIso: string;
  emailVerified: boolean;
  status: 'active' | 'suspended';
}

export interface EmergencyContact {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  notifyOnSos: boolean;
  notifyOnGeofence: boolean;
  createdAt?: unknown;
}

export interface GeofenceZone {
  id: string;
  ownerId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  notifyContacts: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LocationLogEntry {
  id: string;
  ownerId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  source: 'gps' | 'demo';
  createdAtMs: number;
}

export type NotificationCategory =
  | 'geofence_entry'
  | 'geofence_exit'
  | 'emergency_sos'
  | 'location_sharing'
  | 'tracking_started'
  | 'tracking_stopped'
  | 'connection_lost'
  | 'weather_alert'
  | 'recommendation'
  | 'system';

export interface NotificationRecord {
  id: string;
  ownerId: string;
  type: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  createdAtMs: number;
}

export interface TrackingSessionRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  tripName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  isActive: boolean;
  source: 'gps' | 'demo';
  authorizedEmails: string[];
  expiresAtMs: number;
  updatedAtMs: number;
}

export type EmergencyAlertType =
  | 'sos_emergency'
  | 'geofence_exit'
  | 'unexpected_location'
  | 'lost_communication'
  | 'low_battery';

export interface EmergencyEventRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  touristId?: string;
  alertType: EmergencyAlertType;
  latitude: number;
  longitude: number;
  accuracy: number;
  notes: string;
  deliveryStatus: 'recorded_in_cloud' | 'shared_session_updated';
  status: 'active' | 'acknowledged' | 'resolved';
  authorizedEmails: string[];
  createdAtMs: number;
}

export interface DestinationGuideRecord {
  id: string;
  name: string;
  region: string;
  district?: KeralaDistrictName | string;
  category: KeralaDestinationCategory | string;
  latitude: number;
  longitude: number;
  safetyNotes: string;
  emergencyNumber: string;
  createdBy: string;
  isDemo?: boolean;
  imageUrl?: string;
  description?: string;
  bestSeason?: string;
  typicalBudgetInr?: number;
  visitingHours?: string;
  defaultGeofenceRadiusM?: number;
}

export interface SafetyAlertRecord {
  id: string;
  title: string;
  district: string;
  severity: 'advisory' | 'watch' | 'warning';
  category: string;
  sourceAuthority: string;
  issuedAtIso: string;
  validUntilIso: string;
  description: string;
  createdBy: string;
  isReferenceSample?: boolean;
}

export interface SafetyReportRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  category: string;
  description: string;
  status: 'open' | 'investigating' | 'closed';
  createdAtMs: number;
}

export interface AIRecommendationResponse {
  summaryTitle: string;
  destinationOverview: string;
  disclaimer: string;
  budgetBreakdownInr?: {
    accommodationInr: string;
    localTransportInr: string;
    foodAndDiningInr: string;
    activitiesAndEntryInr: string;
    totalEstimatedInr: string;
  };
  recommendedPlaces: {
    name: string;
    category: string;
    suitability: string;
    estimatedCost: string;
    bestTimeToVisit: string;
    description: string;
  }[];
  safetySuggestions: {
    topic: string;
    precaution: string;
    recommendedWindow: string;
  }[];
  smartJourneyChecklist: string[];
  smartJourneyStops?: {
    stopName: string;
    purpose: string;
    safetyNote: string;
  }[];
  itineraryPlan: {
    dayLabel: string;
    morning: string;
    afternoon: string;
    evening: string;
    safetyCheckpoint: string;
  }[];
}

export type NearbyFacilityCategory =
  | 'police'
  | 'gov_hospital'
  | 'priv_hospital'
  | 'ambulance'
  | 'pharmacy'
  | 'fire_rescue';

export interface NearbyServiceItem {
  id: string;
  name: string;
  category: NearbyFacilityCategory;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  rating?: number;
  googleMapsUri?: string;
  isDemo: boolean;
}

export interface WeatherTelemetryData {
  latitude: number;
  longitude: number;
  observedAtIst: string;
  temperatureC: number;
  apparentTempC: number;
  humidityPct: number;
  precipitationMm: number;
  windSpeedKmh: number;
  conditionLabel: string;
  weatherCode: number;
  forecastDays: {
    date: string;
    maxTempC: number;
    minTempC: number;
    rainSumMm: number;
    maxWindKmh: number;
    conditionLabel: string;
  }[];
}
