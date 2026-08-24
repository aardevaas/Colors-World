import { signOut } from '@/app/auth/actions';
import { ProjectSwitcher } from '@/components/projects/ProjectSwitcher';
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

  // Every visitor gets a real (anonymous) session from middleware.ts, so
  // `user` is never null in practice — but an anonymous user has no email
  // to show, and "save your account" is the more useful call to action.
  if (user.is_anonymous === true) {
    return (
      <a href="/login" className={styles.link}>
        save your account
      </a>
    );
  }

  return (
    <div className={styles.account}>
      {/* Renders nothing until there is more than one project to choose
          between, so a solo user never sees a control that cannot do
          anything. */}
      <ProjectSwitcher userId={user.id} />
      <form action={signOut} className={styles.form}>
        <span className={styles.email}>{user.email}</span>
        <button type="submit" className={styles.link}>
          sign out
        </button>
      </form>
    </div>
  );
}
