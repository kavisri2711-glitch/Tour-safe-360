import { AppLanguage, NavSection } from '../types';

export function formatIstDateTime(msOrIso: number | string | Date): string {
  const date = typeof msOrIso === 'object' ? msOrIso : new Date(msOrIso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })} IST`;
}

export function formatIstTime(msOrIso: number | string | Date): string {
  const date = typeof msOrIso === 'object' ? msOrIso : new Date(msOrIso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })} IST`;
}

export function formatIstDate(msOrIso: number | string | Date): string {
  const date = typeof msOrIso === 'object' ? msOrIso : new Date(msOrIso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface UiTranslations {
  appSubtitle: string;
  welcomePrefix: string;
  emergencySos: string;
  startTracking: string;
  stopTracking: string;
  locateNow: string;
  viewDigitalId: string;
  touristIdLabel: string;
  currentCoords: string;
  trackingStatus: string;
  geofenceStatus: string;
  wirelessSharing: string;
  activeLabel: string;
  inactiveLabel: string;
  insideSafeZone: string;
  outsideSafeZone: string;
  noActiveZones: string;
  signInRegister: string;
  signOut: string;
  keralaEmergencyHeader: string;
  nonGovIdDisclaimer: string;
  nav: Record<NavSection, string>;
}

export const UI_STRINGS: Record<AppLanguage, UiTranslations> = {
  en: {
    appSubtitle: 'Kerala Smart Tourism Safety, Identification, Tracking & AI System',
    welcomePrefix: 'Namaskaram,',
    emergencySos: 'Emergency SOS',
    startTracking: 'Start GPS Tracking',
    stopTracking: 'Stop Live Tracking',
    locateNow: 'Locate Me Now',
    viewDigitalId: 'Digital Tourist ID',
    touristIdLabel: 'Kerala Tourist ID',
    currentCoords: 'Current Coordinates',
    trackingStatus: 'GPS Tracking',
    geofenceStatus: 'Geofence Boundary',
    wirelessSharing: 'Live Internet Sharing',
    activeLabel: 'Active',
    inactiveLabel: 'Inactive',
    insideSafeZone: 'Inside Safe Zone',
    outsideSafeZone: 'Outside Safe Boundary',
    noActiveZones: 'No Active Zones',
    signInRegister: 'Register / Sign In',
    signOut: 'Sign Out',
    keralaEmergencyHeader: 'Kerala Emergency Helplines: 112 (Emergency) · 100 (Police) · 101 (Fire) · 108 (Ambulance)',
    nonGovIdDisclaimer:
      'Notice: This is a TourSafe 360 application-issued identification card and NOT a government-issued identity document.',
    nav: {
      dashboard: 'Dashboard',
      'tourist-id': 'Tourist ID Card',
      'gps-tracking': 'GPS Tracking',
      'live-sharing': 'Live Location Sharing',
      geofencing: 'Geofencing',
      'ai-recommendations': 'AI Recommendations',
      'kerala-destinations': 'Kerala Destinations',
      'nearby-emergency': 'Nearby Emergency Services',
      'emergency-sos': 'Emergency SOS',
      'weather-alerts': 'Weather and Safety Alerts',
      'location-history': 'Location History',
      notifications: 'Notifications',
      profile: 'Profile',
      'admin-panel': 'Admin Panel',
    },
  },
  ml: {
    appSubtitle: 'കേരള സ്മാർട്ട് ടൂറിസം സുരക്ഷാ, തിരിച്ചറിയൽ & ട്രാക്കിംഗ് സംവിധാനം',
    welcomePrefix: 'നമസ്കാരം,',
    emergencySos: 'അടിയന്തര SOS',
    startTracking: 'GPS ട്രാക്കിംഗ് തുടങ്ങുക',
    stopTracking: 'ട്രാക്കിംഗ് നിർത്തുക',
    locateNow: 'എന്റെ സ്ഥാനം കണ്ടെത്തുക',
    viewDigitalId: 'ഡിജിറ്റൽ ടൂറിസ്റ്റ് ID',
    touristIdLabel: 'കേരള ടൂറിസ്റ്റ് ID',
    currentCoords: 'നിലവിലെ സ്ഥാനം',
    trackingStatus: 'GPS ട്രാക്കിംഗ് നില',
    geofenceStatus: 'ജിയോഫെൻസ് സുരക്ഷാ നില',
    wirelessSharing: 'തത്സമയ ലൊക്കേഷൻ ഷെയറിംഗ്',
    activeLabel: 'സജീവം',
    inactiveLabel: 'നിർജ്ജീവം',
    insideSafeZone: 'സുരക്ഷിത മേഖലയ്ക്കുള്ളിൽ',
    outsideSafeZone: 'സുരക്ഷാ പരിധിക്ക് പുറത്ത്',
    noActiveZones: 'സജീവ മേഖലകളില്ല',
    signInRegister: 'രജിസ്റ്റർ / ലോഗിൻ',
    signOut: 'സൈൻ ഔട്ട്',
    keralaEmergencyHeader: 'കേരള അടിയന്തര സഹായ നമ്പറുകൾ: 112 (എമർജൻസി) · 100 (പോലീസ്) · 101 (ഫയർ) · 108 (ആംബുലൻസ്)',
    nonGovIdDisclaimer:
      'ശ്രദ്ധിക്കുക: ഇത് TourSafe 360 ആപ്ലിക്കേഷൻ നൽകുന്ന തിരിച്ചറിയൽ കാർഡാണ്; സർക്കാർ അംഗീകൃത തിരിച്ചറിയൽ രേഖയല്ല.',
    nav: {
      dashboard: 'ഡാഷ്ബോർഡ്',
      'tourist-id': 'ടൂറിസ്റ്റ് ID കാർഡ്',
      'gps-tracking': 'GPS ട്രാക്കിംഗ്',
      'live-sharing': 'തത്സമയ ലൊക്കേഷൻ ഷെയറിംഗ്',
      geofencing: 'ജിയോഫെൻസിംഗ്',
      'ai-recommendations': 'AI ശുപാർശകൾ',
      'kerala-destinations': 'കേരള വിനോദസഞ്ചാര കേന്ദ്രങ്ങൾ',
      'nearby-emergency': 'സമീപത്തുള്ള അടിയന്തര സേവനങ്ങൾ',
      'emergency-sos': 'അടിയന്തര SOS',
      'weather-alerts': 'കാലാവസ്ഥാ സുരക്ഷാ മുന്നറിയിപ്പുകൾ',
      'location-history': 'യാത്രാ ചരിത്രം',
      notifications: 'അറിയിപ്പുകൾ',
      profile: 'പ്രൊഫൈൽ',
      'admin-panel': 'അഡ്മിൻ പാനൽ',
    },
  },
  hi: {
    appSubtitle: 'केरल स्मार्ट पर्यटन सुरक्षा, पर्यटक पहचान एवं ट्रैकिंग प्रणाली',
    welcomePrefix: 'नमस्कार,',
    emergencySos: 'आपातकालीन SOS',
    startTracking: 'GPS ट्रैकिंग शुरू करें',
    stopTracking: 'ट्रैकिंग रोकें',
    locateNow: 'मेरी वर्तमान लोकेशन',
    viewDigitalId: 'डिजिटल पर्यटक ID',
    touristIdLabel: 'केरल पर्यटक ID',
    currentCoords: 'वर्तमान निर्देशांक',
    trackingStatus: 'GPS ट्रैकिंग स्थिति',
    geofenceStatus: 'जियोफेंस सुरक्षा क्षेत्र',
    wirelessSharing: 'लाइव लोकेशन शेयरिंग',
    activeLabel: 'सक्रिय',
    inactiveLabel: 'निष्क्रिय',
    insideSafeZone: 'सुरक्षित क्षेत्र के भीतर',
    outsideSafeZone: 'सुरक्षित सीमा से बाहर',
    noActiveZones: 'कोई सक्रिय क्षेत्र नहीं',
    signInRegister: 'पंजीकरण / लॉगिन',
    signOut: 'साइन आउट',
    keralaEmergencyHeader: 'केरल आपातकालीन हेल्पलाइन: 112 (आपातकाल) · 100 (पुलिस) · 101 (अग्निशमन) · 108 (एम्बुलेंस)',
    nonGovIdDisclaimer:
      'सूचना: यह TourSafe 360 एप्लिकेशन द्वारा जारी पहचान पत्र है, यह सरकारी पहचान दस्तावेज़ नहीं है।',
    nav: {
      dashboard: 'डैशबोर्ड',
      'tourist-id': 'पर्यटक ID कार्ड',
      'gps-tracking': 'GPS ट्रैकिंग',
      'live-sharing': 'लाइव लोकेशन शेयरिंग',
      geofencing: 'जियोफेंसिंग',
      'ai-recommendations': 'AI यात्रा सुझाव',
      'kerala-destinations': 'केरल पर्यटन स्थल',
      'nearby-emergency': 'नज़दीकी आपातकालीन सेवाएँ',
      'emergency-sos': 'आपातकालीन SOS',
      'weather-alerts': 'मौसम व सुरक्षा अलर्ट',
      'location-history': 'लोकेशन इतिहास',
      notifications: 'सूचनाएँ',
      profile: 'प्रोफ़ाइल',
      'admin-panel': 'एडमिन पैनल',
    },
  },
};
