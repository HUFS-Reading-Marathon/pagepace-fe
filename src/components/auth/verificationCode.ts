/**
 * 인증번호 칸 index 위치부터 여러 자리를 이어서 채운 코드를 돌려줍니다.
 * (붙여넣기·one-time-code 자동완성처럼 한 번에 여러 숫자가 들어오는 경우)
 * 앞 칸이 비어 있으면 비어 있는 첫 칸부터 채워 코드 중간에 빈자리가 생기지 않게 합니다.
 */
export function fillVerificationCode(value: string, index: number, digits: string, length: number) {
  const startIndex = Math.min(index, value.length);
  const availableDigits = digits.replace(/\D/g, '').slice(0, length - startIndex);
  const code = (
    value.slice(0, startIndex) +
    availableDigits +
    value.slice(startIndex + availableDigits.length)
  ).slice(0, length);

  return { code, nextFocusIndex: Math.min(startIndex + availableDigits.length, length - 1) };
}
