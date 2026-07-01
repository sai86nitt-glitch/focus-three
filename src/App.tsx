import { useState, useEffect, useRef } from "react";
import { Plus, Check, Calendar, ChevronRight, Inbox } from "lucide-react";

const STORAGE_KEY = "focus-tasks";

type Task = {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
};

const todayStr = () => new Date().toISOString().split("T")[0];

function daysFromToday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(todayStr() + "T00:00:00");
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function dateLabel(dateStr: string) {
  const diff = daysFromToday(dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Due Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function FocusTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [error, setError] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const incomplete = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : a.createdAt - b.createdAt));

  const visible = incomplete.slice(0, 3);
  const backlog = incomplete.slice(3);

  const dateCounts = incomplete.reduce<Record<string, number>>((acc, t) => {
    acc[t.targetDate] = (acc[t.targetDate] ?? 0) + 1;
    return acc;
  }, {});
  const overloadedDays = [...new Set(visible.map((t) => t.targetDate))]
    .filter((d) => dateCounts[d] > 3)
    .map((d) => ({
      date: d,
      hiddenCount: dateCounts[d] - visible.filter((t) => t.targetDate === d).length,
    }));

  const completedTasks = tasks
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 5);

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    if (!date) {
      setError("A target date is required.");
      return;
    }
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      targetDate: date,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
    };
    setTasks((prev) => [...prev, newTask]);
    setTitle("");
    setDate(todayStr());
    setError("");
    titleInputRef.current?.focus();
  }

  function completeTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: true, completedAt: Date.now() } : t))
    );
  }

  function reopenTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: false, completedAt: null } : t)));
  }

  function startReschedule(task: Task) {
    setReschedulingId(task.id);
    setRescheduleDate(task.targetDate);
  }

  function confirmReschedule(id: string) {
    if (!rescheduleDate) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, targetDate: rescheduleDate } : t))
    );
    setReschedulingId(null);
    setRescheduleDate("");
  }

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#1E1D1B] font-sans">
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="mb-7">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Focus Three</h1>
            <span className="text-xs uppercase tracking-widest text-[#8A8578]">
              {incomplete.length} open
            </span>
          </div>
          <p className="text-sm text-[#6B6656] mt-1">
            Only three tasks at a time. Finish one, or push its date out, to see the next.
          </p>
        </div>

        <form onSubmit={addTask} className="mb-8 bg-white rounded-2xl border border-[#E5E2D8] p-4">
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task..."
            className="w-full text-[15px] bg-transparent outline-none placeholder:text-[#B4AF9E] mb-3"
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 bg-[#F6F5F1] rounded-lg px-2.5 py-2 border border-[#E5E2D8]">
              <Calendar size={14} className="text-[#8A8578] shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-transparent outline-none text-sm text-[#4A4638]"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 bg-[#1E1D1B] text-white rounded-lg p-2.5 hover:bg-[#3A382F] transition-colors"
              aria-label="Add task"
            >
              <Plus size={16} />
            </button>
          </div>
          {error && <p className="text-xs text-[#B54A3F] mt-2">{error}</p>}
        </form>

        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-[#8A8578] mb-3">Your focus</h2>
          {visible.length === 0 ? (
            <div className="text-center py-10 text-[#B4AF9E] text-sm border border-dashed border-[#E5E2D8] rounded-2xl">
              Nothing in focus. Add a task above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((t, i) => {
                const overdue = daysFromToday(t.targetDate) < 0;
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border border-[#E5E2D8] p-4 flex items-start gap-3"
                  >
                    <button
                      onClick={() => completeTask(t.id)}
                      className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 border-[#D8D4C6] hover:border-[#1E1D1B] hover:bg-[#1E1D1B] transition-colors flex items-center justify-center group"
                      aria-label="Complete task"
                    >
                      <Check size={13} className="text-transparent group-hover:text-white" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-[#B4AF9E]">#{i + 1}</span>
                        <p className="text-[15px] leading-snug">{t.title}</p>
                      </div>
                      {reschedulingId === t.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="text-xs bg-[#F6F5F1] border border-[#E5E2D8] rounded-md px-2 py-1 outline-none"
                          />
                          <button
                            onClick={() => confirmReschedule(t.id)}
                            className="text-xs font-medium text-[#1E1D1B] underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setReschedulingId(null)}
                            className="text-xs text-[#B4AF9E]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startReschedule(t)}
                          className={`text-xs mt-1 ${overdue ? "text-[#B54A3F]" : "text-[#8A8578]"} hover:underline`}
                        >
                          {dateLabel(t.targetDate)} · move date
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {overloadedDays.map(({ date, hiddenCount }) => (
            <p key={date} className="text-xs text-[#B54A3F] mt-3">
              {hiddenCount} more task{hiddenCount === 1 ? "" : "s"} due {dateLabel(date)} — waiting below
            </p>
          ))}
        </div>

        {backlog.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-1.5 mb-2">
              <Inbox size={13} className="text-[#B4AF9E]" />
              <h2 className="text-xs uppercase tracking-widest text-[#8A8578]">
                Waiting ({backlog.length})
              </h2>
            </div>
            <div className="bg-white/60 rounded-2xl border border-[#E5E2D8] border-dashed p-3.5 space-y-2">
              {backlog.map((t) =>
                reschedulingId === t.id ? (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-[#8A8578]">{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="text-xs bg-[#F6F5F1] border border-[#E5E2D8] rounded-md px-2 py-1 outline-none"
                      />
                      <button
                        onClick={() => confirmReschedule(t.id)}
                        className="text-xs font-medium text-[#1E1D1B] underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setReschedulingId(null)}
                        className="text-xs text-[#B4AF9E]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-center justify-between text-sm text-[#8A8578]">
                    <span className="truncate">{t.title}</span>
                    <button
                      onClick={() => startReschedule(t)}
                      className={`text-xs shrink-0 ml-2 hover:underline ${
                        daysFromToday(t.targetDate) < 0 ? "text-[#B54A3F]" : "hover:text-[#4A4638]"
                      }`}
                    >
                      {dateLabel(t.targetDate)} · move date
                    </button>
                  </div>
                )
              )}
            </div>
            <p className="text-xs text-[#B4AF9E] mt-2 flex items-center gap-1">
              <ChevronRight size={12} /> Unlocks as you clear your focus list
            </p>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-widest text-[#8A8578] mb-2">Recently done</h2>
            <div className="space-y-1.5">
              {completedTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-[#B4AF9E] px-1">
                  <Check size={13} className="shrink-0" />
                  <span className="line-through truncate flex-1">{t.title}</span>
                  <button
                    onClick={() => reopenTask(t.id)}
                    className="text-xs shrink-0 hover:text-[#6B6656] hover:underline"
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
