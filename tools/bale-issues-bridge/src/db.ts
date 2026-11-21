export interface DBStatement {
 bind(...values: unknown[]): DBStatement;
 all<T>(): Promise<{ results: T[] }>;
 run(): Promise<{ meta?: {changes?:number} }>;
}
export interface Database { prepare(sql:string): DBStatement; }
export async function rows<T>(db:Database,sql:string,...values:unknown[]):Promise<T[]>{
 return (await db.prepare(sql).bind(...values).all<T>()).results;
}
export async function one<T>(db:Database,sql:string,...values:unknown[]):Promise<T|undefined>{return (await rows<T>(db,sql,...values))[0];}
export async function execute(db:Database,sql:string,...values:unknown[]):Promise<number>{return (await db.prepare(sql).bind(...values).run()).meta?.changes??0;}
