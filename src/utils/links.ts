/** 외부 링크(<a target="_blank">)에 필요한 보안 속성을 돌려줍니다. */
export function getExternalLinkAttrs(link: { external?: boolean }) {
  return link.external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};
}
