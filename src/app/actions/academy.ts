'use server';

import { revalidatePath } from 'next/cache';
import { courseBySlug } from '@/content/academyCourses';
import { enrol, isEnrolled, setLessonWatched } from '@/lib/academy/enrolment';
import { getSession } from '@/lib/session';

/**
 * Academy — enrolling, and keeping a place in a course.
 *
 * Both start by reading the session on the server. The browser sends which
 * course, never whose account: a field naming a user id would be an invitation
 * to write into somebody else's library.
 *
 * They return a status rather than redirecting, so the calling screen can show
 * the sign-in prompt in place — which is what the design does, and what keeps
 * the course somebody was looking at on screen while they sign in.
 */

export type EnrolResponse =
  | { status: 'enrolled' }
  | { status: 'already_enrolled' }
  | { status: 'sign_in_required' }
  | { status: 'unknown_course' };

export async function enrolAction(slug: string): Promise<EnrolResponse> {
  const course = courseBySlug(slug);
  if (!course) return { status: 'unknown_course' };

  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const result = await enrol(session.user.id, slug);
  if (result === 'unknown_course') return { status: 'unknown_course' };

  // Both of these list enrolments, and neither may be served from a cache
  // written before this one existed.
  revalidatePath('/en/marketplace/academy/my-learning');
  revalidatePath('/en/account/purchases');

  return { status: result === 'enrolled' ? 'enrolled' : 'already_enrolled' };
}

export type WatchedResponse =
  | { status: 'ok'; watched: boolean }
  | { status: 'sign_in_required' }
  | { status: 'not_enrolled' };

export async function setLessonWatchedAction(
  slug: string,
  lessonId: string,
  watched: boolean
): Promise<WatchedResponse> {
  const course = courseBySlug(slug);
  if (!course) return { status: 'not_enrolled' };

  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  /*
   * Progress belongs to people who own the course. Without this check anybody
   * signed in could mark their way to 100% of something they never bought, and
   * the "hours learned" figure on My Learning would count it.
   */
  if (!(await isEnrolled(session.user.id, slug))) return { status: 'not_enrolled' };

  await setLessonWatched(session.user.id, slug, lessonId, watched);
  revalidatePath('/en/marketplace/academy/my-learning');

  return { status: 'ok', watched };
}
