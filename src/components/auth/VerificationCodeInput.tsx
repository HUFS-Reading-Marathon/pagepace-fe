import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';
import { fillVerificationCode } from './verificationCode';

type VerificationCodeInputProps = {
  value: string;
  length: number;
  disabled?: boolean;
  /** 입력 상태 안내 문구 요소의 id (aria-describedby) */
  describedById?: string;
  /** 값이 바뀔 때마다 숫자만 남긴 코드를 전달합니다. */
  onChange: (nextCode: string) => void;
  /** 값이 증가할 때마다 첫 번째 자리로 포커스를 옮깁니다. (인증번호 발송 직후 사용) */
  focusRequestKey?: number;
};

/** 한 자리씩 입력하는 이메일 인증번호(OTP) 입력 그룹 */
function VerificationCodeInput({
  value,
  length,
  disabled = false,
  describedById,
  onChange,
  focusRequestKey = 0,
}: VerificationCodeInputProps) {
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // 입력 중에는 바로 다음 칸으로 포커스를 옮겨야 빠르게 입력한 숫자도 빠지지 않습니다.
  const focusDigit = (index: number) => {
    digitRefs.current[index]?.focus();
  };

  useEffect(() => {
    if (focusRequestKey > 0) {
      // 인증번호 발송 직후에는 입력칸이 화면에 그려진 다음 첫 자리로 옮깁니다.
      const frameId = window.requestAnimationFrame(() => digitRefs.current[0]?.focus());

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [focusRequestKey]);

  /** 여러 자리를 한 번에 받으면(붙여넣기·자동완성) index 위치부터 이어서 채웁니다. */
  const fillDigits = (index: number, digits: string) => {
    const { code, nextFocusIndex } = fillVerificationCode(value, index, digits, length);

    onChange(code);
    focusDigit(nextFocusIndex);
  };

  const handleDigitChange = (index: number, nextValue: string) => {
    const digits = nextValue.replace(/\D/g, '');

    if (!digits) {
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }

    if (index > value.length) {
      focusDigit(value.length);
      return;
    }

    // 브라우저·메일 앱의 one-time-code 자동완성은 첫 칸에 전체 번호를 한 번에 넣습니다.
    if (digits.length > 1) {
      fillDigits(index, digits);
      return;
    }

    const digit = digits.slice(-1);
    const nextCode =
      index === value.length
        ? value + digit
        : value.slice(0, index) + digit + value.slice(index + 1);

    onChange(nextCode);

    if (index < length - 1) {
      focusDigit(index + 1);
    }
  };

  const handleDigitKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace') {
      event.preventDefault();

      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
        focusDigit(index);
      } else if (index > 0) {
        focusDigit(index - 1);
      }

      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusDigit(index - 1);
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      focusDigit(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();
    fillDigits(index, pastedDigits);
  };

  return (
    <>
      <span id="verification-code-label" className="sr-only">
        이메일 인증번호
      </span>
      <div
        className="auth-email-verification__otp"
        role="group"
        aria-labelledby="verification-code-label"
      >
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(element) => {
              digitRefs.current[index] = element;
            }}
            id={`verificationCode-${index + 1}`}
            className="auth-email-verification__digit"
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={value[index] ?? ''}
            onChange={(event) => handleDigitChange(index, event.target.value)}
            onKeyDown={(event) => handleDigitKeyDown(event, index)}
            onPaste={(event) => handlePaste(event, index)}
            onFocus={(event) => event.currentTarget.select()}
            // 첫 칸은 자동완성으로 전체 번호가 들어올 수 있도록 길이를 열어 둡니다.
            maxLength={index === 0 ? length : 1}
            disabled={disabled}
            aria-label={`인증번호 ${index + 1}번째 자리`}
            aria-describedby={describedById}
          />
        ))}
      </div>
    </>
  );
}

export default VerificationCodeInput;
