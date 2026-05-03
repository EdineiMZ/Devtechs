/** BullMQ queue name — registered by QueueModule and reused by
 *  both the subscriber (producer) and the consumer (worker). */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** Job names inside the shared queue. The consumer dispatches
 *  on `job.name` so one queue can carry both email and in-app
 *  work without a separate broker. */
export const JOB_SEND_EMAIL = 'send-email';
export const JOB_CREATE_INAPP = 'create-inapp';

/** Shape of the payload pushed onto the `send-email` job. */
export interface SendEmailJob {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  /** Sender address override — must be on the verified Resend domain. */
  from?: string;
  replyTo?: string;
}

/** Shape of the payload pushed onto the `create-inapp` job. */
export interface CreateInappJob {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
}
