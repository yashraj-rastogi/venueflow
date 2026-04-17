import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function POST(req: NextRequest) {
  try {
    const { amenityName, currentWait, density, timeOfDay } = await req.json();

    const prompt = `Predict venue amenity wait time in 15 min. Given:
- Amenity: ${amenityName}
- Current wait: ${currentWait} min
- Zone density: ${(density * 100).toFixed(0)}%
- Time of day: ${timeOfDay}:00
Return ONLY valid JSON: {"predictedWait":number,"confidence":number,"trend":"increasing"|"stable"|"decreasing","reasoning":"brief"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const data = JSON.parse(json);

    return NextResponse.json(data);
  } catch (err) {
    // Heuristic fallback
    const { currentWait = 5, density = 0.5 } = await req.json().catch(() => ({}));
    const delta = density > 0.7 ? 2 : density < 0.3 ? -2 : 0;
    return NextResponse.json({
      predictedWait: Math.max(0, currentWait + delta),
      confidence: 0.6,
      trend: delta > 0 ? 'increasing' : delta < 0 ? 'decreasing' : 'stable',
      reasoning: 'Heuristic estimate based on density',
    });
  }
}
