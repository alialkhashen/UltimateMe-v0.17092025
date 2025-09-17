import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GoalStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface CustomGoal {
  id: string;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate?: string;
  isCompleted: boolean;
  steps: GoalStep[];
  notes: string;
  rewardPoints: number;
  rewardMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export const useCustomGoals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<CustomGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('custom_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedGoals: CustomGoal[] = data.map(goal => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        targetValue: goal.target_value,
        currentValue: goal.current_value,
        unit: goal.unit,
        targetDate: goal.target_date,
        isCompleted: goal.is_completed,
        steps: Array.isArray(goal.steps) ? goal.steps : (typeof goal.steps === 'string' ? JSON.parse(goal.steps || '[]') : []),
        notes: goal.notes || '',
        rewardPoints: goal.reward_points || 0,
        rewardMinutes: goal.reward_minutes || 0,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at
      }));

      setGoals(mappedGoals);
    } catch (error) {
      console.error('Error fetching custom goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (newGoal: Omit<CustomGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('custom_goals')
        .insert({
          user_id: user.id,
          title: newGoal.title,
          description: newGoal.description,
          target_value: newGoal.targetValue,
          current_value: newGoal.currentValue,
          unit: newGoal.unit,
          target_date: newGoal.targetDate,
          is_completed: newGoal.isCompleted,
          steps: JSON.stringify(newGoal.steps || []),
          notes: newGoal.notes || '',
          reward_points: newGoal.rewardPoints || 0,
          reward_minutes: newGoal.rewardMinutes || 0
        })
        .select()
        .single();

      if (error) throw error;

      const mappedGoal: CustomGoal = {
        id: data.id,
        title: data.title,
        description: data.description,
        targetValue: data.target_value,
        currentValue: data.current_value,
        unit: data.unit,
        targetDate: data.target_date,
        isCompleted: data.is_completed,
        steps: Array.isArray(data.steps) ? data.steps : (typeof data.steps === 'string' ? JSON.parse(data.steps || '[]') : []),
        notes: data.notes || '',
        rewardPoints: data.reward_points || 0,
        rewardMinutes: data.reward_minutes || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setGoals(prev => [mappedGoal, ...prev]);
    } catch (error) {
      console.error('Error creating custom goal:', error);
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<CustomGoal>) => {
    if (!user) return;

    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
      if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate;
      if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted;
      if (updates.steps !== undefined) dbUpdates.steps = JSON.stringify(updates.steps);
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.rewardPoints !== undefined) dbUpdates.reward_points = updates.rewardPoints;
      if (updates.rewardMinutes !== undefined) dbUpdates.reward_minutes = updates.rewardMinutes;

      const { error } = await supabase
        .from('custom_goals')
        .update(dbUpdates)
        .eq('id', goalId)
        .eq('user_id', user.id);

      if (error) throw error;

      setGoals(prev => prev.map(goal => 
        goal.id === goalId ? { ...goal, ...updates } : goal
      ));
    } catch (error) {
      console.error('Error updating custom goal:', error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('custom_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', user.id);

      if (error) throw error;

      setGoals(prev => prev.filter(goal => goal.id !== goalId));
    } catch (error) {
      console.error('Error deleting custom goal:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  return {
    goals,
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    refetch: fetchGoals
  };
};