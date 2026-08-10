import { apiRequest } from './apiClient';

export type SendEmailVerificationRequest = {
  email: string;
};

export type ConfirmEmailVerificationRequest = {
  email: string;
  code: string;
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

export async function confirmApplicationEmailVerification(
  email: string,
  code: string,
) {
  const request: ConfirmEmailVerificationRequest = { email, code };

  await apiRequest<unknown>(`${EMAIL_VERIFICATION_PATH}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    skipAuth: true,
  });
}
