import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeInput, scrubOutput } from '@/lib/inputGuard';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// ── Supported languages ───────────────────────────────────────────────────────
const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  hi: 'Hindi',
  ar: 'Arabic',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      audioBase64,
      mimeType    = 'audio/webm',
      language    = 'en',
      venueName   = 'the venue',
      density     = 0.5,
    } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'audioBase64 is required' },
        { status: 400 },
      );
    }

    // Validate language code
    const langName = SUPPORTED_LANGUAGES[language] ?? 'English';

    // Use gemini-2.5-flash which supports multimodal audio input
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemContext = `You are a multilingual, friendly crowd-management assistant for ${venueName}.
Current crowd density: ${(Number(density) * 100).toFixed(0)}%.
The user is speaking in ${langName}. You MUST respond ONLY in ${langName}.
Be concise: 2–3 sentences maximum. Focus on crowd conditions, wait times, and navigation.`;

    const result = await model.generateContent([
      systemContext,
      {
        inlineData: {
          mimeType: mimeType,
          data    : audioBase64,
        },
      },
    ]);

    const rawText = result.response.text().trim();

    // ── OWASP LLM01: Validate transcription isn't an injection ────────────
    const { blocked, reason } = sanitizeInput(rawText.slice(0, 500));
    if (blocked) {
      return NextResponse.json({ ok: false, error: `Output blocked: ${reason}` }, { status: 422 });
    }

    // ── OWASP LLM02: Scrub any PII from the AI response ─────────────────
    const safeResponse = scrubOutput(rawText);

    return NextResponse.json({
      ok      : true,
      response: safeResponse,
      language,
      langName,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
