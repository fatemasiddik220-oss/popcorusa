import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  Send,
  Youtube,
  Twitter,
  Megaphone,
  ExternalLink,
  Flame,
  Clock,
  AlertCircle,
  RefreshCw,
  ListFilter,
  CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, EcosystemTask, AdminConfig } from '../types.js';
import { api } from '../services/api.js';
import { haptic } from '../services/haptic.js';

interface TabTasksProps {
  user: User;
  tasks: EcosystemTask[];
  config: AdminConfig;
  onDailyCheckIn: () => Promise<void>;
  onCompleteTask: (taskId: string, elapsedSeconds?: number) => Promise<void>;
  onRefreshTasks?: () => Promise<void>;
}

interface TaskTimerEntry {
  startTime: number;
  delaySeconds: number;
}

export const TabTasks: React.FC<TabTasksProps> = ({
  user,
  tasks,
  config,
  onDailyCheckIn,
  onCompleteTask,
  onRefreshTasks,
}) => {
  const [subTab, setSubTab] = useState<'active' | 'claimed'>('active');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [activeTaskLoading, setActiveTaskLoading] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<{ taskId: string; message: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Task Timers Map: taskId -> { startTime, delayMinutes }
  const [taskTimers, setTaskTimers] = useState<{ [taskId: string]: TaskTimerEntry }>(() => {
    try {
      const saved = localStorage.getItem('pop_task_timers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const streakRewards = [5, 6, 7, 8, 10, 12, 15];
  const todayStr = new Date().toISOString().split('T')[0];
  const isCheckedInToday = user.lastCheckInDate === todayStr;

  // Hydrate taskTimers from server task.startedAt if present
  useEffect(() => {
    let updated = false;
    const nextTimers = { ...taskTimers };
    tasks.forEach(t => {
      const delaySeconds = typeof t.claimDelaySeconds === 'number'
        ? t.claimDelaySeconds
        : (typeof t.claimDelayMinutes === 'number' ? t.claimDelayMinutes * 60 : 0);
      if (t.startedAt && !t.completed && (!nextTimers[t.id] || nextTimers[t.id].startTime !== t.startedAt)) {
        nextTimers[t.id] = {
          startTime: t.startedAt,
          delaySeconds,
        };
        updated = true;
      }
    });
    if (updated) {
      setTaskTimers(nextTimers);
      try {
        localStorage.setItem('pop_task_timers', JSON.stringify(nextTimers));
      } catch {}
    }
  }, [tasks]);

  // Real-time 1-second ticker for active cooldown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async () => {
    if (isCheckedInToday || isCheckingIn) return;
    try {
      setIsCheckingIn(true);
      haptic.impact('heavy');
      await onDailyCheckIn();
      haptic.success();
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFE600', '#00E5FF', '#22C55E'],
      });
    } catch (err: any) {
      haptic.error();
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Helper to calculate cooldown state for a task (Seconds-based)
  const getTaskTimerStatus = (task: EcosystemTask) => {
    const delaySeconds = typeof task.claimDelaySeconds === 'number'
      ? task.claimDelaySeconds
      : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
    const timer = taskTimers[task.id];

    // If 0 seconds: instant claim!
    if (delaySeconds <= 0) {
      const isStarted = !!timer;
      return {
        hasDelay: false,
        isStarted,
        remainingSec: 0,
        isReadyToClaim: isStarted,
        formattedTime: '0s',
        progressPercent: 100,
      };
    }

    if (!timer) {
      return {
        hasDelay: true,
        isStarted: false,
        remainingSec: delaySeconds,
        isReadyToClaim: false,
        formattedTime: `${delaySeconds}s`,
        progressPercent: 0,
      };
    }

    const elapsedMs = currentTime - timer.startTime;
    const requiredMs = (timer.delaySeconds || delaySeconds) * 1000;
    const remainingMs = Math.max(0, requiredMs - elapsedMs);
    const remainingSec = Math.ceil(remainingMs / 1000);
    const isReadyToClaim = remainingSec <= 0;
    const progressPercent = Math.min(100, Math.max(0, ((requiredMs - remainingMs) / requiredMs) * 100));

    return {
      hasDelay: true,
      isStarted: true,
      remainingSec,
      isReadyToClaim,
      formattedTime: `${remainingSec}s`,
      progressPercent,
    };
  };

  // Start Task (Opens external link & starts cooldown timer)
  const handleStartTask = async (task: EcosystemTask) => {
    try {
      haptic.impact('medium');
      setTaskError(null);

      // Open task URL link
      if (task.url && task.url !== '#squad') {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(task.url);
        } else {
          window.open(task.url, '_blank');
        }
      }

      // Record start time on backend
      const delaySeconds = typeof task.claimDelaySeconds === 'number'
        ? task.claimDelaySeconds
        : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);
      const res = await api.startTask(task.id);
      const serverStartedAt = res?.startedAt || Date.now();
      const confirmedDelay = typeof res?.claimDelaySeconds === 'number'
        ? res.claimDelaySeconds
        : (typeof res?.claimDelayMinutes === 'number' ? res.claimDelayMinutes * 60 : delaySeconds);

      // Store in state and localStorage
      const updated = {
        ...taskTimers,
        [task.id]: {
          startTime: serverStartedAt,
          delaySeconds: confirmedDelay,
        }
      };
      setTaskTimers(updated);
      try {
        localStorage.setItem('pop_task_timers', JSON.stringify(updated));
      } catch {}

      haptic.impact('light');
    } catch (err: any) {
      console.warn('Task start error:', err);
    }
  };

  // Claim Task (Enforces cooldown timer and single claim)
  const handleClaimTask = async (task: EcosystemTask) => {
    // Single claim check
    const isCompleted = task.completed || (user.completedTasks && user.completedTasks.includes(task.id));
    if (isCompleted) {
      setTaskError({ taskId: task.id, message: 'This task has already been completed and claimed.' });
      return;
    }

    const timerStatus = getTaskTimerStatus(task);
    if (timerStatus.hasDelay && !timerStatus.isReadyToClaim) {
      setTaskError({
        taskId: task.id,
        message: `Cooldown active: Please wait ${timerStatus.formattedTime} before claiming this task!`
      });
      haptic.error();
      return;
    }

    try {
      setActiveTaskLoading(task.id);
      setTaskError(null);
      haptic.impact('heavy');

      const timer = taskTimers[task.id];
      const elapsedSeconds = timer ? (Date.now() - timer.startTime) / 1000 : 10;

      await onCompleteTask(task.id, elapsedSeconds);
      haptic.success();

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FFE600', '#00E5FF'],
      });

      setSuccessMsg(`Task completed! +${task.rewardPOP} POP added to your balance!`);

      // Clean up timer from state and localStorage
      const updated = { ...taskTimers };
      delete updated[task.id];
      setTaskTimers(updated);
      try {
        localStorage.setItem('pop_task_timers', JSON.stringify(updated));
      } catch {}

      setTimeout(() => setSuccessMsg(null), 3500);

      if (onRefreshTasks) {
        await onRefreshTasks();
      }
    } catch (err: any) {
      haptic.error();
      setTaskError({
        taskId: task.id,
        message: err.message || 'Task claim failed. Please try again.'
      });
    } finally {
      setActiveTaskLoading(null);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshTasks || isRefreshing) return;
    try {
      setIsRefreshing(true);
      await onRefreshTasks();
      haptic.impact('light');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'telegram':
        return <Send className="w-4 h-4 text-[#00E5FF]" />;
      case 'youtube':
        return <Youtube className="w-4 h-4 text-[#FF0000]" />;
      case 'x':
        return <Twitter className="w-4 h-4 text-white" />;
      case 'announcement':
      default:
        return <Megaphone className="w-4 h-4 text-[#FFE600]" />;
    }
  };

  // Partition tasks into Active (unclaimed) and Claimed (completed)
  const activeTasks = tasks.filter(
    (t) => !t.completed && (!user.completedTasks || !user.completedTasks.includes(t.id))
  );
  const claimedTasks = tasks.filter(
    (t) => t.completed || (user.completedTasks && user.completedTasks.includes(t.id))
  );

  return (
    <div className="space-y-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* 1. DAILY CHECK-IN CARD (7-DAY STREAK SYSTEM) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#121824] border border-[#252D3D] p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFE600]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFE600]/20 border border-[#FFE600]/40 flex items-center justify-center text-[#FFE600]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white font-display uppercase tracking-wide">
                Daily Check-In
              </h3>
              <span className="text-[11px] text-gray-400">
                Log in daily to scale your POP streak rewards
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0B0E14] border border-[#252D3D] text-xs font-bold text-[#FFE600] font-mono-digits">
            <Flame className="w-3.5 h-3.5 fill-[#FFE600]" />
            <span>Streak: {user.dailyStreak} Days</span>
          </div>
        </div>

        {/* 7-Day Visual Grid */}
        <div className="grid grid-cols-7 gap-1.5 my-3">
          {streakRewards.map((reward, idx) => {
            const dayNum = idx + 1;
            const isCompleted = user.dailyStreak >= dayNum;
            const isTodayTarget = isCheckedInToday
              ? user.dailyStreak === dayNum
              : (user.dailyStreak % 7) + 1 === dayNum;

            return (
              <div
                key={dayNum}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : isTodayTarget
                    ? 'bg-[#FFE600]/15 border-[#FFE600] text-[#FFE600] ring-1 ring-[#FFE600]/40 shadow-sm'
                    : 'bg-[#0B0E14] border-[#1E2638] text-gray-400'
                }`}
              >
                <span className="text-[9px] font-bold uppercase">D{dayNum}</span>
                <span className="text-[11px] font-black font-mono-digits my-1">+{reward}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="text-[8px] text-gray-500">POP</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Check-In Action Button */}
        <button
          onClick={handleCheckIn}
          disabled={isCheckedInToday || isCheckingIn}
          className={`w-full py-3 rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 font-display ${
            isCheckedInToday
              ? 'bg-[#1E2638] text-emerald-400 border border-emerald-500/30 cursor-default'
              : 'bg-gradient-to-r from-[#FFE600] to-[#FFB700] hover:opacity-95 text-black shadow-lg shadow-yellow-500/20 active:scale-[0.99]'
          }`}
        >
          {isCheckedInToday ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>CLAIMED TODAY — RETURN TOMORROW</span>
            </>
          ) : isCheckingIn ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>CLAIM DAY {user.dailyStreak + 1} REWARD</span>
            </>
          )}
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ======================================================================
          3. TASK MANAGEMENT: ACTIVE VS CLAIMED SUB-TABS
          ====================================================================== */}
      <div className="space-y-3">
        {/* Header with Title and Refresh */}
        <div className="flex items-center justify-between px-1">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Ecosystem Tasks & Missions
            </span>
            <span className="text-[10px] text-gray-400">
              Complete tasks to earn POP rewards. Cooldown timers apply where configured.
            </span>
          </div>

          {onRefreshTasks && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-[#121824] border border-[#252D3D] text-gray-400 hover:text-white transition-colors"
              title="Refresh tasks in real time"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00E5FF]' : ''}`} />
            </button>
          )}
        </div>

        {/* Sub-Tabs Switcher: Active Tasks vs Claimed Tasks */}
        <div className="grid grid-cols-2 p-1 bg-[#0F1420] border border-[#252D3D] rounded-2xl gap-1">
          <button
            onClick={() => {
              setSubTab('active');
              haptic.impact('light');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 font-display uppercase tracking-wide transition-all ${
              subTab === 'active'
                ? 'bg-[#FFE600] text-black shadow-md shadow-yellow-500/10'
                : 'text-gray-400 hover:text-white hover:bg-[#1A2234]/50'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Active Tasks</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-digits font-bold ${
                subTab === 'active' ? 'bg-black/20 text-black' : 'bg-[#1E2638] text-gray-400'
              }`}
            >
              {activeTasks.length}
            </span>
          </button>

          <button
            onClick={() => {
              setSubTab('claimed');
              haptic.impact('light');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 font-display uppercase tracking-wide transition-all ${
              subTab === 'claimed'
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/10'
                : 'text-gray-400 hover:text-white hover:bg-[#1A2234]/50'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Claimed Tasks</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-digits font-bold ${
                subTab === 'claimed' ? 'bg-black/20 text-black' : 'bg-[#1E2638] text-gray-400'
              }`}
            >
              {claimedTasks.length}
            </span>
          </button>
        </div>

        {/* TAB 1: ACTIVE TASKS */}
        {subTab === 'active' && (
          <div className="space-y-2.5 animate-in fade-in">
            {activeTasks.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-[#121824] border border-[#252D3D] text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                  All Caught Up!
                </h4>
                <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                  You have claimed all available tasks. Check back soon or switch to Claimed Tasks to view your history!
                </p>
              </div>
            ) : (
              activeTasks.map((task) => {
                const timerStatus = getTaskTimerStatus(task);
                const isLoading = activeTaskLoading === task.id;
                const currentError = taskError?.taskId === task.id ? taskError.message : null;
                const isCountingDown = timerStatus.hasDelay && timerStatus.isStarted && !timerStatus.isReadyToClaim;
                const delaySeconds = typeof task.claimDelaySeconds === 'number'
                  ? task.claimDelaySeconds
                  : (typeof task.claimDelayMinutes === 'number' ? task.claimDelayMinutes * 60 : 0);

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-2xl bg-[#121824] border transition-all ${
                      isCountingDown
                        ? 'border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : timerStatus.isReadyToClaim
                        ? 'border-[#FFE600]/60 shadow-lg shadow-yellow-500/10'
                        : 'border-[#252D3D] hover:border-[#00E5FF]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0B0E14] border border-[#252D3D] flex items-center justify-center shrink-0">
                          {getCategoryIcon(task.category)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#FFE600] font-mono-digits">
                              +{task.rewardPOP} POP
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono-digits">
                              (≈ ${(task.rewardPOP * config.popUsdRate).toFixed(3)} USD)
                            </span>
                            {delaySeconds > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-mono-digits font-semibold flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {delaySeconds}s delay
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono-digits font-semibold">
                                ⚡ Instant
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {/* 1. If timer is complete OR 0s delay started -> Ready to claim! */}
                        {timerStatus.isReadyToClaim ? (
                          <button
                            onClick={() => handleClaimTask(task)}
                            disabled={isLoading}
                            className="py-1.5 px-3.5 rounded-xl bg-[#FFE600] hover:bg-[#FFE600]/90 text-black font-extrabold text-xs flex items-center gap-1 transition-all shadow-md font-display uppercase neon-glow-yellow animate-pulse"
                          >
                            {isLoading ? (
                              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>CLAIM REWARD</span>
                              </>
                            )}
                          </button>
                        ) : isCountingDown ? (
                          /* 2. If countdown is active: KEEP CLAIM BUTTON DISABLED with live "Wait X seconds" countdown */
                          <button
                            disabled
                            className="py-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold flex items-center gap-1.5 cursor-not-allowed select-none"
                            title={`Wait ${timerStatus.remainingSec}s before claiming reward`}
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            <span>Wait {timerStatus.remainingSec}s</span>
                          </button>
                        ) : (
                          /* 3. Not started yet: START button (or Instant Claim if delay === 0) */
                          <div className="flex items-center gap-1.5">
                            {delaySeconds === 0 ? (
                              <button
                                onClick={async () => {
                                  await handleStartTask(task);
                                  await handleClaimTask(task);
                                }}
                                disabled={isLoading}
                                className="py-1.5 px-3.5 rounded-xl bg-[#FFE600] hover:bg-[#FFE600]/90 text-black font-extrabold text-xs flex items-center gap-1 transition-all shadow-md font-display uppercase"
                              >
                                {isLoading ? (
                                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>CLAIM</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartTask(task)}
                                disabled={isLoading}
                                className="py-1.5 px-3.5 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-extrabold text-xs flex items-center gap-1 transition-all shadow-md font-display uppercase"
                              >
                                <span>START</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Cooldown Progress Bar */}
                    {isCountingDown && (
                      <div className="mt-2.5 pt-2 border-t border-[#1E2638] space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Task Cooldown Active:
                          </span>
                          <span className="font-mono text-amber-400 font-bold">
                            Wait {timerStatus.remainingSec}s
                          </span>
                        </div>
                        <div className="w-full bg-[#0B0E14] h-1.5 rounded-full overflow-hidden border border-[#252D3D]">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-[#FFE600] transition-all duration-1000"
                            style={{ width: `${timerStatus.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Banner when early claim or verification fails */}
                    {currentError && (
                      <div className="mt-2.5 p-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl text-[11px] font-semibold flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{currentError}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: CLAIMED TASKS */}
        {subTab === 'claimed' && (
          <div className="space-y-2.5 animate-in fade-in">
            {claimedTasks.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-[#121824] border border-[#252D3D] text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#1A2234] border border-[#252D3D] flex items-center justify-center mx-auto text-gray-400">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                  No Claimed Tasks Yet
                </h4>
                <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                  You haven't completed any missions yet. Head over to Active Tasks to complete tasks and earn POP rewards!
                </p>
                <button
                  onClick={() => setSubTab('active')}
                  className="mt-2 py-2 px-4 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-bold hover:bg-[#00E5FF]/25 transition-all"
                >
                  Go to Active Tasks
                </button>
              </div>
            ) : (
              claimedTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-[#121824]/80 border border-emerald-500/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0B0E14] border border-[#252D3D] flex items-center justify-center shrink-0">
                      {getCategoryIcon(task.category)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-200 leading-snug">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-black text-emerald-400 font-mono-digits">
                          +{task.rewardPOP} POP Earned
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono-digits">
                          (≈ ${(task.rewardPOP * config.popUsdRate).toFixed(3)} USD)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="py-1 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✅ Claimed</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
