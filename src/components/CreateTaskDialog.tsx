import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Task, Group, LEVEL_COLORS } from '@/types';
import ColorPanel from './ColorPanel';
import { getToday, formatDateForDisplay, addDays, formatDate, getDayName } from '@/utils/dateUtils';

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onTaskCreate: (task: Task) => void;
  isAdminMode?: boolean;
}

const CreateTaskDialog = ({ isOpen, onClose, groups, onTaskCreate, isAdminMode = false }: CreateTaskDialogProps) => {
  const [taskName, setTaskName] = useState('');
  const [taskLevel, setTaskLevel] = useState<'core' | 'hard' | 'mid' | 'easy' | 'custom'>('mid');
  
  const [dueDate, setDueDate] = useState('');
  const [duration, setDuration] = useState(30);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('minutes');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('');
  const [notes, setNotes] = useState('');
  const [rewardPoints, setRewardPoints] = useState(0);
  const [rewardTime, setRewardTime] = useState(0);
  const [errors, setErrors] = useState({ 
    taskName: false, 
    selectedGroup: false,
    rewardPoints: false,
    rewardTime: false,
    taskLevel: false
  });

  const weekDays = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' }
  ];

  const handleSubmit = () => {
    const nameError = !taskName.trim();
    const groupError = !selectedGroup;
    const rewardPointsError = taskLevel === 'custom' && rewardPoints <= 0;
    const rewardTimeError = taskLevel === 'custom' && rewardTime <= 0;
    
    const levelError = !taskLevel;
    
    setErrors({ 
      taskName: nameError, 
      selectedGroup: groupError,
      rewardPoints: rewardPointsError,
      rewardTime: rewardTimeError,
      taskLevel: levelError
    });
    
    if (nameError || groupError || rewardPointsError || rewardTimeError || levelError) return;

    const durationInMinutes = 30; // Default duration
    const today = getToday();

    console.log('Creating task with dueDate:', dueDate, 'today:', today);

    // If task has repeat days or a future due date, schedule it properly
    if (repeatDays.length > 0 || (dueDate && dueDate > today)) {
      scheduleTask();
      return;
    }

    // For immediate tasks (no repeat days and due today/no due date)
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: taskName.trim(),
      level: taskLevel === 'custom' ? 'mid' : taskLevel as 'core' | 'hard' | 'mid' | 'easy',
      dueDate: dueDate || today,
      duration: durationInMinutes,
      repeatDays: [],
      groupId: selectedGroup,
      isCompleted: false,
      isActive: false,
      timeRemaining: durationInMinutes * 60,
      customColor: customColor || undefined,
      notes: notes.trim() || undefined,
      rewardPoints: taskLevel === 'custom' ? rewardPoints : undefined,
      rewardTime: taskLevel === 'custom' ? rewardTime : undefined,
      createdAt: new Date().toISOString()
    };

    onTaskCreate(newTask);
    resetForm();
    onClose();
  };

  const scheduleTask = () => {
    const today = new Date().toISOString().split('T')[0];
    const taskTemplate = {
      name: taskName.trim(),
      level: taskLevel === 'custom' ? 'mid' : taskLevel as 'core' | 'hard' | 'mid' | 'easy',
      duration: 30,
      repeatDays,
      groupId: selectedGroup,
      customColor: customColor || undefined,
      notes: notes.trim() || undefined,
      rewardPoints: taskLevel === 'custom' ? rewardPoints : undefined,
      rewardTime: taskLevel === 'custom' ? rewardTime : undefined,
    };

    // Store in scheduled tasks
    const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
    
    if (repeatDays.length > 0) {
      // Handle recurring tasks
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = new Date().getDay();
      const todayName = dayNames[currentDay];
      
      if (repeatDays.includes('daily')) {
        // For daily tasks, create today's task immediately
        const newTask: Task = {
          id: `task-${Date.now()}`,
          ...taskTemplate,
          dueDate: today,
          isCompleted: false,
          isActive: false,
          timeRemaining: taskTemplate.duration * 60,
          createdAt: new Date().toISOString()
        };
        
        onTaskCreate(newTask);
        
        // Schedule for daily repetition starting tomorrow
        const tomorrow = addDays(new Date(), 1);
        const nextDate = formatDate(tomorrow);
        
        console.log('Creating daily task for today and scheduling for:', nextDate);
        
        scheduledTasks.push({
          key: `${taskTemplate.name}_${taskTemplate.groupId}_daily`,
          task: taskTemplate,
          isRecurring: true,
          nextDate: nextDate,
          created: false
        });
        
        showScheduleConfirmation('daily', nextDate);
      } else {
        // For specific days, check if today matches
        if (repeatDays.includes(todayName)) {
          // Create today's task immediately
          const newTask: Task = {
            id: `task-${Date.now()}`,
            ...taskTemplate,
            dueDate: today,
            isCompleted: false,
            isActive: false,
            timeRemaining: taskTemplate.duration * 60,
            createdAt: new Date().toISOString()
          };
          
          onTaskCreate(newTask);
        }
        
        // Find the next occurrence
        const sortedDays = repeatDays
          .map(day => dayNames.indexOf(day))
          .filter(index => index !== -1)
          .sort((a, b) => a - b);

        // Find next occurrence
        let nextOccurrence;
        const nextDayInWeek = sortedDays.find(dayIndex => dayIndex > currentDay);
        
        if (nextDayInWeek !== undefined) {
          nextOccurrence = addDays(new Date(), nextDayInWeek - currentDay);
        } else {
          // Next week - use first day in the sorted list
          const firstDay = sortedDays[0];
          const daysUntilNext = 7 - currentDay + firstDay;
          nextOccurrence = addDays(new Date(), daysUntilNext);
        }

        const nextDate = formatDate(nextOccurrence);
        
        console.log('Scheduling weekly task for:', nextDate);

        scheduledTasks.push({
          key: `${taskTemplate.name}_${taskTemplate.groupId}_${repeatDays.join('-')}`,
          task: taskTemplate,
          isRecurring: true,
          nextDate: nextDate,
          created: false
        });

        const dayLabels = repeatDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
        
        if (repeatDays.includes(todayName)) {
          showScheduleConfirmation(`${dayLabels} (Task created for today)`, nextDate);
        } else {
          showScheduleConfirmation(dayLabels, nextDate);
        }
      }
    } else if (dueDate) {
      // Handle single future date
      scheduledTasks.push({
        key: `${taskTemplate.name}_${taskTemplate.groupId}_${dueDate}`,
        task: taskTemplate,
        isRecurring: false,
        nextDate: dueDate,
        created: false
      });
      
      showScheduleConfirmation('one-time', dueDate);
    }

    localStorage.setItem('scheduledTasks', JSON.stringify(scheduledTasks));
    resetForm();
    onClose();
  };

  const showScheduleConfirmation = (schedule: string, nextDate: string) => {
    const formattedDate = formatDateForDisplay(nextDate);

    let message = '';
    if (schedule === 'daily') {
      message = `Task scheduled for daily repetition. Next upcoming task will be on ${formattedDate}.`;
    } else if (schedule === 'one-time') {
      message = `Task scheduled for ${formattedDate}.`;
    } else {
      message = `Task scheduled for ${schedule}. Next upcoming task will be on ${formattedDate}.`;
    }

    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
      <div class="flex items-start gap-2">
        <div class="text-lg">✅</div>
        <div class="text-sm">${message}</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 5000);
  };

  const resetForm = () => {
    setTaskName('');
    setTaskLevel('mid');
    
    setDueDate('');
    setDuration(30);
    setDurationUnit('minutes');
    setSelectedGroup('');
    setRepeatDays([]);
    setCustomColor('');
    setNotes('');
    setRewardPoints(0);
    setRewardTime(0);
    setErrors({ 
      taskName: false, 
      selectedGroup: false,
      rewardPoints: false,
      rewardTime: false,
      taskLevel: false
    });
  };

  const toggleRepeatDay = (day: string) => {
    if (day === 'daily') {
      // Toggle daily mode
      setRepeatDays(prev => 
        prev.includes('daily') 
          ? [] // Remove daily and allow individual day selection
          : ['daily'] // Set to daily only
      );
    } else {
      // Toggle individual days (only if not in daily mode)
      setRepeatDays(prev => {
        if (prev.includes('daily')) return prev; // Don't allow changes in daily mode
        return prev.includes(day) 
          ? prev.filter(d => d !== day)
          : [...prev, day];
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="taskName" className={`text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-1 ${errors.taskName ? 'text-red-500' : ''}`}>
              Task Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="taskName"
              value={taskName}
              onChange={(e) => {
                setTaskName(e.target.value);
                if (errors.taskName && e.target.value.trim()) {
                  setErrors(prev => ({ ...prev, taskName: false }));
                }
              }}
              placeholder="Enter task name"
              className={`bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                errors.taskName ? 'border-red-500 dark:border-red-500' : ''
              }`}
            />
            {errors.taskName && (
              <p className="text-red-500 text-sm mt-1">Must complete this field</p>
            )}
          </div>

          <div>
            <Label htmlFor="taskLevel" className={`text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-2 block ${errors.taskLevel ? 'text-red-500' : ''}`}>
              Level <span className="text-red-500">*</span>
            </Label>
            <Select value={taskLevel} onValueChange={(value: any) => {
              setTaskLevel(value);
              if (errors.taskLevel && value) {
                setErrors(prev => ({ ...prev, taskLevel: false }));
              }
            }}>
              <SelectTrigger className={`bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                errors.taskLevel ? 'border-red-500 dark:border-red-500' : ''
              }`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="easy" className="text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.easy }} />
                    Easy (+2 points, 5 min)
                  </div>
                </SelectItem>
                <SelectItem value="mid" className="text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.mid }} />
                    Mid (+5 points, 10 min)
                  </div>
                </SelectItem>
                <SelectItem value="hard" className="text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.hard }} />
                    Hard (+10 points, 20 min)
                  </div>
                </SelectItem>
                <SelectItem value="core" className="text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.core }} />
                    Core (+25 points, 45 min)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.taskLevel && (
              <p className="text-red-500 text-sm mt-1">Must select a level</p>
            )}
          </div>




          <div>
            <Label htmlFor="notes" className="text-gray-700 dark:text-gray-300 mb-2 block">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this task"
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="dueDate" className="text-gray-700 dark:text-gray-300 mb-2 block">
              Schedule Task (Optional)
            </Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={getToday()}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty for immediate tasks, set date to schedule for later
            </p>
          </div>

          {isAdminMode && (
            <div>
              <Label htmlFor="customColor" className="text-gray-700 dark:text-gray-300 mb-2 block">Custom Color (Optional)</Label>
              <ColorPanel
                selectedColor={customColor || LEVEL_COLORS[taskLevel === 'custom' ? 'mid' : taskLevel]}
                onColorChange={(color) => setCustomColor(color || '')}
                title="Select Task Color"
                defaultColor={LEVEL_COLORS[taskLevel === 'custom' ? 'mid' : taskLevel]}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center gap-2 justify-start border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: customColor || LEVEL_COLORS[taskLevel === 'custom' ? 'mid' : taskLevel] }}
                  />
                  Choose Color
                </Button>
              </ColorPanel>
            </div>
          )}

          <div>
            <Label htmlFor="group" className={`text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-4 ${errors.selectedGroup ? 'text-red-500' : ''}`}>
              Group <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedGroup} onValueChange={(value) => {
              setSelectedGroup(value);
              if (errors.selectedGroup && value) {
                setErrors(prev => ({ ...prev, selectedGroup: false }));
              }
            }}>
              <SelectTrigger className={`bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                errors.selectedGroup ? 'border-red-500 dark:border-red-500' : ''
              }`}>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {groups.filter(g => !g.isDefault).map(group => (
                  <SelectItem key={group.id} value={group.id} className="text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      {group.icon && <span>{group.icon}</span>}
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.selectedGroup && (
              <p className="text-red-500 text-sm mt-1">Must complete this field</p>
            )}
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Repeat Days</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              <button
                type="button"
                onClick={() => toggleRepeatDay('daily')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  repeatDays.includes('daily')
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Daily
              </button>
              {weekDays.map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleRepeatDay(day.id)}
                  disabled={repeatDays.includes('daily')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    repeatDays.includes(day.id)
                      ? 'bg-blue-500 text-white'
                      : repeatDays.includes('daily')
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select Daily for every day, or specific days for weekly repetition
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit}
              className="flex-1"
            >
              Create Task
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
