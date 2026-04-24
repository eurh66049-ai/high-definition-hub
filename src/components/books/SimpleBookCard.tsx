
import React, { useCallback, memo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import BookImageLoader from './BookImageLoader';
import { getCategoryInArabic } from '@/utils/categoryTranslation';
import { createBookSlug } from '@/utils/bookSlug';
import { OptimizedStarRating } from './OptimizedStarRating';
import { DisplayOnlyIcon } from '@/components/icons/DisplayOnlyIcon';

interface SimpleBookCardProps {
  id: string;
  title: string;
  author: string;
  cover_image?: string;
  category: string;
  optimized_cover_url?: string;
  created_at?: string;
  display_only?: boolean;
  publisher?: string;
  compact?: boolean;
  onNavigate?: (bookPath: string) => void;
  rating?: number;
  index?: number;
  bookStats?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
  };
}

export const SimpleBookCard = memo(({ 
  id, 
  title, 
  author, 
  cover_image, 
  category,
  optimized_cover_url,
  created_at,
  display_only,
  publisher,
  onNavigate,
  compact = true,
  rating,
  index = 99,
  bookStats
}: SimpleBookCardProps) => {
  const slug = createBookSlug(title, author);
  const bookUrl = `/book/${slug}`;

  const validCoverImage = optimized_cover_url?.trim() || cover_image?.trim() || '/placeholder.svg';
  const displayTitle = title || 'عنوان غير متوفر';
  const displayAuthor = author || 'مؤلف غير معروف';

  // Check if book is new (published within last 15 days)
  const showNewBadge = created_at ? (Date.now() - new Date(created_at).getTime()) < 15 * 86400000 : false;

  const finalRating = bookStats?.average_rating || rating || 0;
  const totalReviews = bookStats?.total_reviews || 0;

  return (
    <a href={bookUrl} className="block">
      <Card className="group overflow-hidden cursor-pointer bg-card text-card-foreground rounded-lg p-2 border shadow-sm card-optimized touch-optimized hover:shadow-md">
        <CardContent className="flex flex-col items-center p-0 space-y-1.5">
          <div className="relative w-full max-w-[130px]">
            <AspectRatio ratio={3/4.5}>
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-muted">
                <BookImageLoader 
                  src={validCoverImage}
                  fallbackSrc="/placeholder.svg"
                  alt={displayTitle}
                  className="w-full h-full object-contain"
                  priority={index < 4}
                />
              </div>
            </AspectRatio>
            
            {showNewBadge && (
              <div className="absolute top-2 left-2">
                <div className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
                  جديد
                </div>
              </div>
            )}
          </div>
          
          {display_only && (
            <div className="w-full flex justify-center mt-2 mb-1">
              <DisplayOnlyIcon className="h-8 w-8 md:h-10 md:w-10" />
            </div>
          )}
          
          <p className="text-center text-card-foreground font-tajawal leading-tight max-w-full px-2 line-clamp-2" style={{ fontWeight: 400, fontSize: '15px' }} title={displayTitle}>
            {displayTitle}
          </p>
          
          <p className="text-center text-primary font-tajawal" style={{ fontWeight: 500, fontSize: '13px' }} title={displayAuthor}>
            {displayAuthor}
          </p>
          
          {publisher && (
            <p className="text-center text-muted-foreground font-tajawal text-xs" title={publisher}>
              الناشر: {publisher}
            </p>
          )}
          
          {(finalRating > 0 || totalReviews > 0) && (
            <div className="flex justify-center">
              <OptimizedStarRating
                rating={finalRating}
                totalReviews={totalReviews}
                size="sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  );
});

SimpleBookCard.displayName = 'SimpleBookCard';
