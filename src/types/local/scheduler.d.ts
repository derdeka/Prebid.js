export {};
declare global {
  type TaskPriority = "user-blocking" | "user-visible" | "background";

  interface SchedulerPostTaskOptions {
    delay?: number;
    priority?: TaskPriority;
    signal?: AbortSignal;
  }

  interface Scheduler {
    postTask<T, P extends readonly unknown[] | []>(callback: (...params: P) => T, options?: SchedulerPostTaskOptions, ...arguments: P): Promise<T>;
  }

  interface Window {
    /**
     * https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1249
     */
    scheduler?: Scheduler;
  }
}
