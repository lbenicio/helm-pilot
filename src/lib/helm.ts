import zlib from 'zlib';

export function parseHelmSecret(base64Data: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      zlib.gunzip(buffer, (err, decompressed) => {
        if (!err) {
          try {
            resolve(JSON.parse(decompressed.toString('utf-8')));
          } catch (e) {
            reject(e);
          }
          return;
        }
        try {
          const innerBuffer = Buffer.from(buffer.toString('utf-8'), 'base64');
          zlib.gunzip(innerBuffer, (err2, decompressed2) => {
            if (err2) return reject(err2);
            try {
              resolve(JSON.parse(decompressed2.toString('utf-8')));
            } catch (e) {
              reject(e);
            }
          });
        } catch {
          reject(err);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function encodeHelmRelease(releaseObj: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const jsonStr = JSON.stringify(releaseObj);
      zlib.gzip(jsonStr, (err, buffer) => {
        if (err) return reject(err);
        resolve(buffer.toString('base64'));
      });
    } catch (e) {
      reject(e);
    }
  });
}
