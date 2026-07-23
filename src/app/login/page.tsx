'use client';

import { useActionState } from 'react';
import { signInWithEmail, type SignInState } from './actions';
import styles from './login.module.css';

const INITIAL_STATE: SignInState = { status: 'idle', message: '' };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, INITIAL_STATE);
  const disabled = isPending || state.status === 'sent';

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.wordmark}>Colors World</h1>
        <p className={styles.tagline}>Sign in — no password, just a link.</p>

        <form action={formAction} className={styles.form}>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoFocus
            disabled={disabled}
            className={styles.input}
          />
          <button type="submit" disabled={disabled} className={styles.button}>
            {isPending ? 'sending…' : 'send magic link'}
          </button>
        </form>

        {state.message !== '' && (
          <p className={state.status === 'error' ? styles.error : styles.success}>
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
