import { ABOUT_SUMMARY, aboutHighlights } from './aboutContent';

/** 행사 개요 카드: 독서마라톤 설명과 핵심 수치(메인페이지) */
export default function EventAboutCard({ courseCount }: { courseCount: number }) {
  return (
    <article className="official-card about-card">
      <h3>독서마라톤이란?</h3>
      <p>{ABOUT_SUMMARY}</p>

      <div className="about-highlight" aria-label="독서마라톤 핵심 수치">
        {aboutHighlights(courseCount).map(({ title, caption }) => (
          <div key={title}>
            <b>{title}</b>
            <span>{caption}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
