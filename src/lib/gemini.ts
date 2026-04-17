import { GoogleGenerativeAI } from '@google/generative-ai';
import { CrowdSnapshot, WaitTimePrediction, RouteOption, LatLng } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// Use flash model for efficiency
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ─── Wait Time Prediction ─────────────────────────────────────────────────────

export async function predictWaitTime(
  amenityName: string,
  currentWait: number,
  density: number,
  timeOfDay: number // hour 0–23
): Promise<WaitTimePrediction> {
  const prompt = `Predict venue amenity wait time in 15 min. Given:
- Amenity: ${amenityName}
- Current wait: ${currentWait} min
- Zone density: ${(density * 100).toFixed(0)}%
- Time of day: ${timeOfDay}:00

Return ONLY valid JSON: {"predictedWait":number,"confidence":number,"trend":"increasing"|"stable"|"decreasing","reasoning":"brief"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    return JSON.parse(json) as WaitTimePrediction;
  } catch {
    // Fallback heuristic
    const delta = density > 0.7 ? 2 : density < 0.3 ? -2 : 0;
    return {
      predictedWait: Math.max(0, currentWait + delta),
      confidence: 0.6,
      trend: delta > 0 ? 'increasing' : delta < 0 ? 'decreasing' : 'stable',
      reasoning: 'Heuristic estimate based on density',
    };
  }
}

// ─── Route Optimization ───────────────────────────────────────────────────────

export async function optimizeRoute(
  start: string,
  destination: string,
  crowdData: CrowdSnapshot,
  preference: 'fastest' | 'least_crowded'
): Promise<{ suggestion: string; crowdLevel: string; estimatedTime: number }> {
  const avgDensity = Object.values(crowdData.zones).reduce((s, z) => s + z.density, 0) / 
    Object.values(crowdData.zones).length;

  const prompt = `Venue navigation advice:
- From: ${start}
- To: ${destination}
- Preference: ${preference}
- Average crowd density: ${(avgDensity * 100).toFixed(0)}%
- High density zones: ${Object.entries(crowdData.zones).filter(([,z]) => z.density > 0.7).map(([id]) => id).join(', ') || 'none'}

Return ONLY valid JSON: {"suggestion":"brief route tip","crowdLevel":"low"|"medium"|"high","estimatedTime":number}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    return JSON.parse(json);
  } catch {
    return {
      suggestion: preference === 'least_crowded' 
        ? 'Take the outer concourse to avoid crowded zones'
        : 'Proceed via the main corridor for the fastest route',
      crowdLevel: avgDensity > 0.7 ? 'high' : avgDensity > 0.3 ? 'medium' : 'low',
      estimatedTime: 3,
    };
  }
}

// ─── AI Chat / Query ──────────────────────────────────────────────────────────

export async function analyzeQuery(
  question: string,
  venueName: string,
  currentDensity: number
): Promise<string> {
  const prompt = `You are a helpful venue assistant for ${venueName}. 
Current crowd density: ${(currentDensity * 100).toFixed(0)}%.
Answer concisely (2-3 sentences max): ${question}`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return "I'm having trouble connecting. Please try again in a moment.";
  }
}
