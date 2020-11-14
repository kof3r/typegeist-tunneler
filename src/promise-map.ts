
type Resolution = {
  resolve(result: any): void,
  reject(error: any): void,
  timeout: NodeJS.Timeout,
}

export function createPromiseMap({ timeout = 30000 } = {}) {
  const map: Map<string, Resolution> = new Map();

  return {
    create(id: string): Promise<any> {
      const promise = new Promise((resolve, reject) => {
        map.set(
          id,
          {
            resolve,
            reject,
            timeout: setTimeout(() => {
              const r = map.get(id);
              if (r) {
                r.reject(new Error('timeout'));
                map.delete(id);
              }
            }, timeout),
          }
        );
      });
      return promise;
    },
    resolve(id: string, value: any) {
      const r = map.get(id);
      if (r) {
        r.resolve(value);
        clearTimeout(r.timeout);
        map.delete(id);
      }
    },
    reject(id: string, error: any) {
      const r = map.get(id);
      if (r) {
        r.reject(error);
        clearTimeout(r.timeout);
        map.delete(id);
      }
    },
    get length(): number {
      return map.size;
    }
  };
}
