import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  books_read: number;
  reviews_count: number;
  followers_count: number;
  rank: number;
}

export type LeaderboardCategory = 'points' | 'books' | 'reviews' | 'followers';

type LeaderboardRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  points: number | null;
  books_read: number | null;
  reviews_count: number | null;
  followers_count: number | null;
  rank: number | null;
};

export const useLeaderboard = (category: LeaderboardCategory = 'points', limit: number = 10) => {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        // Server-side leaderboard: season-based + rank-based points (Supabase RPC)
        const { data, error: rpcError } = await (supabase as any).rpc('get_leaderboard', {
          p_category: category,
          p_limit: limit,
        }) as { data: LeaderboardRow[] | null; error: any };

        if (rpcError) throw rpcError;

        const mapped: LeaderboardUser[] = (data || []).map((row, index) => ({
          id: row.id,
          username: row.username || 'مستخدم مجهول',
          avatar_url: row.avatar_url,
          points: row.points ?? 0,
          books_read: row.books_read ?? 0,
          reviews_count: row.reviews_count ?? 0,
          followers_count: row.followers_count ?? 0,
          rank: row.rank ?? index + 1,
        }));

        setLeaders(mapped);
      } catch (err: any) {
        console.error('Error fetching leaderboard:', err);
        setError(err.message || 'حدث خطأ في تحميل لوحة الصدارة');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [category, limit]);

  return { leaders, loading, error };
};
