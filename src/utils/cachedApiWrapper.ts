export type CachedApiProps = { [key: string]: boolean | CachedApiProps };

/**
 * Wraps the properties of the object returned by `getTarget` flagged in `props` with getters that
 * read through to the target once, and serve the cached value until `reset()` is called.
 */
export function CachedApiWrapper<T = any>(this: { obj: T; reset: () => void }, getTarget: () => any, props: CachedApiProps) {
  const wrapper: Record<string, any> = {};
  let data: Record<string, any> = {};
  const children: Array<() => void> = [];
  Object.entries(props).forEach(([key, value]) => {
    if (value != null && typeof value === 'object') {
      const child = new (CachedApiWrapper as any)(() => getTarget()?.[key], value);
      wrapper[key] = child.obj;
      children.push(child.reset);
    } else if (value === true) {
      Object.defineProperty(wrapper, key, {
        get() {
          if (!data.hasOwnProperty(key)) {
            data[key] = getTarget()?.[key];
          }
          return data[key];
        }
      });
    }
  });
  this.obj = wrapper as T;
  this.reset = function () {
    children.forEach(reset => reset());
    data = {};
  };
}
