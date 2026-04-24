import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showRating?: boolean;
  showReviewCount?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  totalReviews = 0,
  size = 'sm',
  showRating = true,
  showReviewCount = true,
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // النجوم الممتلئة
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className={cn(
            sizeClasses[size],
            "fill-red-500 text-red-500"
          )}
        />
      );
    }
    
    // نجمة نصف ممتلئة
    if (hasHalfStar) {
      stars.push(
        <div key="half" className="relative">
          <Star
            className={cn(
              sizeClasses[size],
              "text-gray-300"
            )}
          />
          <div 
            className="absolute top-0 left-0 overflow-hidden"
            style={{ width: '50%' }}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "fill-red-500 text-red-500"
              )}
            />
          </div>
        </div>
      );
    }
    
    // النجوم الفارغة
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          className={cn(
            sizeClasses[size],
            "text-gray-300"
          )}
        />
      );
    }
    
    return stars;
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center">
        {renderStars()}
      </div>
      
      {showRating && rating > 0 && (
        <span className={cn(
          "text-muted-foreground font-medium ml-1",
          textSizeClasses[size]
        )}>
          {rating.toFixed(1)}
        </span>
      )}
      
      {showReviewCount && totalReviews > 0 && (
        <span className={cn(
          "text-muted-foreground ml-1",
          textSizeClasses[size]
        )}>
          ({totalReviews})
        </span>
      )}
      
      {/* عرض النجوم الفارغة مع نص "لا توجد تقييمات" للكتب بدون تقييمات */}
      {showReviewCount && totalReviews === 0 && (
        <span className={cn(
          "text-muted-foreground ml-1",
          textSizeClasses[size]
        )}>
          (لا توجد تقييمات)
        </span>
      )}
    </div>
  );
};