declare module 'eyeling' {
  export function reason(opts: any, input: string): string;
  export function runFiles(files: string[], opts?: any): number;
}
