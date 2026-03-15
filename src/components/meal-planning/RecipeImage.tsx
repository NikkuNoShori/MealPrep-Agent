import { useState, useCallback } from 'react';
import { UtensilsCrossed } from 'lucide-react';

const RecipeImage = ({ src, alt, size }: { src?: string; alt: string; size: 'sm' | 'lg' }) => {
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => setFailed(true), []);

  const sizeClasses = size === 'lg'
    ? 'w-28 h-28 rounded-xl'
    : 'w-12 h-12 rounded-lg';
  const iconSize = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';

  if (!src || failed) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-stone-100 to-stone-50 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center flex-shrink-0`}>
        <UtensilsCrossed className={`${iconSize} text-stone-300 dark:text-gray-600`} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={`${sizeClasses} object-cover ${size === 'lg' ? 'shadow-md' : 'shadow-sm group-hover:shadow-md transition-shadow'} flex-shrink-0`}
    />
  );
};

export default RecipeImage;
