declare module 'expo-apple-authentication' {
  export enum AppleAuthenticationScope {
    FULL_NAME = 0,
    EMAIL = 1,
  }

  export interface AppleAuthenticationSignInResult {
    identityToken: string | null;
  }

  export function signInAsync(options: {
    requestedScopes?: AppleAuthenticationScope[];
    nonce?: string;
  }): Promise<AppleAuthenticationSignInResult>;
}
