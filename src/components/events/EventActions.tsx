'use client';

import { useState, useTransition } from 'react';
import { reportEventAction } from '@/app/actions/events';
import { track } from '@/lib/events/analytics';
import { googleCalendarUrl, type CalendarEvent } from '@/lib/events/calendar';
import { REPORT_REASON_LABEL, type EventReportReason } from '@/lib/events/types';
import { Dialog } from './Dialog';
import { SaveButton } from './SaveButton';
import styles from './Events.module.css';

/**
 * Save, share, add to calendar, report.
 *
 * The calendar entry is built from the public event fields only — the joining
 * link is never in it, because a calendar entry is copied, shared and synced to
 * devices nobody here has any say over. The ICS is fetched from a route rather
 * than assembled in the browser, so the server decides what goes in it.
 */

export function EventActions({
  eventId,
  slug,
  title,
  saved,
  calendar,
}: {
  eventId: string;
  slug: string;
  title: string;
  saved: boolean;
  calendar: CalendarEvent;
}) {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        track({ name: 'event_shared', eventId, channel: 'system' });
        return;
      } catch {
        // Dismissed, or unsupported despite being present. Fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShared('Link copied.');
      track({ name: 'event_shared', eventId, channel: 'clipboard' });
    } catch {
      setShared('Copy the address from your browser bar to share this event.');
    }
  };

  const addToCalendar = (target: 'google' | 'ics') => {
    track({ name: 'event_calendar_action', eventId, target });
    setMenu(false);

    if (target === 'google') {
      window.open(googleCalendarUrl(calendar), '_blank', 'noopener,noreferrer');
      return;
    }

    // Same file for Apple and Outlook; the download is what differs, not the data.
    window.location.href = `/api/events/${slug}/calendar.ics`;
  };

  return (
    <div className={styles.actions}>
      <SaveButton eventId={eventId} slug={slug} title={title} saved={saved} variant="labelled" />

      <button type="button" className={styles.secondary} onClick={share}>
        Share
      </button>

      <div className={styles.menuWrap}>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={menu}
          aria-haspopup="menu"
          onClick={() => setMenu((open) => !open)}
        >
          Add to calendar
        </button>

        {menu && (
          <div className={styles.menu} role="menu">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => addToCalendar('google')}>
              Google Calendar
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => addToCalendar('ics')}>
              Apple Calendar (.ics)
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => addToCalendar('ics')}>
              Outlook (.ics)
            </button>
          </div>
        )}
      </div>

      <button type="button" className={styles.linkButton} onClick={() => setReporting(true)}>
        Report this event
      </button>

      <p className={styles.ctaStatus} role="status" aria-live="polite">
        {shared ?? ''}
      </p>

      {reporting && (
        <ReportDialog eventId={eventId} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}

function ReportDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [reason, setReason] = useState<EventReportReason>('misleading_claims');
  const [detail, setDetail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await reportEventAction({ eventId, reason, detail: detail || undefined });
      if (result.status === 'ok') {
        setSent(true);
        track({ name: 'event_reported', eventId, reason });
      } else if (result.status === 'unavailable') {
        setError(result.message);
      } else if (result.status === 'error') {
        setError(result.message);
      }
    });
  };

  if (sent) {
    return (
      <Dialog
        title="Thank you"
        onClose={onClose}
        footer={
          <button type="button" className={styles.primary} onClick={onClose}>
            Close
          </button>
        }
      >
        <p className={styles.dialogText} role="status">
          A moderator will look at this event. If it breaks the content rules it will be suspended
          while it is reviewed.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Report this event"
      description="Tell us what is wrong with it. Reports are read by a person."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="report-form" className={styles.primary} disabled={pending}>
            {pending ? 'Sending…' : 'Send report'}
          </button>
        </>
      }
    >
      <form id="report-form" onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="report-reason">
            Reason
          </label>
          <select
            id="report-reason"
            className={styles.input}
            value={reason}
            onChange={(event) => setReason(event.target.value as EventReportReason)}
          >
            {(Object.keys(REPORT_REASON_LABEL) as EventReportReason[]).map((value) => (
              <option key={value} value={value}>
                {REPORT_REASON_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="report-detail">
            Anything else
            <span className={styles.fieldOptional}> (optional)</span>
          </label>
          <textarea
            id="report-detail"
            className={styles.input}
            rows={4}
            maxLength={1000}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </div>

        {error && (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
