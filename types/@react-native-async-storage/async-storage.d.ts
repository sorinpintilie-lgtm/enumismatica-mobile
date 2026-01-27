declare module '@react-native-async-storage/async-storage' {
  export type ErrorLike = {
    message: string;
    key?: string;
  };

  export type Callback = (error?: Error | null) => void;

  export type CallbackWithResult<T> = (error?: Error | null, result?: T | null) => void;

  export type KeyValuePair = [string, string | null];

  export type MultiCallback = (errors?: readonly (Error | null)[] | null) => void;

  export type MultiGetCallback = (
    errors?: readonly (Error | null)[] | null,
    result?: readonly KeyValuePair[]
  ) => void;

  export type AsyncStorageHook = {
    getItem: (callback?: CallbackWithResult<string>) => Promise<string | null>;
    setItem: (value: string, callback?: Callback) => Promise<void>;
    mergeItem: (value: string, callback?: Callback) => Promise<void>;
    removeItem: (callback?: Callback) => Promise<void>;
  };

  export type AsyncStorageStatic = {
    getItem: (key: string, callback?: CallbackWithResult<string>) => Promise<string | null>;
    setItem: (key: string, value: string, callback?: Callback) => Promise<void>;
    removeItem: (key: string, callback?: Callback) => Promise<void>;
    mergeItem: (key: string, value: string, callback?: Callback) => Promise<void>;
    clear: (callback?: Callback) => Promise<void>;
    getAllKeys: (callback?: CallbackWithResult<readonly string[]>) => Promise<readonly string[]>;
    flushGetRequests: () => void;
    multiGet: (keys: readonly string[], callback?: MultiGetCallback) => Promise<readonly KeyValuePair[]>;
    multiSet: (
      keyValuePairs: ReadonlyArray<readonly [string, string]>,
      callback?: MultiCallback
    ) => Promise<void>;
    multiRemove: (keys: readonly string[], callback?: MultiCallback) => Promise<void>;
    multiMerge: (keyValuePairs: [string, string][], callback?: MultiCallback) => Promise<void>;
  };

  export function useAsyncStorage(key: string): AsyncStorageHook;

  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}
