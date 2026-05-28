type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusState({ title, body, actionLabel, onAction }: Props) {
  return (
    <section className="status-state">
      <strong>{title}</strong>
      <p>{body}</p>
      {actionLabel && onAction ? <button className="secondary-cta" onClick={onAction}>{actionLabel}</button> : null}
    </section>
  );
}
