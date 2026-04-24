import React from 'react';
import { Link } from 'react-router-dom';
import { UnifiedProfileLink } from '@/components/profile/UnifiedProfileLink';
import { Trophy, Crown, Medal, Award, BookOpen, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { motion } from 'framer-motion';

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return { icon: <Crown className="h-4 w-4 text-yellow-500" />, bg: 'bg-yellow-500/10 border-yellow-500/30' };
    case 2: return { icon: <Medal className="h-4 w-4 text-gray-400" />, bg: 'bg-gray-400/10 border-gray-400/30' };
    case 3: return { icon: <Award className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-600/10 border-amber-600/30' };
    default: return { icon: <span className="text-xs font-bold text-muted-foreground">#{rank}</span>, bg: 'bg-card border-border' };
  }
};

const MiniLeaderboard: React.FC = () => {
  const { leaders, loading } = useLeaderboard('points', 5);

  return (
    <section className="mb-8">
      {/* العنوان */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground leading-tight">لوحة الصدارة</h2>
            <p className="text-xs text-muted-foreground">أكثر القراء نشاطاً</p>
          </div>
        </div>
        <Link
          to="/leaderboard"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      <Card className="overflow-hidden border-primary/10">
        {/* شريط الألوان العلوي */}
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-primary" />
        <CardContent className="p-3 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))
          ) : leaders.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">لا توجد بيانات بعد</p>
          ) : (
            leaders.map((user, i) => {
              const { icon, bg } = getRankStyle(user.rank);
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <UnifiedProfileLink userId={user.id} username={user.username} className="block">
                    <div className={`flex items-center gap-3 p-2 rounded-xl border transition-all hover:shadow-sm hover:scale-[1.01] ${bg}`}>
                      {/* الترتيب */}
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-background/70 shrink-0">
                        {icon}
                      </div>

                      {/* الصورة */}
                      <Avatar className="h-9 w-9 shrink-0 border border-border">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* الاسم والنقاط */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{user.username}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span>{user.books_read} كتاب</span>
                        </div>
                      </div>

                      {/* النقاط */}
                      <div className="text-sm font-bold text-primary shrink-0">
                        {user.points.toLocaleString('ar-EG')} <span className="text-xs text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                  </UnifiedProfileLink>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default MiniLeaderboard;
