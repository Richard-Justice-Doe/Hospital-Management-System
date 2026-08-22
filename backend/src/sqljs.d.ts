declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown): void;
    export(): Uint8Array;
    prepare(sql: string): Statement;
  }

  export interface Statement {
    bind(params?: unknown): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayBuffer | Buffer | Uint8Array) => Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
