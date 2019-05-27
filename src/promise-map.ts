
type Resolution = {
  resolve(result: any): void,
  reject(error: any): void,
}

export function createPromiseMap() {
  const resolutions: { [cid: string]: Resolution } = {};

  return {
    create(id: string): Promise<any> {
      const promise = new Promise((resolve, reject) => {
        resolutions[id] = { resolve, reject };
      });
      return promise;
    },
    resolve(id: string, value: any) {
      if (id in resolutions) {
        resolutions[id].resolve(value);
        delete resolutions[id];
      }
    },
    reject(id: string, error: any) {
      if (id in resolutions) {
        resolutions[id].reject(error);
        delete resolutions[id];
      }
    },
    get length(): number {
      return Object.keys(resolutions).length;
    }
  };
}
