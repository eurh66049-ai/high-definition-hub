import React from 'react';
import { useTopLeaders } from '@/hooks/useTopLeaders';
import { Crown, Medal, Award } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LeaderboardBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const badgeConfig = {
  1: {
    icon: Crown,
    emoji: '🥇',
    label: 'المركز الأول',
    gradient: 'from-yellow-400 to-amber-500',
    textColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  2: {
    icon: Medal,
    emoji: '🥈',
    label: 'المركز الثاني',
    gradient: 'from-gray-300 to-slate-400',
    textColor: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    borderColor: 'border-gray-400/30',
  },
  3: {
    icon: Award,
    emoji: '🥉',
    label: 'المركز الثالث',
    gradient: 'from-amber-600 to-orange-500',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-600/10',
    borderColor: 'border-amber-600/30',
  },
} as const;

const sizeMap = {
  sm: { icon: 'h-3.5 w-3.5', badge: 'px-1.5 py-0.5 text-[10px]', gap: 'gap-0.5' },
  md: { icon: 'h-4 w-4', badge: 'px-2 py-0.5 text-xs', gap: 'gap-1' },
  lg: { icon: 'h-5 w-5', badge: 'px-2.5 py-1 text-sm', gap: 'gap-1.5' },
};

export const LeaderboardBadge: React.FC<LeaderboardBadgeProps> = ({ userId, size = 'sm', showLabel = false }) => {
  const { getLeaderRank } = useTopLeaders();
  const rank = getLeaderRank(userId);

  if (!rank || rank > 3) return null;

  const config = badgeConfig[rank as 1 | 2 | 3];
  const sizeConfig = sizeMap[size];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.badge} rounded-full ${config.bgColor} border ${config.borderColor} ${config.textColor} font-bold`}
          >
            <Icon className={sizeConfig.icon} />
            {showLabel && <span>{config.label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.emoji} {config.label} في لوحة الصدارة</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
