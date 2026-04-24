import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// صوت ElevenLabs الاحترافي المُختار للعربية
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George

// ===== نظام تدوير مفاتيح ElevenLabs (Round-robin) =====
// يقرأ كل المفاتيح من البيئة: ELEVENLABS_API_KEY, ELEVENLABS_API_KEY_1..N
function loadApiKeys(): { name: string; key: string }[] {
  const keys: { name: string; key: string }[] = [];
  const seen = new Set<string>();

  const pushKey = (name: string, value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push({ name, key: trimmed });
  };

  // المفتاح الرئيسي (للتوافق الخلفي)
  pushKey("ELEVENLABS_API_KEY", Deno.env.get("ELEVENLABS_API_KEY"));

  // مفاتيح مرقمة 1..20
  for (let i = 1; i <= 20; i++) {
    pushKey(`ELEVENLABS_API_KEY_${i}`, Deno.env.get(`ELEVENLABS_API_KEY_${i}`));
  }

  return keys;
}

// ===== مؤشر round-robin دائم في قاعدة البيانات =====
// يضمن التوزيع بين المفاتيح حتى مع تعدد نسخ Edge Function
const ROTATION_NAME = "elevenlabs";

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// fallback per-instance لو فشل الوصول للقاعدة
let memoryIndex = Math.floor(Math.random() * 1000);

async function nextStartIndex(total: number): Promise<number> {
  if (total <= 0) return 0;
  const client = getAdminClient();
  if (!client) {
    const idx = memoryIndex % total;
    memoryIndex = (memoryIndex + 1) % 1000000;
    return idx;
  }
  try {
    // قراءة وزيادة المؤشر بشكل ذري عبر RPC غير متوفر؟ نستخدم select+update مع upsert
    const { data, error } = await client
      .from("tts_key_rotation_state")
      .select("current_index")
      .eq("rotation_name", ROTATION_NAME)
      .maybeSingle();

    let current = 0;
    if (!error && data && typeof data.current_index === "number") {
      current = data.current_index;
    }

    const idx = ((current % total) + total) % total;
    const next = (current + 1) % 1000000;

    await client
      .from("tts_key_rotation_state")
      .upsert(
        {
          rotation_name: ROTATION_NAME,
          current_index: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "rotation_name" },
      );

    return idx;
  } catch (e) {
    console.warn("[tts] rotation state fallback to memory:", e);
    const idx = memoryIndex % total;
    memoryIndex = (memoryIndex + 1) % 1000000;
    return idx;
  }
}

// تنظيف النص قبل التحويل لصوت
function cleanTextForTTS(input: string): string {
  if (!input) return "";
  let t = input;

  t = t.replace(/<!--KOTOBI_CARDS:[\s\S]*?-->/g, " ");
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/g, " ");
  t = t.replace(/[*_~#>|=`]+/g, " ");
  t = t.replace(/[-–—]{2,}/g, " ");
  t = t.replace(/\s-\s/g, "، ");
  t = t.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, " ");
  t = t.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu,
    " ",
  );
  t = t.replace(/^[\s]*[•·▪◦●○■□]+\s*/gm, "");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\s*\n\s*/g, ". ");
  t = t.replace(/\s+([،.؟!:؛])/g, "$1");
  t = t.replace(/([،.؟!:؛])\1+/g, "$1");
  t = t.trim();

  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKeys = loadApiKeys();
    if (apiKeys.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "لا يوجد أي مفتاح ElevenLabs مهيأ. أضف ELEVENLABS_API_KEY أو ELEVENLABS_API_KEY_1..N في Supabase Secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));

    const rawText = (body?.text ?? "").toString();
    const voiceId =
      (typeof body?.voiceId === "string" && body.voiceId.trim()) ||
      DEFAULT_VOICE_ID;
    const speed = typeof body?.speed === "number" ? body.speed : 1.05;

    const text = cleanTextForTTS(rawText);
    if (!text) {
      return new Response(JSON.stringify({ error: "نص فارغ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeText = text.length > 4500 ? text.slice(0, 4500) : text;

    const callElevenLabs = (apiKey: string, modelId: string) =>
      fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: safeText,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.2,
              use_speaker_boost: true,
              speed,
            },
          }),
        },
      );

    // Round-robin: ابدأ من المفتاح التالي ودر على الباقين عند الفشل
    const total = apiKeys.length;
    const startIdx = await nextStartIndex(total);
    const attempts: { name: string; status: number; detail: string }[] = [];

    let successResp: Response | null = null;
    let usedKeyName = "";

    for (let i = 0; i < total; i++) {
      const idx = (startIdx + i) % total;
      const { name, key } = apiKeys[idx];

      let resp = await callElevenLabs(key, "eleven_multilingual_v2");

      // عند الفشل بسبب الحصة/المصادقة جرّب turbo بنفس المفتاح
      if (!resp.ok && (resp.status === 401 || resp.status === 429)) {
        const firstErr = await resp.text().catch(() => "");
        attempts.push({
          name,
          status: resp.status,
          detail: firstErr.slice(0, 200),
        });
        console.warn(
          `[tts] ${name} failed (${resp.status}) on multilingual_v2, trying turbo...`,
        );
        resp = await callElevenLabs(key, "eleven_turbo_v2_5");
      }

      if (resp.ok) {
        successResp = resp;
        usedKeyName = name;
        break;
      }

      const errText = await resp.text().catch(() => "");
      attempts.push({
        name,
        status: resp.status,
        detail: errText.slice(0, 200),
      });
      console.warn(
        `[tts] ${name} failed status=${resp.status}, trying next key...`,
      );

      // 401/429 = حصة منتهية أو مصادقة فاشلة → جرّب التالي
      // باقي الأخطاء (5xx/4xx) → جرّب التالي أيضاً
    }

    if (!successResp) {
      console.error("All ElevenLabs keys failed", attempts);
      return new Response(
        JSON.stringify({
          error: "فشل توليد الصوت من جميع المفاتيح المتاحة",
          attempts,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[tts] success using key: ${usedKeyName}`);

    const audioBuffer = await successResp.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const audioBase64 = btoa(binary);

    return new Response(
      JSON.stringify({
        audio: audioBase64,
        mime: "audio/mpeg",
        format: "mp3",
        usedKey: usedKeyName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("kotobi-tts error", err);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في توليد الصوت" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
