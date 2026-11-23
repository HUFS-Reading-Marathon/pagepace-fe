import { ApiError, apiRequest } from './apiClient';
import type { AffiliationType } from '../auth/authTypes';

export type SendEmailVerificationRequest = {
  email: string;
};

export type ConfirmEmailVerificationRequest = {
  email: string;
  code: string;
};

/** 서버 AffiliationType enum과 동일한 값입니다. */
export type ApplicationAffiliationType = AffiliationType;

export type CreateApplicationRequest = {
  eventId: number;
  courseId?: number;
  verificationToken: string;
  privacyConsentVersion: 'application-v1';
  name: string;
  studentNo: string;
  email: string;
  phone: string;
  affiliationType: ApplicationAffiliationType;
  department: string;
  college?: string;
  grade?: string;
  gender?: string;
};

export type CreateApplicationResponse = {
  applicationId: number;
  eventId: number;
  eventTitle: string;
  courseId: number;
  courseName: string;
  name: string;
  studentNo: string;
  email: string;
  phone: string;
  affiliationType: ApplicationAffiliationType;
  department: string;
  status: string;
  appliedAt: string;
};

const EMAIL_VERIFICATION_PATH = '/api/applications/email-verifications';

export async function sendApplicationEmailVerification(email: string) {
  const request: SendEmailVerificationRequest = { email };

  await apiRequest<unknown>(`${EMAIL_VERIFICATION_PATH}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    skipAuth: true,
  });
}

export async function confirmApplicationEmailVerification(email: string, code: string) {
  const request: ConfirmEmailVerificationRequest = { email, code };

  const proof = await apiRequest<{ verificationToken: string }>(
    `${EMAIL_VERIFICATION_PATH}/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      skipAuth: true,
    },
  );
  if (!proof?.verificationToken) throw new ApiError('이메일 인증 응답을 확인할 수 없습니다.');
  return proof.verificationToken;
}

export async function createApplication(request: CreateApplicationRequest) {
  const application = await apiRequest<CreateApplicationResponse>('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    skipAuth: true,
  });

  if (!application || !Number.isFinite(application.applicationId)) {
    throw new ApiError('참가신청 응답을 확인할 수 없습니다.', 200, 'INVALID_APPLICATION_RESPONSE');
  }

  return application;
}
