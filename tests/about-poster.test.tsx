import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CurrentEvent } from '../src/api/eventApi';
import AboutIntro from '../src/pages/info/AboutIntro';
import EventPosterPanel from '../src/pages/info/EventPosterPanel';
import { posterForRound } from '../src/pages/info/eventPosters';
import EventAboutCard from '../src/components/main/EventAboutCard';

const event = {
  roundNo: 6,
  title: '제6회 독서마라톤',
  description: '행사 설명입니다.',
  applicationStartDate: '2026-11-01',
  applicationEndDate: '2026-11-30',
  eventStartDate: '2026-11-01',
  eventEndDate: '2026-12-31',
} as CurrentEvent;

describe('행사안내 공식 포스터', () => {
  it('포스터를 등록한 회차에만 보여 주고, 다른 회차·행사 정보 없음에는 보여 주지 않는다', () => {
    expect(posterForRound(6)).not.toBeNull();
    expect(posterForRound(7)).toBeNull();
    expect(posterForRound(5)).toBeNull();
    expect(posterForRound(undefined)).toBeNull();
    expect(posterForRound(null)).toBeNull();
  });

  it('원본 PNG는 1024×1536(2:3)이고 표시·확대용 WebP도 같은 비율이다', () => {
    const poster = posterForRound(6)!;
    expect(poster.height / poster.width).toBe(1.5);
    const png = readFileSync(`public${poster.original}`);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([poster.width, poster.height]);
    for (const path of [poster.display, poster.full]) {
      const webp = readFileSync(`public${path}`);
      expect(webp.subarray(8, 12).toString()).toBe('WEBP');
    }
  });

  it('포스터 버튼에는 그림만 있고(덧씌운 문구 없음), 별도 안내 문구 없이 모달은 처음에 닫혀 있다', () => {
    const html = renderToStaticMarkup(
      <EventPosterPanel
        poster={posterForRound(6)!}
        title="제6회 독서마라톤"
        onUnavailable={() => {}}
      />,
    );
    expect(html).toContain('aria-label="제6회 독서마라톤 포스터 크게 보기"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="1536"');
    expect(html).toContain('src="/posters/reading-marathon-poster.png"');
    // 이미지 아래의 별도 '포스터 크게 보기' 문구는 두지 않습니다.
    expect(html).not.toContain('>포스터 크게 보기</button>');
    expect(html).not.toContain('<dialog');
    const frame = html.match(/class="about-poster__frame"[^>]*>([\s\S]*?)<\/button>/)![1];
    expect(frame.replace(/<[^>]+>/g, '').trim()).toBe('');
  });

  it('등록된 회차는 포스터와 소개·핵심 수치·일정을 2열로, 그 밖의 회차는 포스터 없이 소개만 보여 준다', () => {
    const withPoster = renderToStaticMarkup(
      <AboutIntro currentEvent={event} courseCount={3} loading={false} />,
    );
    expect(withPoster).toContain('about-intro has-poster');
    expect(withPoster).toContain('about-poster');
    expect(withPoster).toContain('독서마라톤이란?');
    expect(withPoster).toContain('행사 설명입니다.');
    expect(withPoster).toContain('3개 코스');
    expect(withPoster).toContain('2026. 11. 01. ~ 2026. 11. 30.');
    expect(withPoster).toContain('2026. 11. 01. ~ 2026. 12. 31.');

    const otherRound = renderToStaticMarkup(
      <AboutIntro currentEvent={{ ...event, roundNo: 7 }} courseCount={3} loading={false} />,
    );
    expect(otherRound).not.toContain('about-poster');
    expect(otherRound).not.toContain('has-poster');
    expect(otherRound).toContain('독서마라톤이란?');
    expect(otherRound).toContain('2026. 11. 01. ~ 2026. 11. 30.');
  });

  it('행사 정보를 불러오는 동안에는 포스터 자리만 잡아 두고, 불러오지 못하면 소개만 보여 준다', () => {
    const loading = renderToStaticMarkup(
      <AboutIntro currentEvent={null} courseCount={0} loading />,
    );
    expect(loading).toContain('about-intro__poster--reserve');
    expect(loading).not.toContain('<img');
    const failed = renderToStaticMarkup(
      <AboutIntro currentEvent={null} courseCount={0} loading={false} />,
    );
    expect(failed).not.toContain('about-intro__poster');
    expect(failed).not.toContain('행사 일정');
  });

  it('메인페이지의 행사 개요 카드는 포스터 없이 기존 구조를 그대로 쓴다', () => {
    const html = renderToStaticMarkup(<EventAboutCard courseCount={3} />);
    expect(html).toContain('official-card about-card');
    expect(html).toContain('about-highlight');
    expect(html).not.toContain('poster');
  });
});
