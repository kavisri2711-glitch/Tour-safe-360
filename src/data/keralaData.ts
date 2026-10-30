import {
  AIRecommendationResponse,
  DestinationGuideRecord,
  EmergencyContact,
  GeofenceZone,
  KeralaDestinationCategory,
  KeralaDistrictName,
  LocationLogEntry,
  NearbyServiceItem,
  SafetyAlertRecord,
} from '../types';

import heroBackwatersImg from '../assets/images/kerala_hero_backwaters_1793372038351.jpg';
import munnarHillsImg from '../assets/images/kerala_munnar_hills_1793372038701.jpg';
import varkalaCliffImg from '../assets/images/kerala_varkala_cliff_1793372040688.jpg';
import thekkadyWildlifeImg from '../assets/images/kerala_thekkady_wildlife_1793372040752.jpg';
import athirappillyFallsImg from '../assets/images/kerala_athirappilly_falls_1793372041775.jpg';
import heritageFortImg from '../assets/images/destination_heritage_fort_1793369339118.jpg';
import botanicalBayImg from '../assets/images/destination_botanical_bay_1793369339322.jpg';
import coastalSunsetImg from '../assets/images/toursafe_hero_coastal_1793369337685.jpg';

export const KERALA_HERO_IMAGE = heroBackwatersImg;

// Default reference coordinates in Fort Kochi, Ernakulam, Kerala
export const KERALA_DEFAULT_COORDS = {
  latitude: 9.9658,
  longitude: 76.2421,
  accuracy: 12,
  label: 'Fort Kochi Heritage Promenade, Ernakulam, Kerala (Demo Reference Coordinates)',
};

export interface KeralaDistrictInfo {
  id: string;
  name: KeralaDistrictName;
  malayalamName: string;
  headquarters: string;
  latitude: number;
  longitude: number;
  terrain: string;
  highlights: string;
  districtControlPhone: string;
}

export const KERALA_DISTRICTS: KeralaDistrictInfo[] = [
  {
    id: 'thiruvananthapuram',
    name: 'Thiruvananthapuram',
    malayalamName: 'തിരുവനന്തപുരം',
    headquarters: 'Thiruvananthapuram',
    latitude: 8.5241,
    longitude: 76.9366,
    terrain: 'Coastal Plains & Ponmudi Ghats',
    highlights: 'Kovalam, Ponmudi, Padmanabhaswamy Temple, Napier Museum',
    districtControlPhone: '0471-2730045',
  },
  {
    id: 'kollam',
    name: 'Kollam',
    malayalamName: 'കൊല്ലം',
    headquarters: 'Kollam',
    latitude: 8.8932,
    longitude: 76.6141,
    terrain: 'Ashtamudi Backwaters & Forest Hills',
    highlights: 'Ashtamudi Lake, Jatayu Earth Center, Thenmala Eco-Tourism, Varkala Border',
    districtControlPhone: '0474-2794002',
  },
  {
    id: 'pathanamthitta',
    name: 'Pathanamthitta',
    malayalamName: 'പത്തനംതിട്ട',
    headquarters: 'Pathanamthitta',
    latitude: 9.2648,
    longitude: 76.787,
    terrain: 'Western Ghats Forest & River Valleys',
    highlights: 'Sabarimala, Gavi Eco-Tourism, Konni Elephant Reserve',
    districtControlPhone: '0468-2322515',
  },
  {
    id: 'alappuzha',
    name: 'Alappuzha',
    malayalamName: 'ആലപ്പുഴ',
    headquarters: 'Alappuzha',
    latitude: 9.4981,
    longitude: 76.3388,
    terrain: 'Vembanad Backwaters & Arabian Sea Coast',
    highlights: 'Alleppey Backwaters, Marari Beach, Kuttanad Waterways',
    districtControlPhone: '0477-2238630',
  },
  {
    id: 'kottayam',
    name: 'Kottayam',
    malayalamName: 'കോട്ടയം',
    headquarters: 'Kottayam',
    latitude: 9.5916,
    longitude: 76.5222,
    terrain: 'Vembanad Lake Basin & Highland Foothills',
    highlights: 'Kumarakom Bird Sanctuary, Vagamon Meadows, Illickal Kallu',
    districtControlPhone: '0481-2562201',
  },
  {
    id: 'idukki',
    name: 'Idukki',
    malayalamName: 'ഇടുക്കി',
    headquarters: 'Painavu',
    latitude: 9.8494,
    longitude: 76.9809,
    terrain: 'High-Range Western Ghats & Tea Highlands',
    highlights: 'Munnar, Thekkady Periyar Sanctuary, Idukki Arch Dam, Vagamon',
    districtControlPhone: '04862-233111',
  },
  {
    id: 'ernakulam',
    name: 'Ernakulam',
    malayalamName: 'എറണാകുളം',
    headquarters: 'Kakkanad / Kochi',
    latitude: 9.9312,
    longitude: 76.2673,
    terrain: 'Harbor Islands, Urban Hub & River Plains',
    highlights: 'Fort Kochi, Marine Drive Kochi, Mattancherry, Cherai Beach',
    districtControlPhone: '0484-2423513',
  },
  {
    id: 'thrissur',
    name: 'Thrissur',
    malayalamName: 'തൃശ്ശൂർ',
    headquarters: 'Thrissur',
    latitude: 10.5276,
    longitude: 76.2144,
    terrain: 'Cultural Plains & Chalakudy Forest Waterfalls',
    highlights: 'Athirappilly Waterfalls, Guruvayur Temple, Vadakkunnathan',
    districtControlPhone: '0487-2362424',
  },
  {
    id: 'palakkad',
    name: 'Palakkad',
    malayalamName: 'പാലക്കാട്',
    headquarters: 'Palakkad',
    latitude: 10.7867,
    longitude: 76.6548,
    terrain: 'Palakkad Gap & Nilgiri Biosphere Rainforest',
    highlights: 'Silent Valley National Park, Nelliyampathy, Palakkad Fort',
    districtControlPhone: '0491-2505309',
  },
  {
    id: 'malappuram',
    name: 'Malappuram',
    malayalamName: 'മലപ്പുറം',
    headquarters: 'Malappuram',
    latitude: 11.051,
    longitude: 76.0711,
    terrain: 'Teak Forests, Chaliyar & Bharathapuzha Basins',
    highlights: 'Nilambur Teak Museum, Kodikuthimala, Kadalundi Bird Sanctuary',
    districtControlPhone: '0483-2736320',
  },
  {
    id: 'kozhikode',
    name: 'Kozhikode',
    malayalamName: 'കോഴിക്കോട്',
    headquarters: 'Kozhikode',
    latitude: 11.2588,
    longitude: 75.7804,
    terrain: 'Malabar Coastline & Wayanad Ghat Passes',
    highlights: 'Kozhikode Beach, Kappad Historic Shore, Beypore Uru Port',
    districtControlPhone: '0495-2371002',
  },
  {
    id: 'wayanad',
    name: 'Wayanad',
    malayalamName: 'വയനാട്',
    headquarters: 'Kalpetta',
    latitude: 11.6854,
    longitude: 76.132,
    terrain: 'Misty Western Ghats Plateau & Wildlife Corridors',
    highlights: 'Edakkal Caves, Banasura Sagar Dam, Muthanga Wildlife, Chembra',
    districtControlPhone: '04936-204151',
  },
  {
    id: 'kannur',
    name: 'Kannur',
    malayalamName: 'കണ്ണൂർ',
    headquarters: 'Kannur',
    latitude: 11.8745,
    longitude: 75.3704,
    terrain: 'North Malabar Coast & Heritage Forts',
    highlights: 'St. Angelo Fort, Muzhappilangad Drive-in Beach, Parassinikkadavu',
    districtControlPhone: '0497-2700645',
  },
  {
    id: 'kasaragod',
    name: 'Kasaragod',
    malayalamName: 'കാസർകോട്',
    headquarters: 'Kasaragod',
    latitude: 12.4996,
    longitude: 74.9869,
    terrain: 'Coastal Headlands, Forts & Valiyaparamba Backwaters',
    highlights: 'Bekal Fort, Ranipuram Hills, Chandragiri River',
    districtControlPhone: '04994-257700',
  },
];

export const KERALA_DESTINATION_CATEGORIES: KeralaDestinationCategory[] = [
  'Hill stations',
  'Beaches',
  'Backwaters',
  'Wildlife sanctuaries',
  'Historical attractions',
  'Religious tourism',
  'Adventure tourism',
  'Eco-tourism',
];

// All 18 Mandatory Kerala Destinations
export const KERALA_DESTINATIONS: DestinationGuideRecord[] = [
  {
    id: 'kl_munnar',
    name: 'Munnar',
    region: 'Munnar High Range, Idukki',
    district: 'Idukki',
    category: 'Hill stations',
    latitude: 10.0889,
    longitude: 77.0595,
    description:
      'Emerald tea estates at 1,600 m elevation, Eravikulam National Park (Nilgiri Tahr habitat), Mattupetty Dam, and Top Station viewpoints.',
    safetyNotes:
      'Expect dense evening mountain mist on NH-85 hairpin bends. Carry warm layers and avoid isolated forest roads after 18:30 IST.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: munnarHillsImg,
    bestSeason: 'September – March',
    typicalBudgetInr: 4200,
    visitingHours: '06:00 – 18:00 IST',
    defaultGeofenceRadiusM: 2500,
  },
  {
    id: 'kl_alleppey',
    name: 'Alleppey',
    region: 'Punnamada & Vembanad Lake, Alappuzha',
    district: 'Alappuzha',
    category: 'Backwaters',
    latitude: 9.4981,
    longitude: 76.3388,
    description:
      'Iconic Kettuvallam houseboat cruises across Vembanad canals, paddy fields below sea level in Kuttanad, and calm lagoon villages.',
    safetyNotes:
      'Board only DTPC/Kerala Port registered houseboats with certified life jackets. Cruises anchor safely between 17:30 IST and 08:00 IST.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: heroBackwatersImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 5500,
    visitingHours: '08:00 – 18:00 IST',
    defaultGeofenceRadiusM: 2000,
  },
  {
    id: 'kl_kochi',
    name: 'Kochi',
    region: 'Marine Drive & Ernakulam Harbor, Kochi',
    district: 'Ernakulam',
    category: 'Backwaters',
    latitude: 9.9312,
    longitude: 76.2673,
    description:
      'Cosmopolitan gateway of Kerala featuring Marine Drive waterfront, Water Metro island ferries, Mangalavanam bird reserve, and spice markets.',
    safetyNotes:
      'Use official Kochi Water Metro or KSINC ferries. Keep emergency contact sharing active during evening harbor promenades.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: coastalSunsetImg,
    bestSeason: 'Year-round (Peak Oct – Mar)',
    typicalBudgetInr: 3800,
    visitingHours: '06:00 – 21:30 IST',
    defaultGeofenceRadiusM: 2000,
  },
  {
    id: 'kl_fort_kochi',
    name: 'Fort Kochi',
    region: 'Fort Kochi & Mattancherry, Ernakulam',
    district: 'Ernakulam',
    category: 'Historical attractions',
    latitude: 9.9658,
    longitude: 76.2421,
    description:
      'Historic port quarter famed for Chinese fishing nets, St. Francis Church, Santa Cruz Basilica, Dutch Palace, and Jew Town heritage lanes.',
    safetyNotes:
      'Pedestrian-friendly heritage zone with dedicated Tourist Police Aid Post near Vasco da Gama Square. Stay clear of slippery sea walls at high tide.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: heritageFortImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 3200,
    visitingHours: '07:00 – 20:30 IST',
    defaultGeofenceRadiusM: 1200,
  },
  {
    id: 'kl_wayanad',
    name: 'Wayanad',
    region: 'Kalpetta, Sultan Bathery & Vythiri, Wayanad',
    district: 'Wayanad',
    category: 'Adventure tourism',
    latitude: 11.6854,
    longitude: 76.132,
    description:
      'Highland plateau renowned for Edakkal prehistoric petroglyphs, Banasura Sagar earthen dam, Chembra Peak treks, and spice trails.',
    safetyNotes:
      'Forest treks require official Kerala Forest Department permits. Check Thamarassery Churam ghat road & rainfall advisories during monsoon.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: munnarHillsImg,
    bestSeason: 'October – May',
    typicalBudgetInr: 4000,
    visitingHours: '07:00 – 17:30 IST',
    defaultGeofenceRadiusM: 3000,
  },
  {
    id: 'kl_thekkady',
    name: 'Thekkady',
    region: 'Kumily & Periyar Tiger Reserve, Idukki',
    district: 'Idukki',
    category: 'Wildlife sanctuaries',
    latitude: 9.6031,
    longitude: 77.1615,
    description:
      'Protected Periyar Tiger Reserve offering regulated bamboo rafting, lake boat safaris for wild elephants, and cardamom plantation tours.',
    safetyNotes:
      'Wear life vests throughout Periyar Lake boat safaris. Never step off designated forest trails or feed wildlife.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: thekkadyWildlifeImg,
    bestSeason: 'September – April',
    typicalBudgetInr: 4500,
    visitingHours: '06:00 – 17:00 IST',
    defaultGeofenceRadiusM: 2200,
  },
  {
    id: 'kl_kovalam',
    name: 'Kovalam',
    region: 'Lighthouse & Hawah Beach, Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    category: 'Beaches',
    latitude: 8.4004,
    longitude: 76.9787,
    description:
      'Crescent-shaped palm-fringed bays anchored by Vizhinjam Lighthouse, sheltered swimming zones, and coastal Ayurvedic wellness centers.',
    safetyNotes:
      'Swim strictly inside red-and-yellow lifeguard flags; rip currents strengthen during monsoon swells. Lifeguards patrol until sunset.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: coastalSunsetImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 4200,
    visitingHours: '06:00 – 19:30 IST',
    defaultGeofenceRadiusM: 1200,
  },
  {
    id: 'kl_varkala',
    name: 'Varkala',
    region: 'Papanasam North & South Cliff, Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    category: 'Beaches',
    latitude: 8.7379,
    longitude: 76.7163,
    description:
      'Dramatic red laterite coastal cliffs overlooking the Arabian Sea, mineral springs, Janardanaswamy Temple, and surf-friendly shores.',
    safetyNotes:
      'Stay inside fenced cliff walkways—laterite edges can soften after heavy rain. Heed coastal lifeguard whistles when entering surf.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: varkalaCliffImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 3500,
    visitingHours: '06:00 – 20:00 IST',
    defaultGeofenceRadiusM: 1200,
  },
  {
    id: 'kl_kumarakom',
    name: 'Kumarakom',
    region: 'Vembanad East Bank, Kottayam',
    district: 'Kottayam',
    category: 'Backwaters',
    latitude: 9.6175,
    longitude: 76.4301,
    description:
      'Responsible Tourism model village set on Vembanad Lake with a 14-acre migratory bird sanctuary, shikara rides, and mangrove boardwalks.',
    safetyNotes:
      'Carry insect repellent and sun protection on morning birding trails. Confirm boat operator registration before lagoon sunset trips.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: botanicalBayImg,
    bestSeason: 'November – March',
    typicalBudgetInr: 5000,
    visitingHours: '06:30 – 18:00 IST',
    defaultGeofenceRadiusM: 1800,
  },
  {
    id: 'kl_athirappilly',
    name: 'Athirappilly',
    region: 'Chalakudy River Basin, Thrissur',
    district: 'Thrissur',
    category: 'Eco-tourism',
    latitude: 10.2851,
    longitude: 76.5698,
    description:
      'Kerala’s largest waterfall (24 m drop) surrounded by Sholayar riparian rainforest, hornbill habitats, and Vazhachal rapids.',
    safetyNotes:
      'Slippery wet rocks—never cross safety railings or enter Chalakudy River currents, as upstream dam/rain surges occur rapidly.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: athirappillyFallsImg,
    bestSeason: 'September – February',
    typicalBudgetInr: 2600,
    visitingHours: '08:00 – 17:00 IST',
    defaultGeofenceRadiusM: 1000,
  },
  {
    id: 'kl_bekal_fort',
    name: 'Bekal Fort',
    region: 'Bekal Headland, Kasaragod',
    district: 'Kasaragod',
    category: 'Historical attractions',
    latitude: 12.3929,
    longitude: 75.0334,
    description:
      '17th-century keyhole-shaped laterite sea fortress spanning 40 acres with panoramic observation bastions over the Arabian Sea.',
    safetyNotes:
      'Archaeological Survey of India (ASI) monument: avoid climbing outer sea-facing ramparts during high wind or wet monsoon spells.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: heritageFortImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 2800,
    visitingHours: '08:00 – 17:30 IST',
    defaultGeofenceRadiusM: 900,
  },
  {
    id: 'kl_vagamon',
    name: 'Vagamon',
    region: 'Kottayam–Idukki Highland Border',
    district: 'Idukki',
    category: 'Adventure tourism',
    latitude: 9.6859,
    longitude: 76.9052,
    description:
      'Rolling green meadows, pine valleys, Kurisumala hills, glass bridge viewpoint, and regulated tandem paragliding slopes.',
    safetyNotes:
      'Verify adventure sports operators hold Kerala Adventure Tourism Promotion Society (KATPS) safety registration. Fog reduces visibility rapidly.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: munnarHillsImg,
    bestSeason: 'October – April',
    typicalBudgetInr: 3400,
    visitingHours: '07:00 – 18:00 IST',
    defaultGeofenceRadiusM: 1800,
  },
  {
    id: 'kl_ponmudi',
    name: 'Ponmudi',
    region: 'Vithura Ghats, Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    category: 'Hill stations',
    latitude: 8.7599,
    longitude: 77.1169,
    description:
      'Scenic 22-hairpin hill station near Thiruvananthapuram with Golden Valley stream, Peppara Sanctuary views, and mist-draped shola peaks.',
    safetyNotes:
      'Forest check-post regulates entry timing (typically closes afternoon during heavy rain alerts). Carry fuel and water before ascending Vithura.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: munnarHillsImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 2500,
    visitingHours: '08:00 – 16:30 IST',
    defaultGeofenceRadiusM: 1500,
  },
  {
    id: 'kl_silent_valley',
    name: 'Silent Valley',
    region: 'Mannarkkad / Mukkali, Palakkad',
    district: 'Palakkad',
    category: 'Wildlife sanctuaries',
    latitude: 11.0697,
    longitude: 76.4383,
    description:
      'Pristine tropical evergreen rainforest in the Nilgiri Biosphere Reserve, home to the endangered Lion-tailed Macaque and Kunthipuzha River.',
    safetyNotes:
      'Access strictly via Forest Department eco-safari vehicles from Mukkali base camp. Mobile coverage inside core buffer zones is limited—share itinerary beforehand.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: thekkadyWildlifeImg,
    bestSeason: 'November – April',
    typicalBudgetInr: 3200,
    visitingHours: '08:00 – 13:30 IST',
    defaultGeofenceRadiusM: 2500,
  },
  {
    id: 'kl_kozhikode_beach',
    name: 'Kozhikode Beach',
    region: 'Beach Road & Mananchira, Kozhikode',
    district: 'Kozhikode',
    category: 'Beaches',
    latitude: 11.2626,
    longitude: 75.7673,
    description:
      'Historic Malabar sunset beachfront with twin heritage piers, lighthouse promenade, Lions Park, and celebrated Kozhikode culinary street.',
    safetyNotes:
      'Well-lit family promenade with Pink Police & coastal patrols. Do not wade near old pier pilings or swim after dusk.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: coastalSunsetImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 2800,
    visitingHours: '05:30 – 21:30 IST',
    defaultGeofenceRadiusM: 1200,
  },
  {
    id: 'kl_marari_beach',
    name: 'Marari Beach',
    region: 'Mararikulam, Alappuzha',
    district: 'Alappuzha',
    category: 'Eco-tourism',
    latitude: 9.6006,
    longitude: 76.2983,
    description:
      'Serene coconut-grove fishing village coastline offering sustainable coastal homestays, coir craft heritage, and tranquil sunset walks.',
    safetyNotes:
      'Respect local fishing boat launch lanes in early mornings. Swim only in calm shallow stretches monitored by lifeguards.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: varkalaCliffImg,
    bestSeason: 'October – March',
    typicalBudgetInr: 4000,
    visitingHours: '06:00 – 19:00 IST',
    defaultGeofenceRadiusM: 1200,
  },
  {
    id: 'kl_guruvayur',
    name: 'Guruvayur',
    region: 'Guruvayur Temple Town, Thrissur',
    district: 'Thrissur',
    category: 'Religious tourism',
    latitude: 10.5946,
    longitude: 76.0411,
    description:
      'Revered Sri Krishna pilgrimage town in Thrissur featuring traditional Kerala temple architecture and Punnathur Kotta sanctuary nearby.',
    safetyNotes:
      'Follow Devaswom dress code, mobile-phone locker rules, and queue advisories. Keep senior and child emergency ID cards handy in peak crowds.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: heritageFortImg,
    bestSeason: 'Year-round',
    typicalBudgetInr: 2500,
    visitingHours: '03:00 – 21:15 IST',
    defaultGeofenceRadiusM: 1000,
  },
  {
    id: 'kl_sabarimala',
    name: 'Sabarimala',
    region: 'Pamba & Periyar Tiger Reserve Foothills, Pathanamthitta',
    district: 'Pathanamthitta',
    category: 'Religious tourism',
    latitude: 9.4331,
    longitude: 77.0811,
    description:
      'Sacred forest hill shrine in Pathanamthitta accessed via Pamba trek routes during Mandala–Makaravilakku and monthly temple openings.',
    safetyNotes:
      'Virtual-Q booking, hydration, cardiac rest points along Neelimala, and group geofencing at Pamba base camp are strongly advised.',
    emergencyNumber: '112',
    createdBy: 'system',
    isDemo: true,
    imageUrl: athirappillyFallsImg,
    bestSeason: 'Nov – Jan & Monthly Pooja Dates',
    typicalBudgetInr: 2800,
    visitingHours: 'As per Travancore Devaswom Schedule',
    defaultGeofenceRadiusM: 2500,
  },
];

export interface GeofencePreset {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export const KERALA_GEOFENCE_PRESETS: GeofencePreset[] = [
  { id: 'preset_munnar', name: 'Munnar Safe Hill Town Zone', district: 'Idukki', latitude: 10.0889, longitude: 77.0595, radiusMeters: 2500 },
  { id: 'preset_wayanad', name: 'Wayanad Kalpetta Plateau Zone', district: 'Wayanad', latitude: 11.6854, longitude: 76.132, radiusMeters: 3000 },
  { id: 'preset_thekkady', name: 'Thekkady Periyar Boat Landing Zone', district: 'Idukki', latitude: 9.6031, longitude: 77.1615, radiusMeters: 2000 },
  { id: 'preset_fort_kochi', name: 'Fort Kochi Heritage Promenade', district: 'Ernakulam', latitude: 9.9658, longitude: 76.2421, radiusMeters: 1200 },
  { id: 'preset_varkala', name: 'Varkala Cliff Walk Perimeter', district: 'Thiruvananthapuram', latitude: 8.7379, longitude: 76.7163, radiusMeters: 1200 },
  { id: 'preset_alleppey', name: 'Alleppey Finishing Point Jetty', district: 'Alappuzha', latitude: 9.4981, longitude: 76.3388, radiusMeters: 2000 },
  { id: 'preset_kovalam', name: 'Kovalam Lighthouse Beach Safe Zone', district: 'Thiruvananthapuram', latitude: 8.4004, longitude: 76.9787, radiusMeters: 1200 },
  { id: 'preset_athirappilly', name: 'Athirappilly Viewing Deck Zone', district: 'Thrissur', latitude: 10.2851, longitude: 76.5698, radiusMeters: 800 },
  { id: 'preset_spec_test', name: 'Reference Test Geofence (Spec Example)', district: 'Reference', latitude: 13.0827, longitude: 80.2707, radiusMeters: 500 },
];

export const DEMO_KERALA_GEOFENCES: GeofenceZone[] = [
  {
    id: 'demo_geo_fort_kochi',
    ownerId: 'demo_user',
    name: 'Fort Kochi Heritage Safe Zone',
    latitude: 9.9658,
    longitude: 76.2421,
    radiusMeters: 1200,
    isActive: true,
    notifyContacts: true,
  },
  {
    id: 'demo_geo_munnar',
    ownerId: 'demo_user',
    name: 'Munnar Town & Tea Museum Perimeter',
    latitude: 10.0889,
    longitude: 77.0595,
    radiusMeters: 2500,
    isActive: true,
    notifyContacts: false,
  },
];

export const DEMO_KERALA_CONTACTS: EmergencyContact[] = [
  {
    id: 'demo_cnt_1',
    ownerId: 'demo_user',
    name: 'Meera Nair (Demo Contact)',
    phone: '+91-98470-11200',
    email: 'meera.demo@example.com',
    relationship: 'Family / Spouse',
    notifyOnSos: true,
    notifyOnGeofence: true,
  },
];

export const DEMO_KERALA_LOGS: LocationLogEntry[] = [
  {
    id: 'demo_kl_log_1',
    ownerId: 'demo_user',
    tripId: 'trip_kochi_walk',
    latitude: 9.9639,
    longitude: 76.2412,
    accuracy: 14,
    source: 'demo',
    createdAtMs: Date.now() - 1000 * 60 * 24,
  },
  {
    id: 'demo_kl_log_2',
    ownerId: 'demo_user',
    tripId: 'trip_kochi_walk',
    latitude: 9.9648,
    longitude: 76.2417,
    accuracy: 11,
    source: 'demo',
    createdAtMs: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'demo_kl_log_3',
    ownerId: 'demo_user',
    tripId: 'trip_kochi_walk',
    latitude: 9.9658,
    longitude: 76.2421,
    accuracy: 10,
    source: 'demo',
    createdAtMs: Date.now() - 1000 * 60 * 2,
  },
];

export const STANDING_KERALA_SAFETY_GUIDELINES: SafetyAlertRecord[] = [
  {
    id: 'ref_ksdma_ghat',
    title: 'Western Ghats Night Driving & Fog Preparedness Guideline',
    district: 'Idukki',
    severity: 'advisory',
    category: 'Hill Road Caution',
    sourceAuthority: 'Kerala Tourism Safety Reference (Verify live warnings via KSDMA)',
    issuedAtIso: 'Standing Seasonal Guideline',
    validUntilIso: 'Ongoing Reference',
    description:
      'High-range routes in Idukki, Wayanad, and Ponmudi experience sudden evening fog and hairpin visibility drops. Check live IMD district rainfall bulletins before night transit.',
    createdBy: 'system',
    isReferenceSample: true,
  },
  {
    id: 'ref_coastal_swim',
    title: 'Arabian Sea Coastal Rip-Current & Lifeguard Flag Protocol',
    district: 'Thiruvananthapuram',
    severity: 'advisory',
    category: 'Coastal / Marine',
    sourceAuthority: 'Kerala Coastal Safety Protocol (Verify live marine alerts via IMD/INCOIS)',
    issuedAtIso: 'Standing Coastal Guideline',
    validUntilIso: 'Ongoing Reference',
    description:
      'At Kovalam, Varkala, Marari, and Kozhikode beaches, enter water strictly within lifeguard-flagged safe zones and avoid rocky headlands during high tide.',
    createdBy: 'system',
    isReferenceSample: true,
  },
];

export const DEMO_KERALA_AI_RECOMMENDATION: AIRecommendationResponse = {
  summaryTitle: '3-Day Kochi, Munnar & Alleppey Classic Kerala Safety Itinerary (Sample)',
  destinationOverview:
    'A balanced 3-day Kerala circuit linking Fort Kochi’s coastal heritage, Munnar’s misty tea highlands, and Alleppey’s tranquil backwaters with family-safe transit windows and INR budget clarity.',
  disclaimer:
    'Advisory: AI safety and route recommendations are general travel preparedness suggestions and NOT verified real-time safety or weather intelligence. Verify official IMD and KSDMA bulletins during travel.',
  budgetBreakdownInr: {
    accommodationInr: '₹9,000 (₹3,000/night eco-resort & heritage homestay)',
    localTransportInr: '₹6,500 (Inter-district cab / KSRTC & Water Metro)',
    foodAndDiningInr: '₹4,200 (Kerala Sadya, coastal seafood & plantation cafes)',
    activitiesAndEntryInr: '₹3,800 (Day houseboat cruise, Eravikulam & museum tickets)',
    totalEstimatedInr: '₹23,500 total for 2 travelers (3 Days)',
  },
  recommendedPlaces: [
    {
      name: 'Fort Kochi & Mattancherry Heritage Zone',
      category: 'Historical attractions',
      suitability: 'Ideal for families, solo travelers & senior visitors',
      estimatedCost: '₹400 – ₹900 per person',
      bestTimeToVisit: '08:00 – 11:30 IST & 16:30 – 18:30 IST',
      description:
        'Walkable colonial port streets, Chinese fishing nets, Dutch Palace, and Kochi Water Metro terminal with Tourist Police presence.',
    },
    {
      name: 'Munnar Tea Museum & Eravikulam Foothills',
      category: 'Hill stations',
      suitability: 'Great for nature lovers, families & photography',
      estimatedCost: '₹600 – ₹1,400 per person',
      bestTimeToVisit: '07:30 – 16:00 IST (before evening mist)',
      description:
        'Cool high-range tea gardens, Nilgiri Tahr sanctuary shuttles, and scenic viewpoints along well-maintained daytime highways.',
    },
    {
      name: 'Alleppey Registered Day Houseboat Cruise',
      category: 'Backwaters',
      suitability: 'Relaxed scenic backwater experience for all ages',
      estimatedCost: '₹2,500 – ₹6,000 shared/private cruise',
      bestTimeToVisit: '11:00 – 17:00 IST',
      description:
        'Glide through Vembanad canals and Kuttanad villages aboard DTPC-registered vessels equipped with life jackets and trained crew.',
    },
  ],
  safetySuggestions: [
    {
      topic: 'Ghat Road Daylight Window (Kochi – Munnar)',
      precaution:
        'Complete Neriamangalam–Adimali–Munnar ascent before 17:30 IST to avoid dense mountain fog on hairpin bends.',
      recommendedWindow: '07:00 – 17:30 IST',
    },
    {
      topic: 'Backwater Vessel Safety Verification',
      precaution:
        'Confirm valid Kerala Port registration number and accessible life jackets for every passenger before boarding.',
      recommendedWindow: 'Prior to embarkation',
    },
    {
      topic: 'Live Geofence & Emergency Contacts',
      precaution:
        'Activate your TourSafe 360 live sharing session and keep 112 / District Control numbers accessible offline.',
      recommendedWindow: 'Throughout journey',
    },
  ],
  smartJourneyChecklist: [
    'Save your Digital Tourist ID PDF offline on your phone for quick reference.',
    'Enable a 1,500 m circular geofence around your hotel or homestay each evening.',
    'Carry rain protection, mosquito repellent, and basic motion-sickness tablets for ghat roads.',
    'Check live district rainfall & wind telemetry in Weather & Safety Alerts before hill or boat trips.',
  ],
  smartJourneyStops: [
    {
      stopName: 'Kolenchery / Adimali Highway Rest & Medical Hub (NH-85)',
      purpose: 'Midway refreshment, pharmacy, fuel & major multi-specialty hospital access en route to Munnar.',
      safetyNote: 'Last major town services before ascending steep high-range tea estate roads.',
    },
    {
      stopName: 'Cherthala / Aroor NH-66 Corridor Stop',
      purpose: 'Clean rest stop and hospital corridor between Kochi and Alappuzha.',
      safetyNote: 'Well-lit four-lane highway stretch with 24x7 highway police patrol.',
    },
  ],
  itineraryPlan: [
    {
      dayLabel: 'Day 1: Kochi Harbor & Fort Kochi Heritage',
      morning: 'Arrive in Ernakulam, take Kochi Water Metro to Fort Kochi, visit St. Francis Church & Chinese Fishing Nets.',
      afternoon: 'Explore Mattancherry Dutch Palace, Paradesi Synagogue lane, and traditional Kerala lunch.',
      evening: 'Sunset walk along Fort Kochi promenade; return to hotel before 20:30 IST.',
      safetyCheckpoint: 'Enable Fort Kochi 1,200 m geofence and verify emergency contact live link.',
    },
    {
      dayLabel: 'Day 2: Scenic Ascent to Munnar Highlands',
      morning: 'Depart Kochi at 07:30 IST via NH-85 pausing at Cheeyappara Waterfalls viewing bay.',
      afternoon: 'Visit Tata Tea Museum and Mattupetty Dam reservoir.',
      evening: 'Relax at Munnar town resort; avoid unlit estate roads after dusk.',
      safetyCheckpoint: 'Check Idukki district live weather & fog status before afternoon sightseeing.',
    },
    {
      dayLabel: 'Day 3: Alleppey Backwaters & Departure',
      morning: 'Descend to Alappuzha and board a DTPC-registered Kettuvallam at Punnamada Jetty.',
      afternoon: 'Daytime cruise across Vembanad Lake with onboard Kerala meals, docking by 16:30 IST.',
      evening: 'Proceed to Cochin International Airport / Ernakulam Junction.',
      safetyCheckpoint: 'Verify life-jacket availability on boarding and close active sharing session after arrival.',
    },
  ],
};

export function buildKeralaDemoNearbyServices(lat: number, lng: number): NearbyServiceItem[] {
  return [
    {
      id: 'kl_srv_police',
      name: 'Kerala Tourist Police Aid Post (Sample Reference)',
      category: 'police',
      address: 'Near Heritage Promenade Circle · Dial 112 / 100',
      phone: '100',
      latitude: lat + 0.0032,
      longitude: lng - 0.0021,
      distanceMeters: 410,
      isDemo: true,
    },
    {
      id: 'kl_srv_gov_hosp',
      name: 'Taluk Government General Hospital (Sample Reference)',
      category: 'gov_hospital',
      address: '24x7 Casualty & Trauma Unit · Kerala Health Services',
      phone: '108',
      latitude: lat - 0.0048,
      longitude: lng + 0.0039,
      distanceMeters: 680,
      isDemo: true,
    },
    {
      id: 'kl_srv_priv_hosp',
      name: 'Malabar Multi-Specialty Medical Centre (Sample Reference)',
      category: 'priv_hospital',
      address: '24x7 Emergency ICU & Cardiac Care',
      phone: '112',
      latitude: lat + 0.0065,
      longitude: lng + 0.0044,
      distanceMeters: 860,
      isDemo: true,
    },
    {
      id: 'kl_srv_amb',
      name: '108 Kerala Emergency Ambulance Base (Sample Reference)',
      category: 'ambulance',
      address: 'Rapid Response Ambulance Dispatch Point',
      phone: '108',
      latitude: lat - 0.0025,
      longitude: lng - 0.0036,
      distanceMeters: 490,
      isDemo: true,
    },
    {
      id: 'kl_srv_pharm',
      name: 'Karunya / 24x7 Medical Pharmacy (Sample Reference)',
      category: 'pharmacy',
      address: 'Essential Medicines, ORS & First-Aid Supplies',
      latitude: lat + 0.0019,
      longitude: lng + 0.0024,
      distanceMeters: 340,
      isDemo: true,
    },
    {
      id: 'kl_srv_fire',
      name: 'Kerala Fire & Rescue Station (Sample Reference)',
      category: 'fire_rescue',
      address: 'District Fire & Water Rescue Unit · Dial 101',
      phone: '101',
      latitude: lat - 0.0072,
      longitude: lng + 0.0018,
      distanceMeters: 820,
      isDemo: true,
    },
  ];
}
