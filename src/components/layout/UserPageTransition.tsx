import { Component, type ReactNode } from 'react';
import './user-page-transition.css';

type Props = {
  children: ReactNode;
  pathname: string;
  identity: string;
};

const OPTIONS: KeyframeAnimationOptions = {
  duration: 280,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

/**
 * DOM 갱신 직전에 이전 본문의 보이는 부분을 보관합니다.
 * 스크롤 초기화는 이후 layout effect에서 실행되므로 이전 스크롤 위치도 그대로 담깁니다.
 * 표시본에는 React 컴포넌트와 이벤트 핸들러가 없어 API 조회가 다시 실행되지 않습니다.
 */
export default class UserPageTransition extends Component<Props> {
  private container: HTMLDivElement | null = null;
  private incoming: Animation | null = null;
  private outgoing = new Map<HTMLElement, Animation>();
  private motion: MediaQueryList | null = null;

  componentDidMount() {
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change', this.handleMotionChange);
    window.addEventListener('resize', this.clearTransition);
  }

  componentWillUnmount() {
    this.clearTransition();
    this.motion?.removeEventListener('change', this.handleMotionChange);
    window.removeEventListener('resize', this.clearTransition);
  }

  private handleMotionChange = () => {
    if (this.motion?.matches) this.clearTransition();
  };

  private clearTransition = () => {
    this.incoming?.cancel();
    this.incoming = null;
    for (const [element, animation] of this.outgoing) {
      animation.cancel();
      element.remove();
    }
    this.outgoing.clear();
  };

  getSnapshotBeforeUpdate(previous: Props): HTMLElement | null {
    if (
      previous.identity !== this.props.identity ||
      previous.pathname === this.props.pathname ||
      this.motion?.matches
    ) {
      return null;
    }

    const main = this.container?.querySelector('main');
    if (!main || typeof main.animate !== 'function') return null;
    const bounds = main.getBoundingClientRect();
    const header = document.querySelector('.site-header')?.getBoundingClientRect();
    const footer = document.querySelector('.site-footer')?.getBoundingClientRect();
    const top = Math.max(0, bounds.top, header?.bottom ?? 0);
    const bottom = Math.min(window.innerHeight, bounds.bottom, footer?.top ?? window.innerHeight);
    if (bottom <= top || bounds.width === 0) return null;

    const layer = document.createElement('div');
    layer.className = 'user-page-transition__snapshot';
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    Object.assign(layer.style, {
      top: `${top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      height: `${bottom - top}px`,
      opacity: getComputedStyle(main).opacity,
    });

    const copy = main.cloneNode(true) as HTMLElement;
    // 실제 본문의 앵커·라벨·폼과 표시본이 충돌하지 않도록 식별자를 제거합니다.
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    copy.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
      input.value = '';
      input.removeAttribute('value');
    });
    Object.assign(copy.style, {
      position: 'absolute',
      top: `${bounds.top - top}px`,
      left: '0',
      width: `${bounds.width}px`,
      margin: '0',
      animation: 'none',
    });
    layer.append(copy);
    return layer;
  }

  componentDidUpdate(previous: Props, _state: unknown, snapshot: HTMLElement | null) {
    if (previous.identity !== this.props.identity || this.motion?.matches) {
      this.clearTransition();
      return;
    }
    if (previous.pathname === this.props.pathname) return;

    // 연속 이동 시 진행 중이던 표시본도 현재 투명도에서 이어서 사라집니다.
    for (const [element, animation] of this.outgoing) {
      const opacity = getComputedStyle(element).opacity;
      animation.cancel();
      if (Number(opacity) < 0.01) {
        element.remove();
        this.outgoing.delete(element);
        continue;
      }
      this.clipToFooter(element);
      this.fadeOut(element, opacity);
    }
    this.incoming?.cancel();
    this.incoming = null;

    if (!snapshot) return;
    this.clipToFooter(snapshot);
    document.body.append(snapshot);
    this.fadeOut(snapshot, snapshot.style.opacity);
    const main = this.container?.querySelector('main');
    if (main) this.incoming = main.animate([{ opacity: 0 }, { opacity: 1 }], OPTIONS);
  }

  private clipToFooter(element: HTMLElement) {
    const footerTop =
      document.querySelector('.site-footer')?.getBoundingClientRect().top ?? window.innerHeight;
    element.style.height = `${Math.max(
      0,
      Math.min(parseFloat(element.style.height), footerTop - parseFloat(element.style.top)),
    )}px`;
  }

  private fadeOut(element: HTMLElement, opacity: string) {
    const animation = element.animate([{ opacity }, { opacity: 0 }], {
      ...OPTIONS,
      fill: 'forwards',
    });
    this.outgoing.set(element, animation);
    animation.finished.then(
      () => {
        if (this.outgoing.get(element) !== animation) return;
        this.outgoing.delete(element);
        element.remove();
      },
      () => undefined,
    );
  }

  render() {
    return (
      <div
        className="user-page-transition"
        ref={(element) => {
          this.container = element;
        }}
      >
        {this.props.children}
      </div>
    );
  }
}
