import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Compass,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AIRecommendationResponse, AppLanguage, Coordinates } from '../types';
import { DEMO_KERALA_AI_RECOMMENDATION, KERALA_DISTRICTS } from '../data/keralaData';

interface AIRecommendationsViewProps {
  currentCoords: Coordinates | null;
  language?: AppLanguage;
  defaultTravelStyle?: string;
  defaultBudget?: string;
  onNewRecommendationGenerated?: (summaryTitle: string) => void;
}

export const AIRecommendationsView: React.FC<AIRecommendationsViewProps> = ({
  currentCoords,
  language = 'en',
  defaultTravelStyle = 'family',
  defaultBudget = 'moderate',
  onNewRecommendationGenerated,
}) => {
  const [mode, setMode] = useState<'destinations' | 'safety' | 'itinerary' | 'journey'>('itinerary');
  const [district, setDistrict] = useState<string>('All Kerala');
  const [destinationQuery, setDestinationQuery] = useState(
    'Fort Kochi, Munnar Tea Hills & Alleppey Backwaters'
  );
  const [budgetInr, setBudgetInr] = useState<number>(25000);
  const [budgetTier, setBudgetTier] = useState(defaultBudget || 'moderate');
  const [numTourists, setNumTourists] = useState<number>(2);
  const [travelType, setTravelType] = useState(defaultTravelStyle || 'family');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [accommodation, setAccommodation] = useState('Heritage Homestay & Eco-Resort');
  const [interests, setInterests] = useState(
    'Backwater day cruise, tea hills, cultural heritage, local Kerala cuisine'
  );
  const [activities, setActivities] = useState(
    'Daylight scenic drives, guided sanctuary walks, family-safe viewpoints'
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sourceTag, setSourceTag] = useState<'gemini' | 'demo'>('demo');
  const [result, setResult] = useState<AIRecommendationResponse>(DEMO_KERALA_AI_RECOMMENDATION);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          district,
          destinationQuery: destinationQuery.trim(),
          ...(currentCoords
            ? {
                latitude: currentCoords.latitude,
                longitude: currentCoords.longitude,
              }
            : {}),
          budgetInr,
          budget: budgetTier,
          numTourists,
          travelType,
          durationDays,
          accommodation,
          interests: interests.trim(),
          activities: activities.trim(),
          language,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrorMsg(payload.error || 'Could not reach Gemini AI endpoint. Showing Kerala sample guidance.');
        setSourceTag('demo');
        setResult(DEMO_KERALA_AI_RECOMMENDATION);
        return;
      }

      if (payload.data) {
        setResult(payload.data as AIRecommendationResponse);
        setSourceTag('gemini');
        if (onNewRecommendationGenerated && payload.data.summaryTitle) {
          onNewRecommendationGenerated(payload.data.summaryTitle);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Network error while generating Kerala AI travel recommendations.'
      );
      setSourceTag('demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Kerala AI Travel Assistance & Personalized Safety Planner
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Powered by Google Gemini · Personalized Kerala itineraries, INR (₹) budget breakdowns, smart highway stops, and safety checklists.
          </p>
        </div>

        <div className="text-xs text-slate-600">
          {sourceTag === 'gemini' ? (
            <span className="text-emerald-700 font-medium">Active Output: Live Gemini 3.8 Flash</span>
          ) : (
            <span className="text-slate-600">
              Active Output: Curated Kerala Sample (Click Generate Plan for Live AI)
            </span>
          )}
        </div>
      </div>

      {/* Mandatory Non-Real-Time Safety Suggestion Disclosure */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 leading-relaxed">
          <span className="font-semibold">AI Advisory Disclosure:</span> AI-generated itineraries, cost estimates, and safety suggestions are provided strictly as general travel planning guidance. They are{' '}
          <span className="underline font-medium">not verified real-time safety or weather intelligence</span>. Always verify live IMD weather warnings, KSDMA district bulletins, and Forest Department entry timings before travel.
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              { id: 'itinerary', label: 'Day-Wise Kerala Itinerary' },
              { id: 'destinations', label: 'Destination Picks' },
              { id: 'safety', label: 'Safety & Precautions' },
              { id: 'journey', label: 'Smart Highway & Medical Stops' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === m.id
                  ? 'bg-emerald-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Kerala District Focus
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="All Kerala">All Kerala (Multi-District)</option>
              {KERALA_DISTRICTS.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Target Destinations / Route in Kerala
            </label>
            <input
              type="text"
              required
              maxLength={140}
              value={destinationQuery}
              onChange={(e) => setDestinationQuery(e.target.value)}
              placeholder="e.g., Munnar, Thekkady & Alleppey or Wayanad & Kozhikode"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Total Budget (INR ₹)
            </label>
            <input
              type="number"
              min={2000}
              max={1000000}
              step={500}
              value={budgetInr}
              onChange={(e) => setBudgetInr(Math.max(2000, Number(e.target.value) || 10000))}
              className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Number of Tourists
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={numTourists}
              onChange={(e) => setNumTourists(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Duration (Days)
            </label>
            <input
              type="number"
              min={1}
              max={14}
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
              className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Travel Type
            </label>
            <select
              value={travelType}
              onChange={(e) => setTravelType(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="family">Family Friendly</option>
              <option value="solo">Solo Traveler</option>
              <option value="couple">Couple / Honeymoon</option>
              <option value="group">Friends / Group</option>
              <option value="senior">Senior / Accessible</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Accommodation Preference
            </label>
            <select
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="Heritage Homestay & Eco-Resort">Heritage Homestay & Eco-Resort</option>
              <option value="KTDC / Verified Standard Hotel">KTDC / Verified Standard Hotel</option>
              <option value="Registered Houseboat & Resort">Registered Houseboat & Resort</option>
              <option value="Budget Backpacking Hostels">Budget Backpacking Hostels</option>
              <option value="Luxury Wellness Retreat">Luxury Ayurvedic & Wellness Resort</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Interests (Hill stations, Backwaters, Wildlife, Heritage...)
            </label>
            <input
              type="text"
              maxLength={180}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Preferred Activities & Mobility Needs
            </label>
            <input
              type="text"
              maxLength={180}
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Kerala Plan
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Comfort Tier:</span>
          {(['budget', 'moderate', 'comfort'] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setBudgetTier(tier)}
              className={`capitalize underline-offset-4 ${
                budgetTier === tier ? 'font-semibold text-emerald-800 underline' : 'hover:text-slate-800'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
      </form>

      {/* Output Sections */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900">{result.summaryTitle}</h3>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{result.destinationOverview}</p>
          <p className="text-xs text-slate-500 mt-2 italic">{result.disclaimer}</p>
        </div>

        {/* INR Budget Breakdown */}
        {result.budgetBreakdownInr && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              Estimated Kerala Trip Budget Breakdown (INR ₹)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
                <span className="text-slate-500 block">Accommodation</span>
                <span className="font-semibold font-mono-tabular text-slate-900 mt-1 block">
                  {result.budgetBreakdownInr.accommodationInr}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
                <span className="text-slate-500 block">Local Transport</span>
                <span className="font-semibold font-mono-tabular text-slate-900 mt-1 block">
                  {result.budgetBreakdownInr.localTransportInr}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
                <span className="text-slate-500 block">Food & Kerala Dining</span>
                <span className="font-semibold font-mono-tabular text-slate-900 mt-1 block">
                  {result.budgetBreakdownInr.foodAndDiningInr}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
                <span className="text-slate-500 block">Entry & Activities</span>
                <span className="font-semibold font-mono-tabular text-slate-900 mt-1 block">
                  {result.budgetBreakdownInr.activitiesAndEntryInr}
                </span>
              </div>
              <div className="bg-emerald-950 text-white rounded-lg p-3.5">
                <span className="text-emerald-300 block">Total Estimated</span>
                <span className="font-bold font-mono-tabular text-amber-300 mt-1 block">
                  {result.budgetBreakdownInr.totalEstimatedInr}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Kerala Places */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Compass className="w-4 h-4 text-orange-600" />
            Recommended Kerala Destinations & Attractions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(result.recommendedPlaces ?? []).map((place, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{place.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>{place.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{place.estimatedCost}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{place.description}</p>
                <p className="text-xs text-slate-600 pt-1">
                  <span className="font-medium text-slate-800">Best Window (IST):</span>{' '}
                  {place.bestTimeToVisit}
                </p>
                <p className="text-xs text-slate-500">{place.suitability}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Journey Stops */}
        {(result.smartJourneyStops ?? []).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-700" />
              Smart Highway Corridors, Rest & Medical Stops
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.smartJourneyStops?.map((st, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-900">{st.stopName}</p>
                  <p className="text-slate-600">{st.purpose}</p>
                  <p className="text-emerald-800 font-medium">Safety Note: {st.safetyNote}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Suggestions & Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Safety Precautions (General AI Suggestions)
            </h4>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {(result.safetySuggestions ?? []).map((s, idx) => (
                <div key={idx} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{s.topic}</span>
                    <span className="text-[11px] text-slate-500 font-mono-tabular">
                      {s.recommendedWindow}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.precaution}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-900" />
              Smart Kerala Journey Checklist
            </h4>
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {(result.smartJourneyChecklist ?? []).map((item, idx) => (
                <li key={idx} className="p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Day-Wise Itinerary */}
        {(result.itineraryPlan ?? []).length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              Suggested Day-Wise Kerala Itinerary (IST)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.itineraryPlan.map((day, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{day.dayLabel}</p>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">Morning:</span> {day.morning}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Afternoon:</span> {day.afternoon}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Evening:</span> {day.evening}
                    </p>
                    <p className="pt-1 text-emerald-800 font-medium">
                      Safety Checkpoint: {day.safetyCheckpoint}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
