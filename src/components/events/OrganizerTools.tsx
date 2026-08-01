'use client';

import { useState, useTransition } from 'react';
import {
  cancelEventAction,
  messageAttendeesAction,
  exportAttendeesAction,
} from '@/app/actions/eventOrganizer';
import type { Attendee } from '@/lib/data/organizerEvents';
import type { EventStatus } from '@/lib/events/types';
import { Dialog } from './Dialog';
import styles from './Events.module.css';

/**
 * The organizer's controls.
 *
 * Attendee email addresses are shown to the person running the event and to
 * nobody else, and the export says so out loud before it hands over a file —
 * downloading a list of other people's contact details is a thing that should
 * feel like a decision.
 */

export function OrganizerTools({
  eventId,
  slug,
  status,
  permissions,
  attendees,
}: {
  eventId: string;
  slug: string;
  status: EventStatus;
  permissions: { edit: boolean; cancel: boolean; analytics: boolean; export: boolean };
  attendees: Attendee[];
}) {
  const [dialog, setDialog] = useState<'cancel' | 'message' | 'export' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className={styles.heroActions}>
        {permissions.edit && status !== 'cancelled' && (
          <button type="button" className={styles.secondary} onClick={() => setDialog('message')}>
            Contact attendees
          </button>
        )}

        {permissions.export && (
          <button type="button" className={styles.secondary} onClick={() => setDialog('export')}>
            Download attendee list
          </button>
        )}

        {permissions.cancel && status === 'published' && (
          <button type="button" className={styles.linkButton} onClick={() => setDialog('cancel')}>
            Cancel this event
          </button>
        )}
      </div>

      <p className={styles.ctaStatus} role="status" aria-live="polite">
        {message ?? ''}
      </p>

      <section className={styles.panelCard} style={{ marginTop: 20 }}>
        <h2 className={styles.panelTitle}>
          Registrations ({attendees.length})
        </h2>

        {attendees.length === 0 ? (
          <p className={styles.emptyText} style={{ textAlign: 'left', margin: 0 }}>
            Nobody has registered yet. Registrations appear here as they come in.
          </p>
        ) : (
          <>
            {/* Cards rather than a dense table, so this is readable on a phone
                at the door of the venue, which is where it is actually used. */}
            {attendees.map((attendee) => (
              <div className={styles.manageRow} key={attendee.email}>
                <div className={styles.manageMain}>
                  <div className={styles.manageTitle}>{attendee.name}</div>
                  <div className={styles.manageMeta}>
                    {attendee.email}
                    {attendee.company && ` · ${attendee.company}`}
                    {attendee.role && ` · ${attendee.role}`}
                  </div>
                </div>
                <span
                  className={`${styles.status} ${
                    attendee.status === 'waitlisted' ? styles.statusDraft : styles.statusPublished
                  }`}
                >
                  {attendee.status === 'waitlisted' ? 'Waitlist' : 'Registered'}
                </span>
              </div>
            ))}
          </>
        )}
      </section>

      {dialog === 'cancel' && (
        <CancelDialog
          eventId={eventId}
          pending={pending}
          onClose={() => setDialog(null)}
          onDone={(text) => {
            setMessage(text);
            setDialog(null);
          }}
          run={startTransition}
        />
      )}

      {dialog === 'message' && (
        <MessageDialog
          eventId={eventId}
          count={attendees.length}
          pending={pending}
          onClose={() => setDialog(null)}
          onDone={(text) => {
            setMessage(text);
            setDialog(null);
          }}
          run={startTransition}
        />
      )}

      {dialog === 'export' && (
        <Dialog
          title="Download the attendee list"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className={styles.secondary} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await exportAttendeesAction({ eventId });
                    if (result.status === 'ok') {
                      const blob = new Blob([result.data.csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${slug}-attendees.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      setMessage('Attendee list downloaded.');
                    } else if (result.status !== 'sign_in_required') {
                      setMessage(result.message);
                    }
                    setDialog(null);
                  })
                }
              >
                Download CSV
              </button>
            </>
          }
        >
          <div className={`${styles.notice} ${styles.noticeWarn}`}>
            <p style={{ margin: 0 }}>
              This file contains the names and email addresses of people who registered. Once it
              leaves TradingNew we cannot recall it — keep it only as long as you need it for this
              event, and do not use it for anything else.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}

function CancelDialog({
  eventId,
  pending,
  onClose,
  onDone,
  run,
}: {
  eventId: string;
  pending: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  run: (fn: () => void) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog
      title="Cancel this event"
      description="Everyone registered is emailed straight away."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={pending || reason.trim().length < 10}
            onClick={() =>
              run(async () => {
                const result = await cancelEventAction({ eventId, reason });
                onDone(
                  result.status === 'ok'
                    ? 'Event cancelled and attendees notified.'
                    : result.status === 'sign_in_required'
                      ? 'Sign in again to do that.'
                      : result.message
                );
              })
            }
          >
            Cancel the event
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cancel-reason">
          Why is it cancelled?
        </label>
        <textarea
          id="cancel-reason"
          className={styles.input}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className={styles.fieldHint}>
          Shown on the event page and sent to attendees. At least a sentence.
        </p>
      </div>
    </Dialog>
  );
}

function MessageDialog({
  eventId,
  count,
  pending,
  onClose,
  onDone,
  run,
}: {
  eventId: string;
  count: number;
  pending: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  run: (fn: () => void) => void;
}) {
  const [body, setBody] = useState('');

  return (
    <Dialog
      title={`Message ${count} attendee${count === 1 ? '' : 's'}`}
      description="Sent as an email from TradingNew on your behalf. Attendee addresses are never shared with you in this flow."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={pending || body.trim().length < 10}
            onClick={() =>
              run(async () => {
                const result = await messageAttendeesAction({ eventId, message: body });
                onDone(
                  result.status === 'ok'
                    ? `Sent to ${result.data.sent} attendee${result.data.sent === 1 ? '' : 's'}.`
                    : result.status === 'sign_in_required'
                      ? 'Sign in again to do that.'
                      : result.message
                );
              })
            }
          >
            Send update
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="organizer-message">
          Your update
        </label>
        <textarea
          id="organizer-message"
          className={styles.input}
          rows={5}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
