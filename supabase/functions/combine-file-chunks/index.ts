
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bucketName, fileName, totalChunks } = await req.json()

    if (!bucketName || !fileName || !totalChunks) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`بدء دمج ${totalChunks} جزء للملف ${fileName}`)

    // Download all chunks
    const chunks: Uint8Array[] = []
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileName}.part${i.toString().padStart(4, '0')}`
      
      try {
        const { data: chunkData, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(chunkFileName)
          
        if (downloadError) {
          console.error(`خطأ في تحميل الجزء ${i}:`, downloadError)
          throw new Error(`Failed to download chunk ${i}: ${downloadError.message}`)
        }
        
        if (!chunkData) {
          throw new Error(`Chunk ${i} data is null`)
        }
        
        const chunkBuffer = new Uint8Array(await chunkData.arrayBuffer())
        chunks.push(chunkBuffer)
        
        console.log(`تم تحميل الجزء ${i + 1}/${totalChunks}`)
        
      } catch (error) {
        console.error(`فشل في تحميل الجزء ${i}:`, error)
        throw error
      }
    }

    // Combine chunks
    console.log('دمج الأجزاء...')
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedFile = new Uint8Array(totalSize)
    
    let offset = 0
    for (const chunk of chunks) {
      combinedFile.set(chunk, offset)
      offset += chunk.length
    }

    console.log(`تم دمج ${chunks.length} جزء بحجم إجمالي ${totalSize} بايت`)

    // Upload the combined file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, combinedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf'
      })

    if (uploadError) {
      console.error('خطأ في رفع الملف المدمج:', uploadError)
      throw new Error(`Failed to upload combined file: ${uploadError.message}`)
    }

    // Clean up chunks
    console.log('تنظيف الأجزاء المؤقتة...')
    const deletePromises = []
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileName}.part${i.toString().padStart(4, '0')}`
      deletePromises.push(
        supabase.storage
          .from(bucketName)
          .remove([chunkFileName])
      )
    }
    
    // Wait for all deletions (but don't fail if some chunks can't be deleted)
    await Promise.allSettled(deletePromises)
    console.log('تم تنظيف الأجزاء المؤقتة')

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    const fileUrl = urlData.publicUrl
    
    console.log(`تم دمج الملف بنجاح: ${fileUrl}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileUrl,
        fileName,
        totalSize,
        chunksProcessed: totalChunks
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('خطأ في دمج الأجزاء:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to combine file chunks', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
