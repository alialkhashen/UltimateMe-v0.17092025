import { useState, useEffect } from 'react';
import { Task, Group, UserStats } from '@/types';
import { useAuth } from './useAuth';

export function useSupabaseData() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    points: 0,
    rewardMinutes: 0,
    fundayCount: 0,
    currentStreak: 0,
    totalTasks: 0,
    completedTasks: 0,
    profileImage: null,
    userName: 'User',
    status: 'Ready to achieve goals!'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadEmptyData();
    }
  }, [user]);

  const loadEmptyData = () => {
    setTasks([]);
    setGroups([]);
    setUserStats(prev => ({
      ...prev,
      level: 1,
      points: 0,
      rewardMinutes: 0,
      fundayCount: 0,
      currentStreak: 0,
      totalTasks: 0,
      completedTasks: 0
    }));
    setLoading(false);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(task => (task.id === taskId ? { ...task, ...updates } : task))
    );
  };

  const createTask = async (newTask: Omit<Task, 'id' | 'createdAt'>) => {
    const task: Task = {
      ...newTask,
      id: `t${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [...prev, task]);
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const updateUserStats = async (updater: (prev: UserStats) => UserStats) => {
    setUserStats(updater);
  };

  const createGroup = async (newGroup: Omit<Group, 'id'>) => {
    const group: Group = { ...newGroup, id: `g${Date.now()}` };
    setGroups(prev => [...prev, group]);
  };

  const updateGroup = async (groupId: string, updatedGroup: Partial<Omit<Group, 'id'>>) => {
    setGroups(prev =>
      prev.map(group =>
        group.id === groupId ? { ...group, ...updatedGroup } : group
      )
    );
  };

  const deleteGroup = async (groupId: string) => {
    setGroups(prev => prev.filter(group => group.id !== groupId));
  };

  const reorderGroups = async (groupIds: string[]) => {
    setGroups(prev => {
      const reordered = [...prev];
      reordered.sort(
        (a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id)
      );
      return reordered;
    });
  };

  return {
    tasks,
    groups,
    userStats,
    loading,
    updateTask,
    createTask,
    deleteTask,
    updateUserStats,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    refetch: loadEmptyData
  };
}
