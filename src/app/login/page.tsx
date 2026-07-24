'use client';

import { useActionState, useState } from 'react';
import {
  passwordAuthAction,
  signInWithEmail,
  signInWithOAuthProvider,
  type SignInState,
} from './actions';
import styles from './login.module.css';

const INITIAL_STATE: SignInState = { status: 'idle', message: '' };

type PasswordMode = 'signin' | 'signup';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="currentColor"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="currentColor"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.56 21.79 24 17.3 24 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<PasswordMode>('signin');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    passwordAuthAction,
    INITIAL_STATE
  );
  const [magicState, magicFormAction, magicPending] = useActionState(signInWithEmail, INITIAL_STATE);

  const passwordDisabled = passwordPending || passwordState.status === 'sent';
  const magicDisabled = magicPending || magicState.status === 'sent';

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.wordmark}>Colors World</h1>
        <p className={styles.tagline}>Free for anyone. Sign in to save your work.</p>

        <div className={styles.oauthGroup}>
          <form action={signInWithOAuthProvider.bind(null, 'google')}>
            <button type="submit" className={styles.oauthButton}>
              <GoogleIcon />
              Continue with Google
            </button>
          </form>
          <form action={signInWithOAuthProvider.bind(null, 'github')}>
            <button type="submit" className={styles.oauthButton}>
              <GitHubIcon />
              Continue with GitHub
            </button>
          </form>
        </div>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.modeTabs}>
          <button
            type="button"
            className={mode === 'signin' ? styles.modeTabActive : styles.modeTab}
            onClick={() => setMode('signin')}
          >
            sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? styles.modeTabActive : styles.modeTab}
            onClick={() => setMode('signup')}
          >
            create account
          </button>
        </div>

        <form action={passwordFormAction} className={styles.form}>
          <input type="hidden" name="mode" value={mode} />
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoFocus
            disabled={passwordDisabled}
            className={styles.input}
          />
          <input
            type="password"
            name="password"
            placeholder="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            disabled={passwordDisabled}
            className={styles.input}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          <button type="submit" disabled={passwordDisabled} className={styles.button}>
            {passwordPending
              ? mode === 'signup'
                ? 'creating account…'
                : 'signing in…'
              : mode === 'signup'
                ? 'create account'
                : 'sign in'}
          </button>
        </form>

        {passwordState.message !== '' && (
          <p className={passwordState.status === 'error' ? styles.error : styles.success}>
            {passwordState.message}
          </p>
        )}

        <button
          type="button"
          className={styles.magicLinkToggle}
          onClick={() => setShowMagicLink((prev) => !prev)}
        >
          {showMagicLink ? '← use a password instead' : 'or email me a sign-in link instead →'}
        </button>

        {showMagicLink && (
          <>
            <form action={magicFormAction} className={styles.form}>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                required
                disabled={magicDisabled}
                className={styles.input}
              />
              <button type="submit" disabled={magicDisabled} className={styles.button}>
                {magicPending ? 'sending…' : 'send magic link'}
              </button>
            </form>
            {magicState.message !== '' && (
              <p className={magicState.status === 'error' ? styles.error : styles.success}>
                {magicState.message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
