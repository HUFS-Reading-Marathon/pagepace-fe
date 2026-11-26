import './loading.css';

const layouts = {
  list: ['row', 'row', 'row', 'row'],
  table: ['columns', 'columns', 'columns', 'columns', 'columns'],
  detail: ['heading', 'metrics', 'block', 'row'],
  stats: ['metrics', 'block', 'block'],
  form: ['field', 'field', 'block', 'action'],
} as const;

export default function ContentSkeleton({
  variant,
  label,
}: {
  variant: keyof typeof layouts;
  label?: string;
}) {
  return (
    <div
      className="content-skeleton"
      role={label ? 'status' : undefined}
      aria-hidden={!label || undefined}
    >
      {label && <span className="sr-only">{label}</span>}
      <div className="content-skeleton__layout" aria-hidden="true">
        {layouts[variant].map((part, index) => (
          <div className={`content-skeleton__${part}`} key={index}>
            {part === 'metrics' || part === 'columns' ? (
              <>
                <i />
                <i />
                <i />
              </>
            ) : (
              <i />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
