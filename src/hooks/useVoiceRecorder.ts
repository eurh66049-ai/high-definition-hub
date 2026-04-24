import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type VoiceRecorderState = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderOptions {
  onTranscribed?: (text: string) => void;
  onError?: (message: string) => void;
  // إذا true: لا يفرّغ النص — يرجع Blob الصوتي مباشرة (لرسائل صوتية واتساب-style)
  rawAudioMode?: boolean;
  onAudioReady?: (payload: { blob: Blob; mimeType: string; durationMs: number }) => void;
}

/**
 * Hook لتسجيل الصوت من الميكروفون وإرساله إلى edge function للتفريغ النصي.
 * يستخدم MediaRecorder + Blob base64 لتجنب مشاكل multipart مع supabase invoke.
 */
export const useVoiceRecorder = ({ onTranscribed, onError, rawAudioMode, onAudioReady }: UseVoiceRecorderOptions) => {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  const pickMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError?.('المتصفح لا يدعم تسجيل الصوت');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setState('recording');
    } catch (err) {
      console.error('[voice] start error', err);
      onError?.('تعذّر الوصول إلى الميكروفون. تحقق من الأذونات.');
      cleanupStream();
      setState('idle');
    }
  }, [state, onError, cleanupStream]);

  const cancel = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    chunksRef.current = [];
    cleanupStream();
    setState('idle');
  }, [cleanupStream]);

  const stop = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setState('idle');
      return;
    }

    setState('processing');

    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        resolve(blob);
      };
    });
    recorder.stop();
    const blob = await stopped;
    cleanupStream();
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);

    try {
      if (blob.size < 800) {
        onError?.('التسجيل قصير جداً. اضغط مطوّلاً وتحدث ثم حرّر.');
        setState('idle');
        return;
      }

      // وضع الرسالة الصوتية الخام (واتساب-style): أرجع Blob فقط
      if (rawAudioMode) {
        onAudioReady?.({ blob, mimeType: blob.type || 'audio/webm', durationMs });
        setState('idle');
        return;
      }

      const base64 = await blobToBase64(blob);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/kotobi-voice-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          audio: base64,
          mimeType: blob.type,
          language: 'ar',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[voice] transcribe error', res.status, data);
        onError?.(data?.error || 'فشل تحويل الصوت إلى نص');
        setState('idle');
        return;
      }

      const text = (data?.text || '').trim();
      if (!text) {
        onError?.('لم يتم التعرف على أي كلام. حاول التحدث بوضوح.');
        setState('idle');
        return;
      }

      onTranscribed?.(text);
    } catch (err) {
      console.error('[voice] processing error', err);
      onError?.('حدث خطأ أثناء معالجة الصوت');
    } finally {
      setState('idle');
    }
  }, [cleanupStream, onError, onTranscribed]);

  return { state, start, stop, cancel };
};

/**
 * تنظيف النص قبل القراءة الصوتية: إزالة الرموز التي يجب ألا تُقرأ
 * مثل النجوم، الشرطات السفلية، شرطات القوائم، الإيموجي، روابط الماركداون...
 */
const cleanForSpeech = (text: string): string => {
  if (!text) return '';
  let t = text;
  t = t.replace(/<!--KOTOBI_CARDS:[\s\S]*?-->/g, ' ');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, ' ');
  t = t.replace(/[*_~#>|=`]+/g, ' ');
  t = t.replace(/[-–—]{2,}/g, ' ');
  t = t.replace(/\s-\s/g, '، ');
  t = t.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ');
  t = t.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu,
    ' ',
  );
  t = t.replace(/^[\s]*[•·▪◦●○■□]+\s*/gm, '');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\s*\n\s*/g, '. ');
  t = t.replace(/\s+([،.؟!:؛])/g, '$1');
  t = t.replace(/([،.؟!:؛])\1+/g, '$1');
  return t.trim();
};

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

const stopHtmlAudio = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = '';
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch {
      // ignore
    }
    currentAudioUrl = null;
  }
};

const stopBrowserSpeech = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
};

const fallbackBrowserSpeak = (cleaned: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = 'ar-SA';
    utter.rate = 1;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('ar'));
    if (arabicVoice) utter.voice = arabicVoice;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('[voice] fallback TTS failed', err);
  }
};

/**
 * تشغيل نص بالعربية بصوت احترافي عبر Mistral Voxtral TTS.
 * يستخدم edge function "kotobi-tts" فقط، دون الرجوع لصوت المتصفح.
 */
export const speakArabic = async (text: string) => {
  if (typeof window === 'undefined') return;
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;

  stopSpeaking();

  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !ANON_KEY) {
      console.warn('[voice] Missing Supabase config for TTS');
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/kotobi-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ text: cleaned, speed: 1.05 }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.warn('[voice] kotobi-tts failed', res.status, errorText);
      return;
    }

    const data = await res.json();
    const audioBase64: string | undefined = data?.audio;
    const mime: string = data?.mime || 'audio/mpeg';
    if (!audioBase64) {
      console.warn('[voice] kotobi-tts returned no audio payload');
      return;
    }

    // استخدام data URI لتشغيل MP3 مباشرة بدون فك base64 يدوياً
    const url = `data:${mime};base64,${audioBase64}`;
    stopHtmlAudio();
    const audio = new Audio(url);
    audio.playbackRate = 1.0;
    currentAudio = audio;
    currentAudioUrl = null;
    audio.onended = () => stopHtmlAudio();
    audio.onerror = () => {
      stopHtmlAudio();
      console.warn('[voice] Audio playback failed for generated TTS');
    };
    await audio.play();
  } catch (err) {
    console.warn('[voice] TTS request failed', err);
  }
};

export const stopSpeaking = () => {
  stopHtmlAudio();
  stopBrowserSpeech();
};
