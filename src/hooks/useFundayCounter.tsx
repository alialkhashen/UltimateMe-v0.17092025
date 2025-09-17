import { useEffect } from 'react';
import { UserStats } from '@/types';

interface UseFundayCounterProps {
  userStats: UserStats;
  onUserStatsChange: (updater: (prev: UserStats) => UserStats) => void;
}

/**
 * Hook to automatically convert achievement points to fundays
 * Converts 100 achievement points to 1 funday
 */
export const useFundayCounter = ({ userStats, onUserStatsChange }: UseFundayCounterProps) => {
  useEffect(() => {
    // Calculate how many fundays should be earned from current points
    const fundaysEarned = Math.floor(userStats.points / 100);
    
    // If user has earned more fundays than currently available, update the count
    if (fundaysEarned > userStats.fundayCount) {
      const newFundays = fundaysEarned - userStats.fundayCount;
      
      onUserStatsChange(prev => ({
        ...prev,
        fundayCount: prev.fundayCount + newFundays
      }));
      
      console.log(`Earned ${newFundays} funday(s)! Total: ${fundaysEarned}`);
    }
  }, [userStats.points, userStats.fundayCount, onUserStatsChange]);
  
  return {
    totalFundaysEarnable: Math.floor(userStats.points / 100),
    pointsToNextFunday: 100 - (userStats.points % 100)
  };
};