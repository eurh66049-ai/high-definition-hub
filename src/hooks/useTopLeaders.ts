import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TopLeader {
  id: string;
  username: string;
  rank: number;
}

// Global cache to avoid refetching on every component mount
let cachedLeaders: TopLeader[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useTopLeaders = () => {
  const [topLeaders, setTopLeaders] = useState<TopLeader[]>(cachedLeaders);
  const [loading, setLoading] = useState(cachedLeaders.length === 0);

  useEffect(() => {
    const now = Date.now();
    if (cachedLeaders.length > 0 && now - lastFetchTime < CACHE_DURATION) {
      setTopLeaders(cachedLeaders);
      setLoading(false);
      return;
    }

    const fetchTopLeaders = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_leaderboard', {
          p_category: 'points',
          p_limit: 3,
        });

        if (error) throw error;

        const leaders: TopLeader[] = (data || [])
          .filter((_: any, i: number) => i < 3)
          .map((row: any, index: number) => ({
            id: row.id,
            username: row.username || '',
            rank: row.rank ?? index + 1,
          }));

        cachedLeaders = leaders;
        lastFetchTime = Date.now();
        setTopLeaders(leaders);
      } catch (err) {
        console.error('Error fetching top leaders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopLeaders();
  }, []);

  const getLeaderRank = (userId: string): number | null => {
    const leader = topLeaders.find(l => l.id === userId);
    return leader ? leader.rank : null;
  };

  return { topLeaders, loading, getLeaderRank };
};
