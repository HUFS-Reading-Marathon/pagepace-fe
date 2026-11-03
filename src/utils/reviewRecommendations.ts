import type { ParticipantBook, ReadingLog, ReviewTargetBook } from '../types/readingLog';

export type ReadingIntent = 'parallel' | 'paused';
export type ReviewRecommendation = 'completed' | 'paused' | 'ask' | 'optional' | 'hidden';

// Only explicit participant intent means a book was put down. A different title
// in today's entry alone must never imply that concurrent reading has stopped.
export function recommendReview(
  target: ReviewTargetBook,
  progress: ParticipantBook | undefined,
  previousBookIds: number[],
  selectedBookIds: number[],
  intent?: ReadingIntent,
): ReviewRecommendation {
  if (target.reviewCompleted) return 'hidden';
  if (target.completed) return 'completed';
  if (progress && selectedBookIds.includes(progress.libraryBookId)) return 'optional';
  if (intent === 'paused') return 'paused';
  if (intent === 'parallel') return 'optional';
  if (
    progress &&
    previousBookIds.includes(progress.libraryBookId) &&
    selectedBookIds.length > 0 &&
    !selectedBookIds.includes(progress.libraryBookId)
  )
    return 'ask';
  return 'optional';
}

export function previousReadingBookIds(
  logs: ReadingLog[],
  participationId: number,
  readingDate: string,
): number[] {
  const previous = logs.filter(
    (log) =>
      log.participationId === participationId &&
      log.readingDate < readingDate &&
      log.status !== 'REJECTED',
  );
  const latestDate = previous.reduce(
    (latest, log) => (log.readingDate > latest ? log.readingDate : latest),
    '',
  );
  return [
    ...new Set(
      previous
        .filter((log) => log.readingDate === latestDate)
        .flatMap((log) => log.books.map((book) => book.libraryBookId)),
    ),
  ];
}

// This is a reminder preference, never evidence of a review or competition credit.
// Store against both user and participant-book IDs, never a masked name or title.
export function loadReadingIntents(
  userId: number,
  participationId: number,
): Record<number, ReadingIntent> {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(`marathon:reading-intent:${userId}:${participationId}`) || '{}',
    );
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([key, value]) => /^\d+$/.test(key) && (value === 'parallel' || value === 'paused'),
      ),
    ) as Record<number, ReadingIntent>;
  } catch {
    return {};
  }
}
export function saveReadingIntents(
  userId: number,
  participationId: number,
  intents: Record<number, ReadingIntent>,
) {
  try {
    localStorage.setItem(
      `marathon:reading-intent:${userId}:${participationId}`,
      JSON.stringify(intents),
    );
  } catch {
    /* Storage restrictions must not block reading logs. */
  }
}
