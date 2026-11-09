/**
 * Selects the properties of `Target` to cache: `true` for a value, a nested object for a child object.
 */
export type CachedApiProps<Target = any> = {
  [K in keyof Target]?: boolean | (NonNullable<Target[K]> extends object ? CachedApiProps<NonNullable<Target[K]>> : never);
};

/**
 * A value that has a subset of the properties of `Target`, recursively.
 */
type Subset<Target> = { [K in keyof Target]?: Subset<NonNullable<Target[K]>> };

/**
 * Wraps the properties of the object returned by `getTarget` flagged in `props` with getters that
 * read through to the target once, and serve the cached value until `reset()` is called.
 */
export class CachedApiWrapper<Target, T extends Subset<Target> & Record<Exclude<keyof T, keyof Target>, never>> {
  readonly obj: T;
  readonly reset: () => void;

  constructor(getTarget: () => Target, props: CachedApiProps<Target>) {
    const read = (key: string): unknown => (getTarget() as Record<string, unknown> | undefined)?.[key];
    const wrapper: Record<string, unknown> = {};
    let data: Record<string, unknown> = {};
    const children: Array<() => void> = [];
    Object.entries(props).forEach(([key, value]) => {
      if (value != null && typeof value === 'object') {
        const child = new CachedApiWrapper<unknown, Record<string, never>>(() => read(key), value as CachedApiProps);
        wrapper[key] = child.obj;
        children.push(child.reset);
      } else if (value === true) {
        Object.defineProperty(wrapper, key, {
          get() {
            if (!data.hasOwnProperty(key)) {
              data[key] = read(key);
            }
            return data[key];
          }
        });
      }
    });
    this.obj = wrapper as T;
    this.reset = () => {
      children.forEach(reset => reset());
      data = {};
    };
  }
}
