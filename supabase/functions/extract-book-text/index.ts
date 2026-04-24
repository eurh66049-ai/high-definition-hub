import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Call Mistral OCR with automatic retry/backoff for 429 (rate limit) and 5xx errors.
 * Retries: 1s → 3s → 7s → 15s → 30s (exponential backoff)
 */
async function callMistralOcrWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 5
): Promise<{ ok: boolean; data?: any; error?: string; status?: number }> {
  const delays = [1000, 3000, 7000, 15000, 30000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, data, status: response.status };
      }

      const errorText = await response.text();
      const isRetryable = response.status === 429 || response.status >= 500;

      if (!isRetryable || attempt === maxRetries) {
        return {
          ok: false,
          error: `Mistral OCR error: ${response.status} - ${errorText.substring(0, 200)}`,
          status: response.status,
        };
      }

      // Honor Retry-After header if present, otherwise use backoff
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader) * 1000
        : delays[attempt];

      console.log(`⏳ Mistral ${response.status} - retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(retryAfterMs);
    } catch (err) {
      if (attempt === maxRetries) {
        return {
          ok: false,
          error: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
        };
      }
      await sleep(delays[attempt]);
    }
  }

  return { ok: false, error: 'Max retries exhausted' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookId, imageUrls, bookTable = 'approved_books' } = await req.json();

    if (!bookId) {
      throw new Error('bookId is required');
    }

    // Update status to processing
    await supabase
      .from('book_extracted_text')
      .upsert({
        book_id: bookId,
        extraction_status: 'processing',
        extracted_text: null,
        extraction_error: null,
        text_length: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'book_id' });

    // Get book data
    const { data: book, error: bookError } = await supabase
      .from(bookTable)
      .select('book_file_url, cover_image_url, title')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      throw new Error(`Book not found: ${bookError?.message || 'Unknown error'}`);
    }

    let allText = '';
    let processedPages = 0;
    const errors: string[] = [];

    // Prefer the book file (PDF) for OCR; fallback to images
    const documentUrl = book.book_file_url;
    const fallbackImages: string[] = imageUrls || [];

    if (documentUrl) {
      console.log(`📄 Running Mistral OCR on document: ${documentUrl.substring(0, 100)}...`);

      const result = await callMistralOcrWithRetry(MISTRAL_API_KEY, {
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          document_url: documentUrl,
        },
        include_image_base64: false,
        image_limit: 0,
      });

      if (!result.ok) {
        console.error('Mistral OCR failed after retries:', result.error);
        errors.push(result.error || 'OCR failed');
      } else {
        const pages = result.data?.pages || [];
        for (const page of pages) {
          const pageText = page.markdown || page.text || '';
          if (pageText.trim()) {
            processedPages++;
            allText += `\n--- صفحة ${processedPages} ---\n${pageText}\n`;
          }
        }
        console.log(`✅ Mistral OCR: extracted ${processedPages} pages, ${allText.length} chars`);
      }
    }

    // Fallback: OCR on images if document OCR didn't produce text
    if (!allText.trim() && (fallbackImages.length > 0 || book.cover_image_url)) {
      const imagesToProcess = fallbackImages.length > 0 ? fallbackImages : [book.cover_image_url].filter(Boolean) as string[];

      console.log(`🖼️ Fallback: running Mistral OCR on ${imagesToProcess.length} image(s)`);

      for (const imageUrl of imagesToProcess) {
        const result = await callMistralOcrWithRetry(MISTRAL_API_KEY, {
          model: 'mistral-ocr-latest',
          document: {
            type: 'image_url',
            image_url: imageUrl,
          },
          include_image_base64: false,
        });

        if (!result.ok) {
          errors.push(`Image OCR error: ${result.error}`);
          continue;
        }

        const pages = result.data?.pages || [];
        for (const page of pages) {
          const pageText = page.markdown || page.text || '';
          if (pageText.trim()) {
            processedPages++;
            allText += `\n--- صفحة ${processedPages} ---\n${pageText}\n`;
          }
        }

        // Small gap between image requests to be polite to the API
        await sleep(500);
      }
    }

    const finalStatus = allText.trim() ? 'completed' : 'failed';
    const finalError = errors.length > 0 ? errors.join('; ') : null;

    await supabase
      .from('book_extracted_text')
      .upsert({
        book_id: bookId,
        extracted_text: allText.trim() || null,
        extraction_status: finalStatus,
        extraction_error: finalError,
        text_length: allText.trim().length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'book_id' });

    const success = finalStatus === 'completed';

    return new Response(
      JSON.stringify({
        success,
        bookId,
        processedPages,
        textLength: allText.trim().length,
        status: finalStatus,
        error: success ? undefined : (finalError || 'لم يتم استخراج أي نص من الكتاب'),
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract text error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
