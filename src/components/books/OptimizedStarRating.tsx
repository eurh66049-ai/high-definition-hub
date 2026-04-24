import React from 'react';
import { Star } from 'lucide-react';

interface OptimizedStarRatingProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export const OptimizedStarRating: React.FC<OptimizedStarRatingProps> = ({ 
  rating, 
  totalReviews = 0, 
  size = 'sm',
  showCount = true 
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const displayRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const fullStars = Math.floor(displayRating);
  const hasHalfStar = displayRating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} ${
              star <= fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : star === fullStars + 1 && hasHalfStar
                ? 'fill-yellow-200 text-yellow-400'
                : 'fill-gray-200 text-gray-300'
            }`}
          />
        ))}
      </div>
      
      {showCount && (
        <span className={`${textSizeClasses[size]} text-muted-foreground`}>
          ({totalReviews})
        </span>
      )}
    </div>
  );
};