import React, { useState, useCallback, useMemo, useRef } from 'react';

interface BookImageLoaderProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  fallbackSrc?: string;
  maxRetries?: number;
  hideRetryButton?: boolean;
  immediateLoad?: boolean;
  optimizedSrc?: string;
  preload?: boolean;
}

// تحسين رابط Supabase - استخدام الرابط المباشر بدون تحويل
const getDirectImageUrl = (url: string): string => {
  if (!url || url === '/placeholder.svg') return url;
  return url;
};

const BookImageLoader: React.FC<BookImageLoaderProps> = ({ 
  src, 
  alt, 
  className = '',
  style,
  onLoad,
  onError,
  priority = false,
  fallbackSrc = '/placeholder.svg',
  maxRetries = 1,
  optimizedSrc,
}) => {
  // Priority images start visible to avoid delaying LCP
  const [isLoaded, setIsLoaded] = useState(priority);
  const [isError, setIsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // تحسين مصدر الصورة
  const processedSrc = useMemo(() => {
    const imageSource = optimizedSrc || src;
    
    if (!imageSource || imageSource === 'undefined' || imageSource === 'null' || imageSource.trim() === '') {
      return fallbackSrc;
    }
    
    // archive.org
    if (imageSource.includes('archive.org') && imageSource.includes('BookReader')) {
      return imageSource.includes('scale=') ? imageSource.replace(/scale=\d+/, 'scale=2') : imageSource;
    }
    
    // رفض روابط archive.org التالفة
    if (imageSource.includes('archive.org') && !imageSource.includes('BookReader') && !imageSource.includes('/download/')) {
      return fallbackSrc;
    }
    
    return getDirectImageUrl(imageSource);
  }, [src, optimizedSrc, fallbackSrc]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    
    if (retryCount < maxRetries && img.src !== fallbackSrc) {
      setRetryCount(prev => prev + 1);
      img.src = fallbackSrc;
      return;
    }
    
    setIsError(true);
    onError?.();
  }, [retryCount, maxRetries, fallbackSrc, onError]);

  return (
    <div className={`relative w-full h-full ${className}`} style={style}>
      <img
        src={processedSrc}
        alt={alt}
        width={200}
        height={267}
        className={`w-full h-full object-cover transition-opacity duration-150 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // @ts-ignore
        fetchpriority={priority ? 'high' : 'low'}
      />
      
      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-muted/30 rounded-md" />
      )}
      
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs p-2 rounded-md">
          <div className="text-center">
            <div className="text-lg mb-1">📚</div>
            <div>غلاف الكتاب</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BookImageLoader);
