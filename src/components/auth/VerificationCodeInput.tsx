import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from 'react';

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

  const focusDigit = (index: number) => {
    window.requestAnimationFrame(() => {
      digitRefs.current[index]?.focus();
    });
  };

  useEffect(() => {
    if (focusRequestKey > 0) {
      focusDigit(0);
    }
  }, [focusRequestKey]);

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

  const handleDigitKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
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

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();

    const startIndex = Math.min(index, value.length);
    const availableDigits = pastedDigits.slice(0, length - startIndex);
    const nextCode = (
      value.slice(0, startIndex) +
      availableDigits +
      value.slice(startIndex + availableDigits.length)
    ).slice(0, length);

    onChange(nextCode);
    focusDigit(Math.min(startIndex + availableDigits.length, length - 1));
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
            maxLength={1}
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
