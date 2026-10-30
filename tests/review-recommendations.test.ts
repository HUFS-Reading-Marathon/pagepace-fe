import { describe, expect, it } from "vitest";
import {
  previousReadingBookIds,
  recommendReview,
} from "../src/utils/reviewRecommendations";
import type {
  ParticipantBook,
  ReadingLog,
  ReviewTargetBook,
} from "../src/types/readingLog";
const target = {
  participantBookId: 10,
  participationId: 1,
  bookTitle: "500쪽 책",
  totalBookPages: 500,
  approvedReadPages: 200,
  completed: false,
  reviewCompleted: false,
} as ReviewTargetBook;
const progress = {
  participantBookId: 10,
  libraryBookId: 101,
} as ParticipantBook;
describe("서평은 제한이 아닌 추천", () => {
  it("500쪽 중 200쪽만 읽고 중단해도 서평을 추천한다", () => {
    expect(recommendReview(target, progress, [101], [202], "paused")).toBe(
      "paused",
    );
  });
  it("다른 책을 고른 사실만으로 중단을 추정하지 않는다", () => {
    expect(recommendReview(target, progress, [101], [202])).toBe("ask");
  });
  it("동시에 읽는다고 선택하면 강한 추천을 하지 않는다", () => {
    expect(recommendReview(target, progress, [101], [202], "parallel")).toBe(
      "optional",
    );
  });
  it("같은 일지에서 두 책을 함께 기록해도 중단으로 판단하지 않는다", () => {
    expect(recommendReview(target, progress, [101], [101, 202])).toBe(
      "optional",
    );
  });
  it("중단했던 책을 다시 선택하면 중단 추천을 하지 않는다", () => {
    expect(recommendReview(target, progress, [101], [101], "paused")).toBe(
      "optional",
    );
  });
  it("완독한 책은 서평을 추천하되 상태는 수정하지 않는다", () => {
    const complete = { ...target, completed: true, approvedReadPages: 500 };
    expect(recommendReview(complete, progress, [], [])).toBe("completed");
    expect(complete.reviewCompleted).toBe(false);
  });
  it("사용자가 작성했다고 표시한 현재 분량은 완독 여부와 무관하게 추천에서 숨긴다", () => {
    expect(
      recommendReview(
        { ...target, reviewCompleted: true },
        progress,
        [101],
        [202],
        "paused",
      ),
    ).toBe("hidden");
    expect(
      recommendReview(
        { ...target, completed: true, reviewCompleted: true },
        progress,
        [],
        [],
      ),
    ).toBe("hidden");
  });
  it("이전 기록이 없거나 책 식별이 불확실하면 중단 추천을 하지 않는다", () => {
    expect(recommendReview(target, undefined, [101], [202])).toBe("optional");
    expect(recommendReview(target, progress, [], [202])).toBe("optional");
  });
  it("이전 독서일의 모든 책을 사용하고 다른 행사와 반려·현재 일자는 제외한다", () => {
    const log = (
      date: string,
      ids: number[],
      participationId = 1,
      status = "APPROVED",
    ) =>
      ({
        readingDate: date,
        participationId,
        status,
        books: ids.map((libraryBookId) => ({ libraryBookId })),
      }) as ReadingLog;
    expect(
      previousReadingBookIds(
        [
          log("2026-10-28", [50]),
          log("2026-10-29", [101, 102]),
          log("2026-10-29", [103]),
          log("2026-10-30", [202]),
          log("2026-10-29", [999], 2),
          log("2026-10-29", [555], 1, "REJECTED"),
        ],
        1,
        "2026-10-30",
      ),
    ).toEqual([101, 102, 103]);
  });
});
