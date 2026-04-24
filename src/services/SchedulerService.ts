import * as vscode from 'vscode';
import { ScheduledTask } from '../types';
import { SCHEDULE_KEY } from '../constants';

export class SchedulerService {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly onTaskFire: (text: string) => Promise<void>,
    private readonly onTasksChanged: () => void,
  ) {}

  getTasks(): ScheduledTask[] {
    return this.globalState.get<ScheduledTask[]>(SCHEDULE_KEY, []);
  }

  async saveTask(task: ScheduledTask): Promise<void> {
    const tasks = this.getTasks().filter(t => t.id !== task.id);
    await this.globalState.update(SCHEDULE_KEY, [...tasks, task]);
    this.onTasksChanged();
  }

  async removeTask(id: string): Promise<void> {
    const tasks = this.getTasks().filter(t => t.id !== id);
    await this.globalState.update(SCHEDULE_KEY, tasks);
    this.onTasksChanged();
  }

  async markTaskDone(id: string): Promise<void> {
    const updated = this.getTasks().map(t => t.id === id ? { ...t, completedAt: Date.now() } : t);
    await this.globalState.update(SCHEDULE_KEY, updated);
    this.onTasksChanged();
  }

  armTask(task: ScheduledTask): void {
    const fire = async () => {
      await this.markTaskDone(task.id);
      await this.onTaskFire(task.text);
    };
    const delay = task.scheduledAt - Date.now();
    if (delay <= 0) {
      void fire();
    } else {
      setTimeout(() => void fire(), Math.min(delay, 2_147_483_647));
    }
  }

  async restoreScheduledTasks(): Promise<void> {
    let tasks = this.getTasks();
    if (tasks.length === 0) { return; }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const cleaned = tasks.filter(t => !t.completedAt || t.completedAt > sevenDaysAgo);
    if (cleaned.length !== tasks.length) {
      await this.globalState.update(SCHEDULE_KEY, cleaned);
      tasks = cleaned;
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const pending           = tasks.filter(t => !t.completedAt);
    const todayOrPastPending = pending.filter(t => t.scheduledAt <= endOfToday.getTime());
    const futurePending      = pending.filter(t => t.scheduledAt >  endOfToday.getTime());

    for (const task of futurePending) { this.armTask(task); }
    if (todayOrPastPending.length === 0) { return; }

    const fmt = (task: ScheduledTask) => {
      const preview = task.text.length > 40 ? task.text.slice(0, 40) + '…' : task.text;
      const time = new Date(task.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `«${preview}» в ${time}`;
    };
    const list = todayOrPastPending.map(fmt).join(', ');
    const choice = await vscode.window.showInformationMessage(
      `На сегодня нашёл задачи — ${list}`, 'Оставить', 'Отменить',
    );

    if (choice === 'Отменить') {
      for (const task of todayOrPastPending) { await this.removeTask(task.id); }
    } else {
      for (const task of todayOrPastPending) { this.armTask(task); }
    }
  }

  getScheduledContext(): string | undefined {
    const tasks = this.getTasks();
    if (tasks.length === 0) { return undefined; }

    const pending   = tasks.filter(t => !t.completedAt).sort((a, b) => a.scheduledAt - b.scheduledAt);
    const completed = tasks.filter(t =>  t.completedAt).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

    const preview = (t: ScheduledTask) => t.text.length > 80 ? t.text.slice(0, 80) + '…' : t.text;
    const hm = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lines: string[] = [];

    if (pending.length > 0) {
      lines.push('Предстоящие задачи:');
      for (const t of pending) {
        lines.push(`- «${preview(t)}» — ${new Date(t.scheduledAt).toLocaleString()}`);
      }
    }
    if (completed.length > 0) {
      lines.push('Выполненные задачи (сегодня):');
      for (const t of completed) {
        lines.push(`- ✓ «${preview(t)}» — запланировано на ${hm(t.scheduledAt)}, выполнено в ${hm(t.completedAt!)}`);
      }
    }
    return lines.length > 0 ? lines.join('\n') : undefined;
  }
}
