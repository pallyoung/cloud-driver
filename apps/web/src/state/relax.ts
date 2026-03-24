import type { PropsWithChildren } from 'react';
import {
  RelaxProvider as RelaxProviderRuntime,
  action as actionRuntime,
  computed as computedRuntime,
  state as stateRuntime,
  useActions as useActionsRuntime,
  useRelaxState as useRelaxStateRuntime,
  useRelaxValue as useRelaxValueRuntime,
} from './relax-runtime.js';

export type Value<T> = {
  id: string;
  name?: string;
  __type?: T;
};

export type State<T> = Value<T>;
export type ValueGetter = <T>(value: Value<T>) => T;

export type Store = {
  get<T>(state: Value<T>): T;
  set<T>(state: State<T>, value: T): void;
};

type AnyFn = (...args: any[]) => any;

export const RelaxProvider = RelaxProviderRuntime as (props: PropsWithChildren) => JSX.Element;

export const state = stateRuntime as <T>(defaultValue: T, name?: string) => State<T>;

export const computed = computedRuntime as <T>(options: {
  get: (get: ValueGetter, prev?: T) => T;
  name?: string;
}) => Value<T>;

export const action = actionRuntime as {
  <R>(handler: (store: Store) => R, options?: { name?: string }): () => R;
  <P, R>(handler: (store: Store, payload: P) => R, options?: { name?: string }): (payload: P) => R;
};

export const useRelaxValue = useRelaxValueRuntime as <T>(state: Value<T>) => T;

export const useRelaxState = useRelaxStateRuntime as <T>(
  state: State<T>,
) => readonly [T, (value: T) => void];

export const useActions = useActionsRuntime as <T extends readonly AnyFn[]>(actions: T) => T;
