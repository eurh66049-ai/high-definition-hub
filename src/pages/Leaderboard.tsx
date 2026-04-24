import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UnifiedProfileLink } from '@/components/profile/UnifiedProfileLink';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaderboard, LeaderboardCategory, LeaderboardUser } from '@/hooks/useLeaderboard';
import { Trophy, Medal, Award, BookOpen, Star, Users, Crown, Flame } from 'lucide-react';
import { LeaderboardBadge } from '@/components/leaderboard/LeaderboardBadge';
import { motion } from 'framer-motion';

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="h-6 w-6 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-bold">{rank}</span>;
  }
};

const getRankBgClass = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    case 2:
      return 'bg-gradient-to-r from-gray-400/20 to-slate-400/20 border-gray-400/30';
    case 3:
      return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30';
    default:
      return 'bg-card hover:bg-accent/50';
  }
};

const LeaderboardItem = ({ user, category }: { user: LeaderboardUser; category: LeaderboardCategory }) => {
  const getValue = () => {
    switch (category) {
      case 'books':
        return { value: user.books_read, label: 'كتاب', icon: <BookOpen className="h-4 w-4" /> };
      case 'reviews':
        return { value: user.reviews_count, label: 'مراجعة', icon: <Star className="h-4 w-4" /> };
      case 'followers':
        return { value: user.followers_count, label: 'متابع', icon: <Users className="h-4 w-4" /> };
      default:
        return { value: user.points, label: 'نقطة', icon: <Flame className="h-4 w-4" /> };
    }
  };

  const { value, label, icon } = getValue();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: user.rank * 0.05 }}
    >
      <UnifiedProfileLink userId={user.id} username={user.username} className="block">
        <Card className={`mb-3 transition-all duration-300 border ${getRankBgClass(user.rank)} hover:scale-[1.02] hover:shadow-lg cursor-pointer`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* الترتيب */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background/50">
                {getRankIcon(user.rank)}
              </div>

              {/* صورة المستخدم */}
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* معلومات المستخدم */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate flex items-center gap-1">
                  {user.username}
                  <LeaderboardBadge userId={user.id} />
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {icon}
                  <span>{value.toLocaleString('ar-EG')} {label}</span>
                </div>
              </div>

              {/* شارة المركز الأول */}
              {user.rank === 1 && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0">
                  🏆 البطل
                </Badge>
              )}
              {user.rank === 2 && (
                <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700">
                  🥈 الثاني
                </Badge>
              )}
              {user.rank === 3 && (
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  🥉 الثالث
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </UnifiedProfileLink>
    </motion.div>
  );
};

const LeaderboardSkeleton = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <Card key={i} className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const Leaderboard = () => {
  const [category, setCategory] = useState<LeaderboardCategory>('points');
  const { leaders, loading, error } = useLeaderboard(category, 20);

  const categories = [
    { id: 'points' as LeaderboardCategory, label: 'النقاط', icon: <Flame className="h-4 w-4" /> },
    { id: 'books' as LeaderboardCategory, label: 'الكتب المقروءة', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'reviews' as LeaderboardCategory, label: 'المراجعات', icon: <Star className="h-4 w-4" /> },
    { id: 'followers' as LeaderboardCategory, label: 'المتابعون', icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <SEOHead
        title="لوحة الصدارة | كتبي - أكثر القراء نشاطاً"
        description="تعرف على أكثر القراء نشاطاً في منصة كتبي. تنافس واحصل على مركز متقدم في لوحة الصدارة."
        keywords="لوحة الصدارة, أفضل القراء, كتبي, منافسة القراءة"
      />
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 mb-4 shadow-lg"
          >
            <Trophy className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            🏆 لوحة الصدارة
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            تعرف على أكثر القراء نشاطاً في منصة كتبي وتنافس للوصول إلى القمة!
          </p>
        </div>

        {/* التصنيفات */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as LeaderboardCategory)} className="w-full">
          <TabsList className="w-full flex flex-wrap justify-center gap-2 bg-transparent h-auto p-2">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {cat.icon}
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-6">
              <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    {cat.icon}
                    أفضل القراء حسب {cat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <LeaderboardSkeleton />
                  ) : error ? (
                    <div className="text-center py-10 text-destructive">
                      {error}
                    </div>
                  ) : leaders.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      لا توجد بيانات متاحة حالياً
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {leaders.map((user) => (
                        <LeaderboardItem key={user.id} user={user} category={category} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* معلومات إضافية */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">💡 كيف تحصل على نقاط؟</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <span>قراءة الكتب</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Star className="h-6 w-6 text-primary" />
                  <span>كتابة المراجعات</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Users className="h-6 w-6 text-primary" />
                  <span>متابعة المؤلفين</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Trophy className="h-6 w-6 text-primary" />
                  <span>إكمال التحديات</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Leaderboard;
