import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RosterRow } from '../src/api/adminRosterApi';
import ParticipantEditor from '../src/components/admin/participants/ParticipantEditor';

const participant: RosterRow = {
  serialNo: 1,
  eventId: 1,
  applicationId: 1,
  participationId: 1,
  courseId: 1,
  courseName: '풀 코스',
  name: '테스트',
  studentNo: '20260001',
  email: 'reader@example.test',
  phone: null,
  department: '철학과',
  affiliationType: 'UNDERGRADUATE',
  college: null,
  grade: '2학년',
  gender: null,
  applicationStatus: 'APPROVED',
  participationStatus: 'APPROVED',
  registeredAt: '2026-11-23T12:00:00',
  rejectReason: null,
};

function render(fields: Partial<RosterRow>) {
  return renderToStaticMarkup(
    <ParticipantEditor
      eventId={1}
      participant={{ ...participant, ...fields }}
      courses={[]}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
}

describe('참가자 수정 창의 소속 항목', () => {
  it('단과대학이 비어 있는 기존 학부생은 저장된 학과로 선택값을 찾는다', () => {
    const form = render({});
    for (const value of ['단과대학', '인문대학', '학과·학부', '철학과', '학년', '2학년']) {
      expect(form).toContain('>' + value + '<');
    }
  });

  it.each(['PROFESSOR', 'STAFF', 'GRADUATE', 'OTHER'] as const)(
    '%s 신분에는 기존 단과대·학년 값이 있어도 학과·부서만 표시한다',
    (affiliationType) => {
      const form = render({ affiliationType, college: '인문대학', grade: '2' });
      expect(form).toContain('>학과·부서<');
      expect(form).toContain('>철학과<');
      expect(form).not.toContain('>단과대학<');
      expect(form).not.toContain('>학년<');
    },
  );

  it('현재 목록에서 빠진 기존 소속과 학년은 열자마자 바뀌지 않는다', () => {
    const form = render({ college: '구 단과대학', department: '구 학과', grade: '수료' });
    for (const value of ['구 단과대학', '구 학과', '수료']) {
      expect(form).toContain('>' + value + '<');
    }
  });
});
