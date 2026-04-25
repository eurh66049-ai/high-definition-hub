import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_BOT_USER_ID = "00000000-0000-0000-0000-00000000a1a1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const conversationId: string | undefined = body?.conversationId;
    let userMessage: string = (body?.userMessage || "").toString().trim();
    const audioUrl: string | undefined = body?.audioUrl;

    // إذا أُرسل صوت بدلاً من نص — حوّله إلى نص عبر Voxtral STT (سريع)
    if (!userMessage && audioUrl) {
      try {
        const audioBlob = await fetch(audioUrl).then((r) => r.blob());
        const fd = new FormData();
        fd.append("model", "voxtral-mini-latest");
        fd.append("file", audioBlob, "voice.webm");
        fd.append("language", "ar");
        const sttResp = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
          body: fd,
        });
        if (sttResp.ok) {
          const sttJson = await sttResp.json();
          userMessage = (sttJson?.text || "").toString().trim();
        }
      } catch (e) {
        console.error("[ai-kotobi-chat] STT error", e);
      }
      if (!userMessage) userMessage = "(رسالة صوتية)";
    }

    if (!conversationId || !userMessage) {
      return new Response(JSON.stringify({ error: "Missing conversationId or userMessage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // جلب آخر 10 رسائل فقط لسرعة الاستجابة
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender_id, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatHistory = (recentMessages || []).reverse().map((msg) => ({
      role: msg.sender_id === AI_BOT_USER_ID ? "assistant" : "user",
      content: String(msg.content).replace(/<!--KOTOBI_CARDS:[\s\S]*?-->/g, "").trim(),
    }));

    const systemPrompt = `أنت "AI KOTOBI" — المساعد الذكي لمنصة كتبي (kotobi.xyz) المتخصصة في الكتب العربية.
أجب بالعربية الفصحى البسيطة، بشكل ودود ومباشر ومختصر، دون إطالة.
إذا سُئلت عن كتاب أو مؤلف غير متأكد منه، كن صادقاً ولا تخترع معلومات.`;

    const aiResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
          { role: "user", content: userMessage },
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Mistral API error:", aiResponse.status, errText);
      throw new Error(`Mistral API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiReply: string =
      aiData.choices?.[0]?.message?.content || "عذراً، لم أتمكن من الرد. حاول مرة أخرى.";

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: AI_BOT_USER_ID,
      content: aiReply,
      is_read: false,
      message_type: "text",
    });

    if (insertError) {
      console.error("Error inserting bot message:", insertError);
      throw insertError;
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ reply: aiReply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-kotobi-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
