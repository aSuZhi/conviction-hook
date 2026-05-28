import type { AppCopy } from '../i18n';

type Props = {
  copy: AppCopy['checklist'];
};

export function DemoChecklist({ copy }: Props) {
  return (
    <section className="card">
      <p className="eyebrow">{copy.eyebrow}</p>
      <ul className="checklist">
        {copy.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
