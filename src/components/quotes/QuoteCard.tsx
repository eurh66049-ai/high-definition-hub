import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Edit, Trash2, BookOpen, Quote as QuoteIcon, Sparkles, ImageIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/AuthContext';
import { Quote } from '@/hooks/useQuotes';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { optimizeImageUrl } from '@/utils/imageProxy';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getCategoryInArabic } from '@/utils/categoryTranslation';
import { UnifiedProfileLink } from '@/components/profile/UnifiedProfileLink';
import { QuoteShareImage } from './QuoteShareImage';
import { QuoteLikeButton } from './QuoteLikeButton';
import { QuoteReplies } from './QuoteReplies';
import { resolveKotobiAiAvatar, isKotobiAiUser } from '@/utils/kotobiAi';

interface QuoteCardProps {
  quote: Quote;
  onDelete: (quoteId: string) => Promise<boolean>;
  onUpdate: (quoteId: string, quoteData: any) => Promise<boolean>;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({ quote, onDelete, onUpdate }) => {
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editQuoteText, setEditQuoteText] = useState(quote.quote_text);
  const [editBookTitle, setEditBookTitle] = useState(quote.book_title);
  const [editAuthorName, setEditAuthorName] = useState(quote.author_name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShareImageOpen, setIsShareImageOpen] = useState(false);

  const isOwner = user?.id === quote.user_id;

  const handleBookClick = () => {
    const bookPath = quote.book_slug || quote.book_id;
    if (bookPath) {
      window.location.href = `/book/${bookPath}`;
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editQuoteText.trim() || !editBookTitle.trim() || !editAuthorName.trim()) return;
    setIsUpdating(true);
    const success = await onUpdate(quote.id, {
      quote_text: editQuoteText.trim(),
      book_title: editBookTitle.trim(),
      author_name: editAuthorName.trim()
    });
    if (success) setIsEditDialogOpen(false);
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(quote.id);
    if (success) setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  const timeAgo = formatDistanceToNow(new Date(quote.created_at), { addSuffix: true, locale: ar });

  return (
    <>
      <Card className="group relative w-full overflow-hidden bg-gradient-to-br from-card via-card to-muted/30 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-700" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-primary/5 to-transparent rounded-full translate-x-12 translate-y-12 group-hover:scale-150 transition-transform duration-700" />
        <div className="absolute top-4 left-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
          <QuoteIcon className="w-24 h-24 text-primary" />
        </div>

        <CardContent className="relative p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <UnifiedProfileLink 
              userId={quote.user_id}
              username={quote.username}
              className="flex items-center gap-4 hover:opacity-90 transition-opacity"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-primary rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                <Avatar className="h-12 w-12 ring-2 ring-primary/20 ring-offset-2 ring-offset-background relative hover:ring-primary/40 transition-all">
                  <AvatarImage 
                    src={(() => {
                      const resolved = resolveKotobiAiAvatar({ userId: quote.user_id, avatarUrl: quote.avatar_url });
                      if (!resolved) return '';
                      return isKotobiAiUser(quote.user_id) ? resolved : optimizeImageUrl(resolved, 'avatar');
                    })()} 
                    alt={quote.username}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold">
                    {quote.username?.[0] || 'م'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <p className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                  {quote.username}
                  
                </p>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary/60" />
                  <p className="text-xs text-muted-foreground">{timeAgo}</p>
                </div>
              </div>
            </UnifiedProfileLink>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-primary/10">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 ml-2" />
                    تعديل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-transparent rounded-full" />
            <blockquote className="pr-6 py-3">
              <p 
                className="text-base md:text-lg leading-loose text-foreground"
                style={{ 
                  fontFamily: "'Noto Naskh Arabic', 'Amiri', serif",
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}
              >
                <span className="text-xl text-primary/60 font-serif">"</span>
                {quote.quote_text}
                <span className="text-xl text-primary/60 font-serif">"</span>
              </p>
            </blockquote>
          </div>

          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl backdrop-blur-sm border border-border/50 group-hover:border-primary/20 transition-colors duration-300">
            {quote.book_cover_url && (
              <div className="relative flex-shrink-0 cursor-pointer" onClick={handleBookClick}>
                <img
                  src={quote.book_cover_url}
                  alt={`غلاف كتاب ${quote.book_title}`}
                  className="w-14 h-20 object-cover rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors duration-200" onClick={handleBookClick}>
                  {quote.book_title}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-2">— {quote.author_name}</p>
              {quote.book_category && (
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0">
                  {getCategoryInArabic(quote.book_category)}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <QuoteLikeButton quoteId={quote.id} />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsShareImageOpen(true)}
                className="flex items-center gap-2 rounded-full px-4 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm">مشاركة كصورة</span>
              </Button>

              <QuoteReplies quoteId={quote.id} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center">تعديل الاقتباس</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quote-text">نص الاقتباس *</Label>
              <Textarea id="edit-quote-text" value={editQuoteText} onChange={(e) => setEditQuoteText(e.target.value)} className="min-h-[100px] resize-none" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-book-title">اسم الكتاب *</Label>
              <Input id="edit-book-title" value={editBookTitle} onChange={(e) => setEditBookTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-name">اسم المؤلف *</Label>
              <Input id="edit-author-name" value={editAuthorName} onChange={(e) => setEditAuthorName(e.target.value)} required />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">إلغاء</Button>
              <Button type="submit" disabled={isUpdating || !editQuoteText.trim() || !editBookTitle.trim() || !editAuthorName.trim()} className="flex-1">
                {isUpdating ? 'جارٍ التحديث...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">حذف الاقتباس</AlertDialogTitle>
            <AlertDialogDescription className="text-center">هل أنت متأكد من حذف هذا الاقتباس؟ لن يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'جارٍ الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuoteShareImage
        quote={quote}
        open={isShareImageOpen}
        onOpenChange={setIsShareImageOpen}
      />
    </>
  );
};
