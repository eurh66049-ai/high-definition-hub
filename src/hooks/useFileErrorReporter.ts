import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useFileErrorReporter = () => {
  
  // تسجيل خطأ في تحميل الصورة
  const reportImageError = useCallback(async (
    bookId: string,
    imageUrl: string,
    imageType: 'cover' | 'author_image',
    errorMessage?: string
  ) => {
    try {
      console.warn(`⚠️ خطأ في تحميل ${imageType === 'cover' ? 'غلاف' : 'صورة مؤلف'} الكتاب:`, bookId);
      
      // تسجيل الخطأ في قاعدة البيانات
      const { error } = await supabase
        .rpc('log_missing_file', {
          p_book_id: bookId,
          p_file_url: imageUrl,
          p_file_type: imageType,
          p_error_message: errorMessage || `فشل في تحميل ${imageType === 'cover' ? 'صورة الغلاف' : 'صورة المؤلف'}`
        });
      
      if (error) {
        console.error('فشل في تسجيل خطأ الصورة:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('خطأ في تسجيل خطأ الصورة:', err);
      return false;
    }
  }, []);

  // تسجيل خطأ في تحميل PDF
  const reportPDFError = useCallback(async (
    bookId: string,
    pdfUrl: string,
    errorMessage?: string
  ) => {
    try {
      console.warn(`⚠️ خطأ في تحميل PDF للكتاب:`, bookId);
      
      const { error } = await supabase
        .rpc('log_missing_file', {
          p_book_id: bookId,
          p_file_url: pdfUrl,
          p_file_type: 'pdf',
          p_error_message: errorMessage || 'فشل في تحميل ملف PDF'
        });
      
      if (error) {
        console.error('فشل في تسجيل خطأ PDF:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('خطأ في تسجيل خطأ PDF:', err);
      return false;
    }
  }, []);

  // التحقق من وجود ملف في التخزين
  const checkFileExists = useCallback(async (fileUrl: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .rpc('check_file_exists_in_storage', { file_url: fileUrl });
      
      if (error) {
        console.error('خطأ في التحقق من وجود الملف:', error);
        return false;
      }
      
      return data as boolean;
    } catch (err) {
      console.error('خطأ في التحقق من وجود الملف:', err);
      return false;
    }
  }, []);

  // معالج صورة محسن مع تسجيل الأخطاء
  const createImageErrorHandler = useCallback((
    bookId: string,
    imageType: 'cover' | 'author_image'
  ) => {
    return async (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = event.currentTarget;
      const imageUrl = img.src;
      
      // تسجيل الخطأ
      await reportImageError(bookId, imageUrl, imageType, `HTTP ${img.naturalWidth === 0 ? '404' : 'Load Error'}`);
      
      // تعيين صورة بديلة
      const fallbackImage = imageType === 'cover' 
        ? '/src/assets/default-book-cover.png'
        : '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png';
      
      img.src = fallbackImage;
      img.onerror = null; // منع التكرار
    };
  }, [reportImageError]);

  return {
    reportImageError,
    reportPDFError,
    checkFileExists,
    createImageErrorHandler
  };
};