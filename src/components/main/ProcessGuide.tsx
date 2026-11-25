import { PROCESS_STEPS } from '../../pages/main/mainPageContent';
import ProcessStepIcon from './ProcessStepIcon';

/** 참여방법 4단계와 거리 인정 안내(메인페이지·참여방법 페이지 공통) */
export default function ProcessGuide() {
  return (
    <>
      <ol className="process">
        {PROCESS_STEPS.map((step) => (
          <li className="process-step" key={step.no}>
            <span className="process-icon">
              <ProcessStepIcon name={step.icon} />
              <span className="step-no" aria-hidden="true">
                {step.no}
              </span>
            </span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </li>
        ))}
      </ol>

      <div className="process-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <p>
          <span>독서일지 승인으로 인정 쪽수 확정</span>
          <span>서평 확인을 거친 분량이 최종 인정 거리에 반영</span>
          <small>서평 확인을 기다리는 동안에도 다음 독서일지를 제출할 수 있습니다.</small>
        </p>
      </div>
    </>
  );
}
