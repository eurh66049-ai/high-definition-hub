import React, { useState, useEffect, useCallback } from 'react';
import { formatViewCount } from '@/utils/formatUtils';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useBookDetails } from '@/hooks/useBookDetails';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';
import { NavigationHistoryManager } from '@/utils/navigationHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookOpen, ArrowRight, Download, Heart, Share2, Copy, Facebook, Twitter, MessageCircle, Link, Send, MoreVertical, ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import BookImageLoader from '@/components/books/BookImageLoader';
import BookReviews from '@/components/books/BookReviews';
import AuthorInfoCard from '@/components/books/AuthorInfoCard';
import BookShareButtons from '@/components/books/BookShareButtons';
import { SocialIcons } from '@/components/ui/social-icons';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { toast } from 'sonner';
import { getCategoryInArabic } from '@/utils/categoryTranslation';
import { getLanguageInArabic } from '@/utils/languageTranslation';
import { addRecentlyViewed } from '@/utils/recentlyViewedUtils';
import RecentlyViewedBooks from '@/components/books/RecentlyViewedBooks';
import SimilarBooks from '@/components/books/SimilarBooks';
import { supabase } from '@/integrations/supabase/client';
import { StarRating } from '@/components/ui/star-rating';
import { useBookReviewStats } from '@/hooks/useBookReviewStats';
import { BookLikeDislikeButtons } from '@/components/books/BookLikeDislikeButtons';
import { BookQuoteForm } from '@/components/quotes/BookQuoteForm';
import { useBookDownloads } from '@/hooks/useBookDownloads';
import { useDynamicSEO } from '@/hooks/useDynamicSEO';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { parseBookSlug } from '@/utils/bookSlug';
import { optimizeImageUrl, resolvePdfDownloadUrl } from '@/utils/imageProxy';
import { useStories } from '@/hooks/useStories';
import { useBookPopularityRank } from '@/hooks/useBookPopularityRank';
import BookPopularityRank from '@/components/books/BookPopularityRank';

const BookDetailsContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { book, loading, error } = useBookDetails(id!);
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { stats: reviewStats, loading: reviewStatsLoading } = useBookReviewStats(book?.id || '');
  const { downloads, loading: downloadsLoading, recordDownload } = useBookDownloads(book?.id || '');
  const { navigateToBook, goToPreviousState } = useNavigationHistory({
    autoSave: false,
    handleBrowserBack: false
  });
  const { addStory, uploading: storyUploading } = useStories();
  const { rank: popularityRank, loading: rankLoading } = useBookPopularityRank(book?.id);

  // إعادة توجيه من UUID إلى slug لتوحيد الروابط وتحسين SEO
  useEffect(() => {
    if (book?.slug && id && book.slug !== id) {
      // إذا تم الوصول للكتاب عبر UUID بينما يوجد slug، نعيد التوجيه للـ slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        console.log('إعادة توجيه من UUID إلى slug:', id, '->', book.slug);
        navigate(`/book/${book.slug}`, { replace: true });
      }
    }
  }, [book?.slug, id, navigate]);

  // معالجة زر الرجوع في المتصفح
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log('تم الضغط على زر الرجوع في صفحة تفاصيل الكتاب');
      
      goToPreviousState().then((restored) => {    
        if (!restored) {    
          console.log('لا توجد حالة محفوظة، العودة للصفحة الرئيسية');    
          navigate('/', { replace: true });    
        }    
      }).catch((error) => {    
        console.error('خطأ في معالجة زر الرجوع:', error);    
        navigate('/', { replace: true });    
      });    
    };    

    window.addEventListener('popstate', handlePopState);    
    return () => {    
      window.removeEventListener('popstate', handlePopState);    
    };
  }, [goToPreviousState, navigate]);

  // إضافة خاصية تحديث الصفحة عند تغيير الكتاب
  usePageRefresh({
    refreshOnBookChange: true,
    refreshOnCategoryChange: false,
    refreshOnAuthorChange: false,
    excludePaths: ['/auth', '/upload-book', '/admin', '/book/reading'],
    delay: 200
  });

  // إنشاء الرابط الأساسي (canonical) الثابت للكتاب
  const getReadableIdentifier = () => {
    const rawIdentifier = book?.slug || book?.id || id || '';
    try {
      return decodeURIComponent(rawIdentifier);
    } catch {
      return rawIdentifier;
    }
  };

  const getCanonicalUrl = () => {
    const baseUrl = 'https://kotobi.xyz';
    return `${baseUrl}/book/${getReadableIdentifier()}`;
  };

  // رابط مشاركة واضح بدون ترميز percent-encoding
  const getShareableUrl = () => {
    const baseUrl = 'https://kotobi.xyz';
    const readableIdentifier = getReadableIdentifier();
    if (readableIdentifier) {
      return `${baseUrl}/book/${readableIdentifier}`;
    }
    return decodeURI(window.location.href);
  };

  const canonicalUrl = book ? getCanonicalUrl() : `https://kotobi.xyz/book/${decodeURIComponent(id || '')}`;
  const shareableUrl = getShareableUrl();

  // URL للمشاركة

  // دالة التحقق من صورة الغلاف
  const validateCoverImage = () => {
    if (!book?.cover_image_url || book.cover_image_url === 'undefined' || book.cover_image_url === 'null') {
      return '/src/assets/default-book-cover.png';
    }
    return book.cover_image_url;
  };

  // استخدام hook الـ SEO الديناميكي
  useDynamicSEO({
    title: book ? `${book.title} - ${book.author} | منصة كتبي` : undefined,
    description: book ? `اكتشف كتاب "${book.title}" للمؤلف ${book.author}. ${book.description ? book.description.substring(0, 140) : 'اقرأ وحمل مجاناً من منصة كتبي - المكتبة الرقمية العربية'}` : undefined,
    keywords: book ? `${book.title}, ${book.author}, ${getCategoryInArabic(book.category)}, كتب عربية مجانية, قراءة اونلاين, تحميل كتب PDF, منصة كتبي` : undefined,
    image: book ? validateCoverImage() : undefined,
    url: canonicalUrl,
    type: 'book',
    author: book?.author,
    book: book ? {
      title: book.title,
      author: book.author,
      description: book.description,
      category: getCategoryInArabic(book.category),
      coverImage: validateCoverImage(),
      publisher: book.publisher,
      pageCount: book.page_count,
      language: book.language || 'ar',
      publicationYear: book.publication_year,
      rating: reviewStats?.average_rating,
      reviewCount: reviewStats?.total_reviews
    } : undefined
  });

  useEffect(() => {
    if (book) {
      addRecentlyViewed({
        id: book.id,
        title: book.title,
        author: book.author,
        cover_image_url: validateCoverImage(),
      });
    }
  }, [book]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [id]);

  // دالة تنسيق حجم الملف باستخدام الحجم الفعلي من قاعدة البيانات
  const formatFileSize = (fileSize?: number, pageCount?: number) => {
    if (fileSize && fileSize > 0) {
      if (fileSize >= 1024 * 1024) {
        return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
      } else if (fileSize >= 1024) {
        return `${(fileSize / 1024).toFixed(1)} KB`;
      }
      return `${fileSize} B`;
    }

    if (!pageCount) return '2.5 MB';    
    const estimatedSizeKB = pageCount * 30;    
    if (estimatedSizeKB >= 1024) {    
      return `${(estimatedSizeKB / 1024).toFixed(1)} MB (تقديري)`;    
    }    
    return `${estimatedSizeKB} KB (تقديري)`;
  };

  // دالة تنسيق التاريخ باللغة العربية مع أرقام إنجليزية
  const formatDateArabic = (dateString?: string) => {
    if (!dateString) return null;

    try {    
      const date = new Date(dateString);    
      const arabicMonths = [    
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',    
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'    
      ];    

      const day = date.getDate();    
      const month = arabicMonths[date.getMonth()];    
      const year = date.getFullYear();    

      return `${day} ${month} ${year}`;    
    } catch (error) {    
      console.error('Error formatting date:', error);    
      return null;    
    }
  };

  // دالة المشاركة
  const handleShare = async () => {
    const shareData = {
      title: book?.title || 'كتاب',
      text: `اطلع على كتاب "${book?.title}" للمؤلف ${book?.author}`,
      url: shareableUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('تم مشاركة الكتاب بنجاح!');
      } else {
        await navigator.clipboard.writeText(shareableUrl);
        toast.success('تم نسخ رابط الكتاب إلى الحافظة!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      try {
        await navigator.clipboard.writeText(shareableUrl);
        toast.success('تم نسخ رابط الكتاب إلى الحافظة!');
      } catch (clipboardError) {
        toast.error('فشل في مشاركة الكتاب');
      }
    }
  };

  // دالة التعامل مع الحفظ/إزالة من المفضلة
  const handleFavoriteToggle = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لحفظ الكتب');
      const redirectPath = location.pathname + location.search;
      console.log('حفظ مسار الإعادة التوجيه:', redirectPath);
      localStorage.setItem('auth_redirect_path', redirectPath);
      navigate('/auth');
      return;
    }

    if (!book) return;    

    try {    
      if (isFavorite(book.id)) {    
        await removeFromFavorites(book.id);    
        toast.success('تم إزالة الكتاب من المفضلة');    
      } else {    
        await addToFavorites(book.id);    
        toast.success('تم إضافة الكتاب للمفضلة');    
      }    
    } catch (error) {    
      console.error('خطأ في التعامل مع المفضلة:', error);    
      toast.error('حدث خطأ، حاول مرة أخرى');    
    }
  };

  // دالة للانتقال لقراءة الكتاب
  const handleReadBook = async () => {
    if (book) {
      navigateToBook(`/book/reading/${book.slug || id}`);
    }
  };

  const getFileExtension = (fileType?: string, fileUrl?: string) => {
    switch (fileType) {
      case 'text/plain':
        return '.txt';
      case 'application/msword':
        return '.doc';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      case 'application/pdf':
        return '.pdf';
      default: {
        if (!fileUrl) return '.pdf';
        const urlParts = fileUrl.split('.');
        return urlParts.length > 1 ? `.${urlParts[urlParts.length - 1].split('?')[0]}` : '.pdf';
      }
    }
  };

  const handleDirectDownload = useCallback(async () => {
    if (!book?.book_file_url) {
      return;
    }

    setIsDownloading(true);
    try {
      const sourceUrl = resolvePdfDownloadUrl(book.book_file_url);
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        throw new Error('فشل في تحميل الملف');
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error('الملف فارغ');
      }

      const extension = getFileExtension(book.file_type, book.book_file_url);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${book.title} - kotobi${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      await recordDownload();

      if (user) {
        await supabase.from('user_downloads').upsert({
          user_id: user.id,
          book_id: String(book.id),
          book_title: book.title,
          book_author: book.author || null,
          book_cover_url: validateCoverImage() || null,
          book_slug: book.slug || null,
          downloaded_at: new Date().toISOString(),
        }, { onConflict: 'user_id,book_id' });
      }

      toast.success('تم تحميل الكتاب بنجاح');
    } catch (error) {
      console.error('خطأ في التحميل المباشر:', error);
      toast.error('تعذر تحميل الكتاب الآن، تأكد من توفر الملف ثم حاول مجددًا');
    } finally {
      setIsDownloading(false);
    }
  }, [book, recordDownload, user]);

  // دالة النسخ إلى الحافظة
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      toast.success('تم نسخ رابط الكتاب إلى الحافظة!');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('فشل في نسخ الرابط');
    }
  };

  // دالة المشاركة على فيسبوك - رابط فقط
  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  // دالة المشاركة على تويتر - رابط فقط
  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareableUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  // دالة المشاركة على واتساب - رابط فقط
  const handleWhatsappShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareableUrl)}`;
    window.open(url, '_blank');
  };

  // State for showing more social options
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // دالة إنشاء صورة ستوري
  const generateStoryImage = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas not supported');

      const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      bgGradient.addColorStop(0, '#1a1a2e');
      bgGradient.addColorStop(0.5, '#16213e');
      bgGradient.addColorStop(1, '#0f3460');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 1080, 1920);

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.arc(900, 200, 300, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#533483';
      ctx.beginPath();
      ctx.arc(180, 1700, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? currentLine + ' ' + word : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines.slice(0, 3);
      };

      const drawContent = (coverImg?: HTMLImageElement) => {
        const coverWidth = 500;
        const coverHeight = 720;
        const coverX = (1080 - coverWidth) / 2;
        const coverY = 280;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 15;

        const radius = 20;
        ctx.beginPath();
        ctx.moveTo(coverX + radius, coverY);
        ctx.lineTo(coverX + coverWidth - radius, coverY);
        ctx.quadraticCurveTo(coverX + coverWidth, coverY, coverX + coverWidth, coverY + radius);
        ctx.lineTo(coverX + coverWidth, coverY + coverHeight - radius);
        ctx.quadraticCurveTo(coverX + coverWidth, coverY + coverHeight, coverX + coverWidth - radius, coverY + coverHeight);
        ctx.lineTo(coverX + radius, coverY + coverHeight);
        ctx.quadraticCurveTo(coverX, coverY + coverHeight, coverX, coverY + coverHeight - radius);
        ctx.lineTo(coverX, coverY + radius);
        ctx.quadraticCurveTo(coverX, coverY, coverX + radius, coverY);
        ctx.closePath();

        if (coverImg) {
          ctx.save();
          ctx.clip();
          ctx.drawImage(coverImg, coverX, coverY, coverWidth, coverHeight);
          ctx.restore();
        } else {
          const placeholderGradient = ctx.createLinearGradient(coverX, coverY, coverX + coverWidth, coverY + coverHeight);
          placeholderGradient.addColorStop(0, '#533483');
          placeholderGradient.addColorStop(1, '#e94560');
          ctx.fillStyle = placeholderGradient;
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '120px serif';
          ctx.textAlign = 'center';
          ctx.fillText('📖', coverX + coverWidth / 2, coverY + coverHeight / 2 + 40);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 52px Cairo, Tajawal, Arial';
        ctx.direction = 'rtl';
        const titleY = coverY + coverHeight + 100;
        const titleLines = wrapText(book?.title || '', 900);
        titleLines.forEach((line, i) => {
          ctx.fillText(line, 540, titleY + i * 65);
        });

        const authorY = titleY + titleLines.length * 65 + 30;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '38px Cairo, Tajawal, Arial';
        ctx.fillText(book?.author || '', 540, authorY);

        if (book?.category) {
          const categoryY = authorY + 70;
          const categoryText = getCategoryInArabic(book.category);
          ctx.font = '30px Cairo, Tajawal, Arial';
          const textWidth = ctx.measureText(categoryText).width;
          const badgeWidth = textWidth + 60;
          const badgeX = (1080 - badgeWidth) / 2;
          ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';
          ctx.beginPath();
          ctx.roundRect(badgeX, categoryY - 30, badgeWidth, 50, 25);
          ctx.fill();
          ctx.strokeStyle = 'rgba(233, 69, 96, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#e94560';
          ctx.fillText(categoryText, 540, categoryY + 5);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '26px Cairo, Tajawal, Arial';
        ctx.fillText('📚 kotobi.xyz', 540, 1790);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject('Failed to generate image');
        }, 'image/png', 1.0);
      };

      if (book?.cover_image_url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => drawContent(img);
        img.onerror = () => drawContent();
        img.src = book.cover_image_url;
      } else {
        drawContent();
      }
    });
  };

  // دالة المشاركة بالستوري الخاص بالموقع
  const handleStoryShare = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لمشاركة الكتاب بالستوري');
      navigate('/auth');
      return;
    }

    setGeneratingStory(true);
    try {
      const blob = await generateStoryImage();
      const file = new File([blob], `kotobi-book-${book?.slug || book?.id}.png`, { type: 'image/png' });
      const caption: string | undefined = undefined;
      
      const result = await addStory(file, caption, { bookId: book?.id || '', bookSlug: book?.slug || '' });
      if (result) {
        toast.success('تم نشر الكتاب في ستوري بنجاح!');
      }
    } catch (error: any) {
      console.error('Error sharing to story:', error);
      toast.error('فشل في نشر الستوري');
    } finally {
      setGeneratingStory(false);
    }
  };

  // دالة المشاركة على تيليجرام - رابط فقط
  const handleTelegramShare = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareableUrl)}`;
    window.open(url, '_blank');
  };

  // دالة المشاركة عبر البريد الإلكتروني
  const handleEmailShare = () => {
    const subject = `كتاب "${book?.title}" للمؤلف ${book?.author}`;
    const body = `اكتشف هذا الكتاب الرائع:\n\n${shareableUrl}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-book-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">جاري تحميل تفاصيل الكتاب...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center min-h-[400px] flex items-center justify-center">
            <div>
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">الكتاب غير موجود</h2>
              <p className="text-muted-foreground mb-4">{error || 'لم يتم العثور على الكتاب المطلوب'}</p>
              <Button onClick={() => navigate('/')} variant="outline">
                العودة للصفحة الرئيسية
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0">
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{`${book.title || 'كتاب'} - ${book.author || 'المؤلف'} | منصة كتبي`}</title>
        <meta name="description" content={`اكتشف كتاب "${book.title}" للمؤلف ${book.author}. ${book.description ? book.description.substring(0, 140) : 'اقرأ وحمل مجاناً من منصة كتبي - المكتبة الرقمية العربية'}`} />
        <meta name="author" content={book.author} />
        <meta name="keywords" content={`${book.title}, ${book.author}, ${getCategoryInArabic(book.category)}, كتب عربية مجانية, قراءة اونلاين, تحميل كتب PDF, منصة كتبي`} />
        <meta name="language" content="Arabic" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />

        {/* Canonical URL - رابط أساسي ثابت */}    
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph Meta Tags */}    
        <meta property="og:title" content={`${book.title} - ${book.author} | منصة كتبي`} />    
        <meta property="og:description" content={`اكتشف كتاب "${book.title}" للمؤلف ${book.author}. ${book.description ? book.description.substring(0, 140) : 'اقرأ وحمل مجاناً من منصة كتبي - المكتبة الرقمية العربية'}`} />    
        <meta property="og:image" content={validateCoverImage().startsWith('http') ? validateCoverImage() : `https://kotobi.xyz${validateCoverImage()}`} />    
        <meta property="og:image:width" content="1200" />    
        <meta property="og:image:height" content="630" />    
        <meta property="og:image:alt" content={`غلاف كتاب ${book.title} للمؤلف ${book.author}`} />    
        <meta property="og:url" content={canonicalUrl} />    
        <meta property="og:type" content="book" />    
        <meta property="og:site_name" content="منصة كتبي - المكتبة الرقمية العربية المجانية" />    
        <meta property="og:locale" content="ar_AR" />    

        {/* Book specific Open Graph */}    
        <meta property="book:author" content={book.author} />    
        <meta property="book:isbn" content={book.id} />    
        <meta property="book:release_date" content={book.created_at} />    
        <meta property="book:tag" content={getCategoryInArabic(book.category)} />    

        {/* Twitter Card Meta Tags */}    
        <meta name="twitter:card" content="summary_large_image" />    
        <meta name="twitter:site" content="@kotobi_app" />    
        <meta name="twitter:creator" content="@kotobi_app" />    
        <meta name="twitter:title" content={`${book.title} - ${book.author} | منصة كتبي`} />    
        <meta name="twitter:description" content={`اكتشف كتاب "${book.title}" للمؤلف ${book.author}. ${book.description ? book.description.substring(0, 140) : 'اقرأ وحمل مجاناً من منصة كتبي'}`} />    
        <meta name="twitter:image" content={validateCoverImage().startsWith('http') ? validateCoverImage() : `https://kotobi.xyz${validateCoverImage()}`} />    
        <meta name="twitter:image:alt" content={`غلاف كتاب ${book.title} للمؤلف ${book.author}`} />    

        {/* Additional SEO Meta Tags */}    
        <meta name="format-detection" content="telephone=no" />    
        <meta name="theme-color" content="#dc2626" />    
        <meta name="apple-mobile-web-app-capable" content="yes" />    
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />    

        {/* Structured Data JSON-LD */}    
        <script type="application/ld+json">    
          {JSON.stringify({    
            "@context": "https://schema.org",    
            "@type": "Book",    
            "name": book.title,    
            "author": {    
              "@type": "Person",    
              "name": book.author    
            },    
            "description": book.description || `كتاب ${book.title} للمؤلف ${book.author} - متاح للقراءة والتحميل مجاناً`,    
            "image": validateCoverImage().startsWith('http') ? validateCoverImage() : `https://kotobi.xyz${validateCoverImage()}`,    
            "genre": getCategoryInArabic(book.category),    
            "inLanguage": book.language || "ar",    
            "numberOfPages": book.page_count,    
            "datePublished": book.publication_year ? `${book.publication_year}-01-01` : book.created_at,    
            "publisher": {    
              "@type": "Organization",    
              "name": book.publisher || "منصة كتبي"    
            },    
            "offers": {    
              "@type": "Offer",    
              "price": "0",    
              "priceCurrency": "USD",    
              "availability": "https://schema.org/InStock"    
            },    
            "url": canonicalUrl,    
            "isAccessibleForFree": true,    
            ...(reviewStats?.average_rating && {    
              "aggregateRating": {    
                "@type": "AggregateRating",    
                "ratingValue": reviewStats.average_rating,    
                "ratingCount": reviewStats.total_reviews,    
                "bestRating": 5,    
                "worstRating": 1    
              }    
            })    
          })}    
        </script>    
      </Helmet>    

      <Navbar />    

      <div className="container mx-auto px-4 py-8">    
        {/* مسارات التنقل */}    
        <Breadcrumbs     
          items={[    
            {    
              label: book?.author || 'مؤلف',    
              href: `/author/${encodeURIComponent(book?.author || '')}`    
            },    
            {    
              label: getCategoryInArabic(book?.category || ''),    
              href: `/category/${encodeURIComponent(getCategoryInArabic(book?.category || ''))}`    
            },    
            {    
              label: book?.title || 'تفاصيل الكتاب',    
              active: true    
            }    
          ]}    
          className="mb-6"    
        />    

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">    
          {/* معلومات الكتاب الأساسية - مع تأثير الشفافية */}
          <div className="lg:col-span-2">    
            <Card className="overflow-hidden bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-xl">
              <CardContent className="p-4">    
                {/* صورة الكتاب والمعلومات الأساسية في الوسط */}    
                <div className="text-center mb-4">    
                  {/* صورة الكتاب */}    
                  <div className="w-36 mx-auto mb-4">    
                    <AspectRatio ratio={3/4} className="bg-muted rounded-lg overflow-hidden">    
                      <BookImageLoader     
                        src={validateCoverImage()}    
                        fallbackSrc="/src/assets/default-book-cover.png"    
                        alt={`غلاف كتاب ${book.title}`}    
                        className="w-full h-full object-cover"    
                        priority={true}    
                        maxRetries={2}    
                        hideRetryButton={false}    
                        immediateLoad={true}    
                      />    
                    </AspectRatio>    
                  </div>    

                  {/* عنوان الكتاب */}    
                  <h1 className="text-xl font-bold text-foreground font-tajawal mb-2">    
                    {book.title}    
                  </h1>    

                  {/* اسم المؤلف */}    
                  <div className="mb-2">    
                    <span className="text-sm text-white font-tajawal font-bold">المؤلف: </span>    
                    <span className="text-sm text-primary font-tajawal font-bold">    
                      {book.author}    
                    </span>    
                  </div>    

                  {/* اسم الناشر */}    
                  {book.publisher && (    
                    <div className="mb-2">    
                      <span className="text-sm text-white font-tajawal font-bold">الناشر: </span>    
                      <span className="text-sm text-primary font-tajawal font-bold">    
                        {book.publisher}    
                      </span>    
                    </div>    
                  )}    

                  {/* نجوم التقييم */}    
                  <div className="mb-2">    
                    {!reviewStatsLoading && (    
                      <StarRating    
                        rating={reviewStats?.average_rating || 0}    
                        totalReviews={reviewStats?.total_reviews || 0}    
                        size="sm"    
                        showRating={true}    
                        showReviewCount={true}    
                        className="justify-center"    
                      />    
                    )}    
                  </div>    

                  {/* إحصائيات */}    
                  <div className="flex items-center justify-center gap-3 mb-4">    
                    {book.views && book.views > 0 && (    
                      <div className="flex items-center gap-1">    
                        <BookOpen className="h-3 w-3 text-muted-foreground" />    
                        <span className="text-xs text-muted-foreground">{formatViewCount(book.views)} مشاهدة</span>    
                      </div>    
                    )}    
                    {!downloadsLoading && downloads > 0 && (    
                      <div className="flex items-center gap-1">    
                        <Download className="h-3 w-3 text-muted-foreground" />    
                        <span className="text-xs text-muted-foreground">{downloads} تنزيل</span>    
                      </div>    
                    )}    
                  </div>    

                  {/* أزرار التفاعل */}    
                  <div className="space-y-2 max-w-sm mx-auto">    
                    {/* زر قراءة الكتاب */}    
                    {book.book_file_url && book.display_type !== 'no_access' && (    
                      <Button     
                        className="w-full bg-book-primary hover:bg-book-primary/80 text-white font-cairo text-base py-3 rounded-2xl border-0 shadow-md hover:shadow-lg transition-all duration-300"    
                        onClick={handleReadBook}    
                        size="default"    
                      >    
                        قراءة الكتاب
                      </Button>    
                    )}

                    {/* رسالة عدم الإتاحة */}    
                    {book.display_type === 'no_access' && (    
                      <div className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">    
                        <div className="text-gray-600 dark:text-gray-400 mb-1 font-cairo text-sm">    
                          🔒 غير متاح للقراءة أو التحميل    
                        </div>    
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-cairo">    
                          المؤلف لم يوافق على إتاحة هذا الكتاب للقراءة العامة حالياً    
                        </p>    
                      </div>    
                    )}    

                    {/* أزرار التحميل والحفظ والإعجاب */}    
                    {book.display_type !== 'no_access' && (    
                      <>    
                        {/* للكتب التي تسمح بالتحميل */}    
                        {book.book_file_url && (book.display_type !== 'read_only') && (    
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">    
                              <Button
                                onClick={handleDirectDownload}
                                disabled={isDownloading}
                                className="w-full bg-muted hover:bg-muted/80 text-foreground font-cairo text-sm py-2 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                              >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تحميل'}
                              </Button>

                              <Button     
                                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-cairo text-sm py-2 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"    
                                onClick={handleFavoriteToggle}    
                              >    
                                {isFavorite(book.id) ? 'محفوظ' : 'حفظ'}    
                              </Button>    

                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-cairo text-sm py-2 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                                  >
                                    مشاركة
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3 bg-background border border-border z-50" align="center">
                                  <div className="space-y-2">
                                    <h4 className="font-cairo font-bold text-center text-foreground text-sm mb-2">مشاركة الكتاب</h4>
                                    
                                    <div className="grid grid-cols-5 gap-2">
                                      <button onClick={handleFacebookShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#1877F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Facebook className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleTwitterShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#1DA1F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Twitter className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleWhatsappShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <MessageCircle className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleTelegramShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#0088cc] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Send className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleStoryShare} disabled={generatingStory || storyUploading} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group" title="شارك بالستوري">
                                        <div className={`w-8 h-8 bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${(generatingStory || storyUploading) ? 'animate-pulse' : ''}`}>
                                          {(generatingStory || storyUploading) ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="12" cy="12" r="10" />
                                              <line x1="12" y1="8" x2="12" y2="16" />
                                              <line x1="8" y1="12" x2="16" y2="12" />
                                            </svg>
                                          )}
                                        </div>
                                      </button>
                                    </div>

                                    <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 p-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs font-cairo text-foreground">نسخ الرابط</span>
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            {/* أزرار الإعجاب وعدم الإعجاب */}
                            <BookLikeDislikeButtons
                              bookId={book.id}
                              size="sm"
                              showCount={true}
                              className="justify-center"
                              likeClassName="bg-muted hover:bg-muted/80 text-foreground font-cairo text-sm py-2 px-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                              dislikeClassName="bg-muted hover:bg-muted/80 text-foreground font-cairo text-sm py-2 px-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                            />
                          </div>
                        )}

                        {/* للكتب للقراءة فقط */}    
                        {book.display_type === 'read_only' && (    
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button     
                                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-cairo text-sm py-2 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"    
                                onClick={handleFavoriteToggle}    
                              >    
                                {isFavorite(book.id) ? 'محفوظ' : 'حفظ'}    
                              </Button>    

                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-cairo text-sm py-2 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                                  >
                                    مشاركة
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3 bg-background border border-border z-50" align="center">
                                  <div className="space-y-2">
                                    <h4 className="font-cairo font-bold text-center text-foreground text-sm mb-2">مشاركة الكتاب</h4>
                                    
                                    <div className="grid grid-cols-5 gap-2">
                                      <button onClick={handleFacebookShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#1877F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Facebook className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleTwitterShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#1DA1F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Twitter className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleWhatsappShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <MessageCircle className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleTelegramShare} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="w-8 h-8 bg-[#0088cc] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Send className="h-4 w-4 text-white" />
                                        </div>
                                      </button>
                                      <button onClick={handleStoryShare} disabled={generatingStory || storyUploading} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors group" title="شارك بالستوري">
                                        <div className={`w-8 h-8 bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${(generatingStory || storyUploading) ? 'animate-pulse' : ''}`}>
                                          {(generatingStory || storyUploading) ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="12" cy="12" r="10" />
                                              <line x1="12" y1="8" x2="12" y2="16" />
                                              <line x1="8" y1="12" x2="16" y2="12" />
                                            </svg>
                                          )}
                                        </div>
                                      </button>
                                    </div>

                                    <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 p-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs font-cairo text-foreground">نسخ الرابط</span>
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            {/* أزرار الإعجاب وعدم الإعجاب */}
                            <BookLikeDislikeButtons
                              bookId={book.id}
                              size="sm"
                              showCount={true}
                              className="justify-center"
                              likeClassName="bg-muted hover:bg-muted/80 text-foreground font-cairo text-sm py-2 px-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                              dislikeClassName="bg-muted hover:bg-muted/80 text-foreground font-cairo text-sm py-2 px-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300"
                            />
                          </div>
                        )}
                      </>    
                    )}    

                    {/* زر إضافة اقتباس */}    
                    <div className="mt-3">    
                      <BookQuoteForm book={book} />    
                    </div>    
                  </div>
                </div>    
              </CardContent>    
            </Card>    
          </div>    

          {/* الشريط الجانبي - مع تأثير الشفافية */}
          <div className="space-y-6">    
            {/* كارد نبذة عن الكتاب والمشاركة */}
            <Card className="bg-card/90 backdrop-blur-md text-foreground border border-border shadow-lg rounded-2xl">
              <CardHeader className="text-center pb-4">    
                <CardTitle className="text-xl font-bold font-amiri text-center relative">    
                  نبذة عن الكتاب    
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-primary mt-2"></div>    
                </CardTitle>    
              </CardHeader>    
              <CardContent className="px-6 pb-6">    
                {/* إحصائيات الكتاب - عرض ديناميكي بناءً على البيانات المتوفرة */}    
                <div className={`flex items-center justify-between mb-6 text-center ${    
                  book.page_count && typeof book.page_count === 'number' && book.page_count > 0     
                    ? 'grid-cols-4'     
                    : 'grid-cols-3'    
                }`}>    

                  {/* عرض عدد الصفحات فقط إذا كان متوفرًا */}    
                  {book.page_count && typeof book.page_count === 'number' && book.page_count > 0 && (    
                    <>    
                      <div className="flex flex-col items-center">    
                        <span className="text-lg font-bold font-cairo">{book.page_count}</span>    
                        <span className="text-xs text-muted-foreground font-cairo">    
                          الصفحات    
                        </span>    
                      </div>    

                      <div className="w-px h-12 bg-border/50"></div>    
                    </>    
                  )}    

                  <div className="flex flex-col items-center">    
                    <span className="text-sm font-bold font-cairo text-center">{getCategoryInArabic(book.category)}</span>    
                    <span className="text-xs text-muted-foreground font-cairo">    
                      التصنيف    
                    </span>    
                  </div>    

                  <div className="w-px h-12 bg-border/50"></div>    

                  <div className="flex flex-col items-center">    
                    <span className="text-sm font-bold font-cairo">{getLanguageInArabic(book.language || '') || 'العربية'}</span>    
                    <span className="text-xs text-muted-foreground font-cairo">    
                      اللغة    
                    </span>    
                  </div>    

                  <div className="w-px h-12 bg-border/50"></div>    

                  <div className="flex flex-col items-center">    
                    <span className="text-sm font-bold font-cairo">{formatFileSize(book.file_size, book.page_count)}</span>    
                    <span className="text-xs text-muted-foreground font-cairo">    
                      الحجم    
                    </span>    
                  </div>    
                </div>    

                {/* عرض سنة النشر وتاريخ إضافة الكتاب */}    
                <div className="flex justify-center gap-8 mb-6">    
                  {book.publication_year && book.publication_year > 0 && (    
                    <div className="flex flex-col items-center">    
                      <span className="text-sm font-bold font-cairo">{book.publication_year}</span>    
                      <span className="text-sm text-muted-foreground font-cairo">    
                        سنة النشر    
                      </span>    
                    </div>    
                  )}    

                  {book.created_at && formatDateArabic(book.created_at) && (    
                    <div className="flex flex-col items-center">    
                      <span className="text-sm font-bold font-cairo text-center">{formatDateArabic(book.created_at)}</span>    
                      <span className="text-xs text-muted-foreground font-cairo">    
                        تاريخ الإضافة    
                      </span>    
                    </div>    
                  )}    
                </div>    

                {/* إضافة وصف الكتاب */}    
                {book.description && book.description.trim() && (    
                  <div className="mb-6">    
                    <p className="text-muted-foreground text-sm leading-relaxed font-cairo text-center">    
                      {book.description}    
                    </p>    
                  </div>    
                )}    

              </CardContent>    
            </Card>    

            {/* كارد معلومات المؤلف - مع تأثير الشفافية */}
            <Card className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-2xl">
              <AuthorInfoCard    
                authorName={book.author}    
                authorImageUrl={book.author_image_url}    
              />    
            </Card>

            {/* كارد ترتيب الشهرة */}
            {!rankLoading && popularityRank && (
              <Card className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-2xl">
                <CardContent className="p-6">
                  <BookPopularityRank rank={popularityRank} category={book.category} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>    
        <Separator className="my-8 border-border" />    
        {/* قسم التقييمات */}    
        {book && <BookReviews bookId={book.id} bookTitle={book.title} />}    
      </div>    

      {/* قسم الكتب المشابهة بتصميم مُطابق للقسم الداكن */}    
      {book && (    
        <SimilarBooks    
          bookId={book.id}    
          category={book.category}    
          darkMode    
        />    
      )}    

      <Footer />    
    </div>
  );
};

const BookDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { book, loading } = useBookDetails(id!);

  // استخراج اسم الكتاب والمؤلف من الـ slug فوراً
  const parsedSlug = parseBookSlug(id || '');
  const fallbackTitle = parsedSlug?.title || '';
  const fallbackAuthor = parsedSlug?.author || '';

  // تحضير بيانات الكتاب للـ Helmet
  const bookTitle = book
    ? `${book.title} - ${book.author}`
    : (parsedSlug ? `${fallbackTitle} - ${fallbackAuthor}` : 'كتاب - منصة كتبي');

  const bookDescription = book
    ? (book.description
      ? `${book.description.substring(0, 160)}...`
      : `كتاب ${book.title} للمؤلف ${book.author} - اقرأ وحمل مجاناً من منصة كتبي`
    )
    : (parsedSlug
      ? `كتاب ${fallbackTitle} للمؤلف ${fallbackAuthor} - اقرأ وحمل مجاناً من منصة كتبي`
      : 'اكتشف آلاف الكتب العربية المجانية على منصة كتبي'
    );

  const bookImage = optimizeImageUrl(book?.cover_image_url || '/src/assets/default-book-cover.png', 'cover');
  
  // استخدام canonical URL الثابت بدلاً من window.location.href
  const baseUrl = 'https://kotobi.xyz';
  const readableSlug = book?.slug
    ? (() => { try { return decodeURIComponent(book.slug); } catch { return book.slug; } })()
    : undefined;
  const canonicalBookUrl = readableSlug
    ? `${baseUrl}/book/${readableSlug}`
    : `${baseUrl}/book/${id}`;

  return (
    <HelmetProvider>
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{`${bookTitle} | منصة كتبي`}</title>
        <meta name="description" content={bookDescription} />
        <meta name="author" content={book?.author || 'منصة كتبي'} />
        <meta name="keywords" content={book ? `${book.category}, كتب عربية, قراءة مجانية, ${book.author}, ${book.title}` : 'كتب عربية, قراءة مجانية, مكتبة إلكترونية'} />
        
        {/* Canonical URL - مهم جداً لـ SEO */}
        <link rel="canonical" href={canonicalBookUrl} />

        {/* Open Graph Meta Tags */}    
        <meta property="og:title" content={bookTitle} />    
        <meta property="og:description" content={bookDescription} />    
        <meta property="og:image" content={bookImage} />    
        <meta property="og:image:width" content="400" />    
        <meta property="og:image:height" content="600" />    
        <meta property="og:image:alt" content={book ? `غلاف كتاب ${book.title}` : 'غلاف الكتاب'} />    
        <meta property="og:url" content={canonicalBookUrl} />    
        <meta property="og:type" content="book" />    
        <meta property="og:site_name" content="منصة كتبي - المكتبة الرقمية العربية المجانية" />    
        <meta property="og:locale" content="ar_AR" />

        {/* Twitter Card Meta Tags */}    
        <meta name="twitter:card" content="summary_large_image" />    
        <meta name="twitter:title" content={bookTitle} />    
        <meta name="twitter:description" content={bookDescription} />    
        <meta name="twitter:image" content={bookImage} />    

        {/* Book-specific Schema.org structured data */}    
        {book && (    
          <script type="application/ld+json">    
            {JSON.stringify({    
              "@context": "https://schema.org",    
              "@type": "Book",    
              "name": book.title,    
              "author": {    
                "@type": "Person",    
                "name": book.author    
              },    
              "description": bookDescription,    
              "url": canonicalBookUrl,    
              "genre": book.category,
              "inLanguage": "ar",    
              "publisher": "منصة كتبي",    
              ...(book.publication_year && { "datePublished": `${book.publication_year}` }),    
              ...(book.page_count && { "numberOfPages": book.page_count }),    
              "image": bookImage,    
              "offers": {    
                "@type": "Offer",    
                "price": "0",    
                "priceCurrency": "USD",    
                "availability": "https://schema.org/InStock"    
              }    
            })}    
          </script>    
        )}    
      </Helmet>    
      <BookDetailsContent />    
    </HelmetProvider>
  );
};

export default BookDetails;