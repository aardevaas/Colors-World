import { signOut } from '@/app/auth/actions';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import styles from './account-status.module.css';

/**
 * Server Component — a Client Component (ScaleLab, etc.) can't render this
 * directly, only receive it as a slot from a Server Component ancestor.
 * See src/app/page.tsx for how it's threaded through.
 */
export async function AccountStatus() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return (
      <a href="/login" className={styles.link}>
        sign in
      </a>
    );
  }

  return (
    <form action={signOut} className={styles.form}>
      <span className={styles.email}>{user.email}</span>
      <button type="submit" className={styles.link}>
        sign out
      </button>
    </form>
  );
}
