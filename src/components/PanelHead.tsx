import type { ReactNode } from 'react';
import { SectionInfo } from './SectionInfo';

type Props = {
  title: string;
  info: string;
  infoTitle?: string;
  actions?: ReactNode;
};

export function PanelHead({ title, info, infoTitle, actions }: Props) {
  return (
    <div className="panel-head">
      <h3>
        {title}
        <SectionInfo text={info} title={infoTitle ?? title} />
      </h3>
      {actions && <div className="panel-head-actions">{actions}</div>}
    </div>
  );
}
