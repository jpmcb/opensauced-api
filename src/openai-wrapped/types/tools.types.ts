/*
 * this is a type that can be used in the Zod function parameter validation
 * for either a async function that returns a promise or a normal sync function
 * that returns a normal result.
 */

export type AsyncOrSyncFunction<T extends object, R> = (args: T) => Promise<R> | R;
