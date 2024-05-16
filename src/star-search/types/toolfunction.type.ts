/*
 * this function type is an agnostic function that can be used with the "unknown"
 * return type from the various possible tool types that may be selected
 * when an agent's decides to use a short-circuit tool
 *
 */

export type ToolFunction<T> = (params: T) => Promise<unknown>;
