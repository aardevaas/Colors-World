import { listProjectsForUser } from '@/lib/supabase/current-project';
import { currentProjectId } from '@/lib/supabase/require-project';
import { switchProjectAction } from '@/app/projects/actions';
import styles from './project-switcher.module.css';

/**
 * Which project you are working in.
 *
 * A Server Component and a plain form, so it needs no client JavaScript and
 * works before any arrives — the same choice the Book's export toggle makes,
 * and for the same reason: a project change has to be a navigation for the
 * server-rendered pages that read it to be rebuilt.
 *
 * Renders nothing for an anonymous visitor, and nothing for someone with a
 * single project. A switcher with one option is a control that cannot do
 * anything, and the whole product works without an account — most people will
 * never see this, which is the point of the split state model rather than a
 * shortcoming of it.
 */
export async function ProjectSwitcher({ userId }: { readonly userId: string }) {
  // `userId` is a prop rather than a lookup: AccountStatus has already
  // established the user, and every room renders that, so resolving the
  // session twice would be an extra auth round-trip on every page in the app.
  const projects = await listProjectsForUser(userId);
  if (projects.length < 2) return null;

  const current = await currentProjectId(userId);

  return (
    <form action={switchProjectAction} className={styles.form}>
      <label className={styles.label} htmlFor="project-switcher">
        Project
      </label>
      <select
        id="project-switcher"
        name="projectId"
        defaultValue={current}
        className={styles.select}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.go}>
        Switch
      </button>
    </form>
  );
}
