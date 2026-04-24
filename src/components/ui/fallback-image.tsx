import React, { useState, useCallback } from 'react';
import { useFileErrorReporter } from '@/hooks/useFileErrorReporter';
import { Image as ImageIcon, AlertTriangle } from 'lucide-react';

interface FallbackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bookId?: string;
  imageType?: 'cover' | 'author_image';
  fallbackSrc?: string;
  showMissingIndicator?: boolean;
}

export const FallbackImage: React.FC<FallbackImageProps> = ({
  bookId,
  imageType = 'cover',
  fallbackSrc,
  showMissingIndicator = false,
  src,
  alt,
  className = '',
  ...props
}) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [hasReported, setHasReported] = useState(false);
  const { reportImageError } = useFileErrorReporter();

  const handleError = useCallback(async (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageState('error');
    
    // تسجيل الخطأ مرة واحدة فقط
    if (bookId && imageType && !hasReported) {
      setHasReported(true);
      await reportImageError(bookId, src || '', imageType, 'فشل في تحميل الصورة');
    }
    
    // تعيين الصورة البديلة
    const img = event.currentTarget;
    const defaultFallback = imageType === 'cover' 
      ? '/src/assets/default-book-cover.png'
      : '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png';
    
    if (fallbackSrc) {
      img.src = fallbackSrc;
    } else {
      img.src = defaultFallback;
    }
    
    img.onerror = null; // منع التكرار
  }, [bookId, imageType, src, hasReported, reportImageError, fallbackSrc]);

  const handleLoad = useCallback(() => {
    setImageState('loaded');
  }, []);

  // إذا كانت الصورة مفقودة وأردنا عرض مؤشر
  if (imageState === 'error' && showMissingIndicator) {
    return (
      <div className={`bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center ${className}`}>
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <span className="text-sm text-gray-500 text-center px-2">
          {imageType === 'cover' ? 'صورة الغلاف مفقودة' : 'صورة المؤلف مفقودة'}
        </span>
        {bookId && (
          <span className="text-xs text-gray-400 mt-1">
            تم الإبلاغ للإدارة
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};