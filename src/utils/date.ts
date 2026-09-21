const KO_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const KO_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...KO_DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
};

function formatValidDate(date: Date, options: Intl.DateTimeFormatOptions) {
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', options).format(date);
}

/** ISO 일시 문자열을 "YYYY. MM. DD." 형식으로 표시합니다. */
export function formatKoDate(value: string) {
  return formatValidDate(new Date(value), KO_DATE_OPTIONS);
}

/** "YYYY-MM-DD" 날짜 키를 로컬 자정 기준 "YYYY. MM. DD." 형식으로 표시합니다. */
export function formatKoDateKey(value: string) {
  return formatValidDate(new Date(`${value}T00:00:00`), KO_DATE_OPTIONS);
}

/** ISO 일시 문자열을 "YYYY. MM. DD. 오후 HH:MM" 형식으로 표시합니다. */
export function formatKoDateTime(value: string) {
  return formatValidDate(new Date(value), KO_DATE_TIME_OPTIONS);
}

/** ISO 일시 문자열을 "YYYY. MM. DD. HH:MM"(24시간제) 형식으로 표시합니다. */
export function formatKoDateTime24(value: string) {
  return formatValidDate(new Date(value), {
    ...KO_DATE_TIME_OPTIONS,
    hour12: false,
  });
}

/** 로컬 시간대 기준 "YYYY-MM-DD" 날짜 키를 만듭니다. */
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
