
type Resolution = {
  resolve(result: any): void,
  reject(error: any): void,
  timeout: NodeJS.Timeout,
}

export function createPromiseMap({ timeout = 30000 } = {}) {
  const resolutions: { [cid: string]: Resolution } = {};

  return {
    create(id: string): Promise<any> {
      const promise = new Promise((resolve, reject) => {
        resolutions[id] = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            resolutions[id].reject(new Error('timeout'));
            delete resolutions[id];
          }, timeout),
        };
      });
      return promise;
    },
    resolve(id: string, value: any) {
      if (id in resolutions) {
        resolutions[id].resolve(value);
        clearTimeout(resolutions[id].timeout);
        delete resolutions[id];
      }
    },
    reject(id: string, error: any) {
      if (id in resolutions) {
        resolutions[id].reject(error);
        clearTimeout(resolutions[id].timeout);
        delete resolutions[id];
      }
    },
    get length(): number {
      return Object.keys(resolutions).length;
    }
  };
}
