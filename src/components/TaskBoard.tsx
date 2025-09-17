
import { useState, useEffect } from 'react';
import { Plus, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TaskCard from '@/components/TaskCard';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import { Task, Group, UserStats, TASK_REWARDS } from '@/types';
import { getToday, formatDate, addDays, getDayName, extractDatePart, isSameDate } from '@/utils/dateUtils';

interface TaskBoardProps {
  tasks: Task[];
  activeGroupId: string;
  groups: Group[];
  onTaskCreate: (newTask: Omit<Task, 'id' | 'createdAt'>) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete: (taskId: string) => void;
  onUserStatsChange: (updater: (prev: UserStats) => UserStats) => void;
  userStats: UserStats;
  onPenalty?: (penaltyMinutes: number) => void;
  isAdminMode?: boolean;
}

const TaskBoard = ({ 
  tasks, 
  activeGroupId, 
  groups, 
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete,
  onUserStatsChange,
  userStats,
  onPenalty,
  isAdminMode = false
}: TaskBoardProps) => {
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [checkedOverdueTasks, setCheckedOverdueTasks] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'level' | 'name' | 'date'>('level');

  // Daily task reset and scheduled task management
  useEffect(() => {
    const handleMidnightReset = () => {
      const today = getToday();
      const lastResetDate = localStorage.getItem('lastTaskResetDate');
      
      // Only run reset if it's a new day and we haven't reset today already
      if (lastResetDate === today) {
        console.log('Reset already performed today:', today);
        return;
      }
      
      console.log('Handling midnight reset for:', today, 'last reset:', lastResetDate);
      
      // Reset repeated tasks - remove old instances and create new ones
      const repeatedTasks = tasks.filter(task => 
        task.repeatDays && task.repeatDays.length > 0 && !task.isCompleted
      );
      
      // Remove old repeated task instances
      repeatedTasks.forEach(task => {
        const taskDueDate = extractDatePart(task.dueDate);
        if (taskDueDate < today) {
          console.log('Removing old repeated task:', task.name, 'due:', taskDueDate);
          onTaskDelete(task.id);
        }
      });
      
      // Remove expired non-repeated tasks (those due before today)
      const expiredTasks = tasks.filter(task => {
        if (task.isCompleted || (task.repeatDays && task.repeatDays.length > 0)) return false;
        const taskDueDate = extractDatePart(task.dueDate);
        return taskDueDate < today;
      });
      
      expiredTasks.forEach(task => {
        console.log('Removing expired non-repeated task:', task.name, 'due:', task.dueDate);
        onTaskDelete(task.id);
      });
      
      // Check for scheduled tasks that need to be created today
      const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
      let hasChanges = false;
      
      scheduledTasks.forEach((scheduledTask: any) => {
        console.log('Checking scheduled task:', scheduledTask.key, 'nextDate:', scheduledTask.nextDate, 'today:', today);
        if (scheduledTask.nextDate === today && !scheduledTask.created) {
          // Create the scheduled task
          createScheduledTask(scheduledTask.task, today);
          
          // Mark as created
          scheduledTask.created = true;
          hasChanges = true;
          
          // If it's recurring, schedule the next occurrence
          if (scheduledTask.isRecurring) {
            const nextDate = calculateNextOccurrence(scheduledTask.task.repeatDays);
            scheduledTask.nextDate = nextDate;
            scheduledTask.created = false;
          }
        }
      });
      
      // Clean up non-recurring completed tasks and old tasks
      const cleanedTasks = scheduledTasks.filter((st: any) => {
        if (!st.isRecurring && st.created) return false;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(st.nextDate) >= thirtyDaysAgo;
      });
      
      if (hasChanges || cleanedTasks.length !== scheduledTasks.length) {
        localStorage.setItem('scheduledTasks', JSON.stringify(cleanedTasks));
      }
      
      // Mark that we've completed the reset for today
      localStorage.setItem('lastTaskResetDate', today);
    };

    // Only run reset logic if tasks are loaded and it's a new day
    if (tasks.length > 0 || localStorage.getItem('scheduledTasks')) {
      const today = getToday();
      const lastResetDate = localStorage.getItem('lastTaskResetDate');
      
      // Run reset if it's a new day
      if (lastResetDate !== today) {
        handleMidnightReset();
      }
    }
    
    // Set up midnight timer
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0); // 12:01 AM tomorrow
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const midnightTimer = setTimeout(handleMidnightReset, msUntilMidnight);
    
    return () => clearTimeout(midnightTimer);
  }, [tasks.length]); // Changed dependency to prevent unnecessary re-runs

  const calculateNextOccurrence = (repeatDays: string[]) => {
    const now = new Date();
    const currentDayIndex = now.getDay();

    if (repeatDays.includes('daily')) {
      return formatDate(addDays(now, 1));
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const sortedRepeatDays = repeatDays
      .map(day => dayNames.indexOf(day))
      .filter(index => index !== -1)
      .sort((a, b) => a - b);

    const nextDayInWeek = sortedRepeatDays.find(dayIndex => dayIndex > currentDayIndex);
    
    let nextOccurrenceDate;
    if (nextDayInWeek !== undefined) {
      nextOccurrenceDate = addDays(now, nextDayInWeek - currentDayIndex);
    } else {
      const firstDay = sortedRepeatDays[0];
      const daysUntilNext = 7 - currentDayIndex + firstDay;
      nextOccurrenceDate = addDays(now, daysUntilNext);
    }

    return formatDate(nextOccurrenceDate);
  };

  const createScheduledTask = (taskTemplate: any, dueDate: string) => {
    const newTask = {
      ...taskTemplate,
      id: undefined, // Will be generated
      dueDate: dueDate,
      isCompleted: false,
      isActive: false,
      timeRemaining: taskTemplate.duration * 60,
      lastInteractionDate: undefined,
      createdAt: undefined // Will be generated
    };
    
    onTaskCreate(newTask);
  };

  // Check for overdue tasks and apply penalties (fixed for new day task creation)
  useEffect(() => {
    const now = new Date();
    const today = getToday();
    const currentHour = now.getHours();
    
    // Don't apply auto-penalties if it's early in the day (0-2 AM) to allow normal task creation
    const isEarlyMorning = currentHour >= 0 && currentHour <= 2;
    
    // Check for tasks that need auto-penalty (no interaction from previous day)
    const tasksNeedingAutoPenalty = tasks.filter(task => {
      if (task.isCompleted || checkedOverdueTasks.has(task.id) || isEarlyMorning) return false;
      
      // Only apply penalty if task was created before today and has no interaction today
      const taskCreatedDate = extractDatePart(task.createdAt);
      const hasNoInteractionToday = !task.lastInteractionDate || task.lastInteractionDate !== today;
      const wasCreatedBeforeToday = taskCreatedDate < today;
      
      return hasNoInteractionToday && wasCreatedBeforeToday;
    });

    // Apply auto-penalties for tasks with no interaction (only after early morning hours)
    if (tasksNeedingAutoPenalty.length > 0 && !isEarlyMorning) {
      let totalAutoPenalty = 0;
      const newCheckedIds = new Set(checkedOverdueTasks);
      
      tasksNeedingAutoPenalty.forEach(task => {
        const rewardValues = task.rewardPoints !== undefined && task.rewardTime !== undefined 
          ? { points: task.rewardPoints, minutes: task.rewardTime }
          : TASK_REWARDS[task.level];
        
        totalAutoPenalty += rewardValues.minutes;
        newCheckedIds.add(task.id);
        
        // Delete the task (auto-penalty)
        onTaskDelete(task.id);
      });

      if (totalAutoPenalty > 0) {
        onPenalty?.(totalAutoPenalty);
        setCheckedOverdueTasks(newCheckedIds);
        
        console.log(`Applied auto-penalty of ${totalAutoPenalty} minutes for ${tasksNeedingAutoPenalty.length} tasks with no interaction`);
      }
    }
    
    // Check for traditional overdue tasks and apply penalties (only once per day, skip early morning)
    const overdueTasks = tasks.filter(task => {
      if (task.isCompleted || checkedOverdueTasks.has(task.id) || isEarlyMorning) return false;
      
      // Only apply penalty if task doesn't have lastInteractionDate set for today
      if (task.lastInteractionDate === today) {
        return false; // Already processed today
      }
      
      const taskDueDate = extractDatePart(task.dueDate);
      return taskDueDate < today; // Task is overdue
    });

    if (overdueTasks.length > 0 && !isEarlyMorning) {
      let totalPenalty = 0;
      const newCheckedIds = new Set(checkedOverdueTasks);
      
      overdueTasks.forEach(task => {
        const reward = TASK_REWARDS[task.level];
        totalPenalty += reward.minutes;
        newCheckedIds.add(task.id);
        
        // Mark task as processed today to prevent repeated penalties
        onTaskUpdate(task.id, { ...task, lastInteractionDate: today });
      });

      if (totalPenalty > 0) {
        onUserStatsChange(prev => ({
          ...prev,
          rewardMinutes: prev.rewardMinutes - totalPenalty
        }));
        
        setCheckedOverdueTasks(newCheckedIds);
        
        console.log(`Applied penalty: -${totalPenalty} minutes for ${overdueTasks.length} overdue task(s)`);
      }
    }
  }, [tasks, checkedOverdueTasks, onUserStatsChange, onTaskUpdate, onPenalty]);

  const getFilteredTasks = () => {
    const today = getToday();
    console.log('Filtering tasks for today:', today);
    
    // If no activeGroupId or it's a default group, show all tasks for today
    if (!activeGroupId || activeGroupId === 'all-tasks' || activeGroupId === 'completed-tasks' || activeGroupId === 'scheduled-tasks') {
      return tasks.filter(task => {
        if (task.isCompleted) return false;
        
        // Only show tasks that are due today or have no specific due date
        if (!task.dueDate) return true; // Tasks without due dates show immediately
        
        const taskDueDate = extractDatePart(task.dueDate);
        console.log('Task:', task.name, 'dueDate:', task.dueDate, 'extracted:', taskDueDate, 'today:', today, 'matches:', taskDueDate === today);
        return taskDueDate === today;
      });
    }
    
    // For regular groups, show incomplete tasks that are due today
    return tasks.filter(task => {
      if (task.isCompleted || task.groupId !== activeGroupId) return false;
      
      // Only show tasks that are due today
      if (!task.dueDate) return true; // Tasks without due dates show immediately
      
      const taskDueDate = extractDatePart(task.dueDate);
      return taskDueDate === today;
    });
  };

  const getSortedTasks = (tasksToSort: Task[]) => {
    return [...tasksToSort].sort((a, b) => {
      switch (sortBy) {        
        case 'level':
          const levelOrder = { core: 0, hard: 1, mid: 2, easy: 3 };
          return levelOrder[a.level] - levelOrder[b.level];
        
        case 'name':
          return a.name.localeCompare(b.name);
        
        case 'date':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        
        default:
          return 0;
      }
    });
  };

  const filteredTasks = getFilteredTasks();
  const sortedTasks = getSortedTasks(filteredTasks);
  const activeGroup = groups.find(g => g.id === activeGroupId);

  const renderAddButton = () => {
    // Only show add button if we have a valid group selected
    if (!activeGroupId || activeGroupId === 'completed-tasks' || activeGroupId === 'scheduled-tasks' || activeGroupId === 'all-tasks') {
      return null;
    }
    
    return (
      <Button
        onClick={() => setIsCreatingTask(true)}
        className="flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </Button>
    );
  };

  const handleTaskComplete = (task: Task, isCompleted: boolean) => {
    // Find the completed tasks group by name
    const completedGroup = groups.find(g => g.name === 'Completed Tasks');
    
    if (!completedGroup && isCompleted) {
      console.error('Completed Tasks group not found');
      return;
    }

    const today = getToday();
    const updates = { 
      isCompleted,
      groupId: isCompleted ? completedGroup!.id : task.groupId,
      lastInteractionDate: today
    };
    
    onTaskUpdate(task.id, updates);
    
    if (isCompleted) {
      const reward = TASK_REWARDS[task.level];
      onUserStatsChange(prev => ({
        ...prev,
        points: prev.points + reward.points,
        rewardMinutes: prev.rewardMinutes + reward.minutes,
        completedTasks: prev.completedTasks + 1
      }));

      // For recurring tasks, they will be automatically recreated by the scheduling system
      // This ensures each completion only affects the current instance
    }
  };

  const createNextRepeatInstance = (completedTask: Task) => {
    if (!completedTask.repeatDays || completedTask.repeatDays.length === 0) return;

    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Handle daily repetition - create tomorrow's instance
    if (completedTask.repeatDays.includes('daily')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];
      
      // Schedule creation for tomorrow using setTimeout
      scheduleTaskCreation(completedTask, tomorrowDate);
      return;
    }

    // Find the next occurrence day
    let nextOccurrenceDate: Date | null = null;
    const sortedRepeatDays = completedTask.repeatDays
      .map(day => dayNames.indexOf(day))
      .filter(index => index !== -1)
      .sort((a, b) => a - b);

    // Find the next day in the current week
    const nextDayInWeek = sortedRepeatDays.find(dayIndex => dayIndex > currentDayIndex);
    
    if (nextDayInWeek !== undefined) {
      // Next occurrence is later this week
      nextOccurrenceDate = new Date(now);
      nextOccurrenceDate.setDate(now.getDate() + (nextDayInWeek - currentDayIndex));
    } else {
      // Next occurrence is next week (use the first day in the sorted list)
      nextOccurrenceDate = new Date(now);
      const firstDay = sortedRepeatDays[0];
      const daysUntilNext = 7 - currentDayIndex + firstDay;
      nextOccurrenceDate.setDate(now.getDate() + daysUntilNext);
    }

    if (nextOccurrenceDate) {
      const nextDateString = nextOccurrenceDate.toISOString().split('T')[0];
      // Schedule creation for the next occurrence date
      scheduleTaskCreation(completedTask, nextDateString);
    }
  };

  const scheduleTaskCreation = (originalTask: Task, targetDate: string) => {
    // Store the task creation info in localStorage to persist across sessions
    const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
    const taskKey = `${originalTask.name}_${originalTask.groupId}_${targetDate}`;
    
    // Avoid duplicates
    if (!scheduledTasks.find((st: any) => st.key === taskKey)) {
      scheduledTasks.push({
        key: taskKey,
        task: originalTask,
        targetDate: targetDate,
        created: false
      });
      localStorage.setItem('scheduledTasks', JSON.stringify(scheduledTasks));
    }
  };

  const createRepeatedTask = (originalTask: Task, dueDate: string) => {
    // Check if this task already exists for the target date
    const existingTask = tasks.find(t => 
      t.name === originalTask.name &&
      t.groupId === originalTask.groupId &&
      !t.isCompleted &&
      t.dueDate === dueDate &&
      JSON.stringify(t.repeatDays?.sort()) === JSON.stringify(originalTask.repeatDays?.sort())
    );

    if (existingTask) {
      return; // Task already exists for this date
    }

    const newRepeatedTask = {
      ...originalTask,
      id: undefined, // Will be generated
      isCompleted: false,
      isActive: false,
      timeRemaining: originalTask.duration * 60,
      dueDate: dueDate,
      lastInteractionDate: undefined,
      createdAt: undefined // Will be generated
    };
    
    onTaskCreate(newRepeatedTask);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
          {activeGroup?.name || 'Tasks'}
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-32 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderAddButton()}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-4">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-lg sm:text-xl font-medium text-gray-600 dark:text-gray-300 mb-2">
              No tasks yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
              Start by creating your first task to begin your productivity journey!
            </p>
            <Button 
              onClick={() => setIsCreatingTask(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Task
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-max place-items-center sm:place-items-stretch">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                groups={groups}
                onTaskUpdate={(updatedTask) => {
                  onTaskUpdate(task.id, updatedTask);
                }}
                onTaskComplete={handleTaskComplete}
                onTaskDelete={(taskId) => {
                  onTaskDelete(taskId);
                }}
                onPenalty={onPenalty}
                isAdminMode={isAdminMode}
              />
            ))}
          </div>
        )}
      </div>

      <CreateTaskDialog
        isOpen={isCreatingTask}
        onClose={() => setIsCreatingTask(false)}
        groups={groups.filter(g => !g.isDefault)}
        onTaskCreate={(newTask) => {
          onTaskCreate(newTask);
          onUserStatsChange(prev => ({ ...prev, totalTasks: prev.totalTasks + 1 }));
        }}
        isAdminMode={isAdminMode}
      />
    </div>
  );
};

export default TaskBoard;
