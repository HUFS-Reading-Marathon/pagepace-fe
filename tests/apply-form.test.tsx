import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  formatCourseDistance,
  getApplicationDaysLeft,
  getCourseTargetPages,
  normalizeEmailIdInput,
  toApplicationEmail,
  usesSchoolEmailSuffix,
} from '../src/utils/applyForm';
import { koreaToday } from '../src/utils/eventSelection';
import ApplyPage from '../src/pages/auth/ApplyPage';
import { fillVerificationCode } from '../src/components/auth/verificationCode';

describe('참가신청 이메일 아이디 + 학교 도메인', () => {
  it('아이디만 입력하면 API에는 학교 도메인을 붙인 전체 주소를 보낸다', () => {
    expect(toApplicationEmail('example')).toBe('example@hufs.ac.kr');
    expect(toApplicationEmail('  example  ')).toBe('example@hufs.ac.kr');
    expect(toApplicationEmail('')).toBe('');
    expect(toApplicationEmail('   ')).toBe('');
  });

  it('학교 주소 전체를 붙여 넣거나 자동완성해도 도메인이 중복되지 않는다', () => {
    expect(normalizeEmailIdInput('example@hufs.ac.kr')).toBe('example');
    expect(normalizeEmailIdInput(' Example@HUFS.AC.KR ')).toBe('Example');
    expect(toApplicationEmail(normalizeEmailIdInput('example@hufs.ac.kr'))).toBe(
      'example@hufs.ac.kr',
    );
  });

  it('다른 도메인 주소는 막지 않고 그대로 보낸다 (도메인 정책은 서버 기준)', () => {
    expect(normalizeEmailIdInput('someone@example.com')).toBe('someone@example.com');
    expect(usesSchoolEmailSuffix('someone@example.com')).toBe(false);
    expect(toApplicationEmail('someone@example.com')).toBe('someone@example.com');
    expect(usesSchoolEmailSuffix('example')).toBe(true);
  });
});

describe('신청 마감까지 남은 기간', () => {
  it('한국 날짜 기준으로 마감일까지 남은 일수를 센다', () => {
    expect(getApplicationDaysLeft('2026-12-01', '2026-11-18')).toBe(13);
    expect(getApplicationDaysLeft('2026-03-01', '2026-02-28')).toBe(1);
    expect(getApplicationDaysLeft('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('마감일 당일은 0, 마감 후나 잘못된 날짜는 표시하지 않는다', () => {
    expect(getApplicationDaysLeft('2026-12-01', '2026-12-01')).toBe(0);
    expect(getApplicationDaysLeft('2026-12-01', '2026-12-02')).toBeNull();
    expect(getApplicationDaysLeft('', '2026-12-01')).toBeNull();
  });

  it('UTC 자정 직전이라도 한국 날짜가 바뀌었으면 그 날짜로 계산한다', () => {
    // 2026-11-30 15:30 UTC = 2026-12-01 00:30 KST
    const today = koreaToday(new Date('2026-11-30T15:30:00Z'));
    expect(today).toBe('2026-12-01');
    expect(getApplicationDaysLeft('2026-12-01', today)).toBe(0);
  });
});

describe('인증번호 6칸 채우기', () => {
  it('붙여넣기·자동완성한 번호를 6자리 문자열 그대로 유지한다', () => {
    expect(fillVerificationCode('', 0, '123456', 6)).toEqual({ code: '123456', nextFocusIndex: 5 });
    expect(fillVerificationCode('', 0, '12-34 56', 6).code).toBe('123456');
    expect(fillVerificationCode('', 0, '0012345678', 6).code).toBe('001234');
  });

  it('입력 중인 위치부터 이어서 채우고, 앞 칸이 비면 빈 첫 칸부터 채운다', () => {
    expect(fillVerificationCode('48', 2, '2017', 6)).toEqual({ code: '482017', nextFocusIndex: 5 });
    expect(fillVerificationCode('48', 4, '20', 6)).toEqual({ code: '4820', nextFocusIndex: 4 });
    expect(fillVerificationCode('482017', 0, '99', 6).code).toBe('992017');
  });
});

describe('참가 코스 표시', () => {
  it('목표 거리를 km 단위로 표시한다', () => {
    expect(formatCourseDistance(10000)).toBe('10km');
    expect(formatCourseDistance(21100)).toBe('21.1km');
    expect(formatCourseDistance(42195)).toBe('42.195km');
  });

  it('완주 쪽수는 1쪽 = 5m 기준으로 올림 계산한다', () => {
    expect(getCourseTargetPages(10000)).toBe(2000);
    expect(getCourseTargetPages(21100)).toBe(4220);
    expect(getCourseTargetPages(42195)).toBe(8439);
    expect(getCourseTargetPages(10001)).toBe(2001);
  });
});

describe('참가신청 화면 구조', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );

  it('그룹 라벨과 기존 입력 항목을 모두 보여 준다', () => {
    for (const label of ['기본 정보', '이메일 인증', '소속 정보', '참가 코스']) {
      expect(html).toContain(`class="apply-group__label">${label}</h2>`);
    }
    expect(html).toContain('<h1 id="apply-title">독서마라톤 참가신청</h1>');
    expect(html).toContain('id="name"');
    expect(html).toContain('id="studentNumber"');
    expect(html).toContain('id="phone"');
    expect(html).toContain('name="affiliation"');
    expect(html).toContain('<select id="department" disabled="">');
  });

  it('이메일은 아이디 입력창과 고정 학교 도메인으로 구성한다', () => {
    expect(html).toMatch(/<input id="email" type="text" inputMode="email"/);
    expect(html).toContain('id="email-suffix" class="apply-email__suffix">@hufs.ac.kr</span>');
  });

  it('개인정보 동의 체크박스와 참가신청 버튼을 유지한다', () => {
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('개인정보 수집 및 이용에');
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>참가신청하기<\/button>/);
  });

  it('행사 정보를 받기 전에는 신청 접수 상태를 단정해 표시하지 않는다', () => {
    expect(html).not.toContain('신청 접수 중');
    expect(html).not.toContain('마감까지');
    expect(html).toContain('코스 정보를 불러오는 중입니다.');
  });
});
