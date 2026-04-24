import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// صوت ElevenLabs الاحترافي المُختار للعربية
// George — صوت ذكوري دافئ وواضح، نطق عربي ممتاز عبر eleven_multilingual_v2
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George

// تنظيف النص قبل التحويل لصوت
function cleanTextForTTS(input: string): string {
  if (!input) return "";
  let t = input;

  // إزالة بطاقات داخلية
  t = t.replace(/<!--KOTOBI_CARDS:[\s\S]*?-->/g, " ");

  // إزالة كتل الأكواد ```...```
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");

  // روابط ماركداون [text](url) -> text
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // روابط عارية
  t = t.replace(/https?:\/\/\S+/g, " ");

  // رموز ماركداون: ** __ * _ ~ # > | =
  t = t.replace(/[*_~#>|=`]+/g, " ");

  // شرطات/فواصل زخرفية متكررة
  t = t.replace(/[-–—]{2,}/g, " ");
  // شرطة منفردة بين مسافات
  t = t.replace(/\s-\s/g, "، ");

  // أقواس فارغة
  t = t.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, " ");

  // إزالة الإيموجي والرموز التصويرية
  t = t.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu,
    " ",
  );

  // علامات نقطية شائعة في القوائم
  t = t.replace(/^[\s]*[•·▪◦●○■□]+\s*/gm, "");

  // مسافات وأسطر زائدة
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
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY غير مهيأ" }),
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

    const callElevenLabs = (vid: string) =>
      fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: safeText,
            model_id: "eleven_multilingual_v2",
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

    let ttsResp = await callElevenLabs(voiceId);
    // عند فشل المفتاح/الحساب — جرّب turbo بصوت احتياطي
    if (ttsResp.status === 401) {
      console.warn("[tts] 401 from ElevenLabs, retrying with fallback voice");
      ttsResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: safeText,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.55, similarity_boost: 0.8 },
          }),
        },
      );
    }

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      console.error("ElevenLabs TTS error:", ttsResp.status, errText);
      return new Response(
        JSON.stringify({
          error: "فشل توليد الصوت",
          status: ttsResp.status,
          details: errText.slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audioBuffer = await ttsResp.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const audioBase64 = btoa(binary);

    return new Response(
      JSON.stringify({ audio: audioBase64, mime: "audio/mpeg", format: "mp3" }),
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
