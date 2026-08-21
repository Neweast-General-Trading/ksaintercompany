import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

let closeActiveTip: (() => void) | null = null;

type Props = {
  text: string;
  title?: string;
};

export function SectionInfo({ text, title }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();

  const hide = useCallback(() => {
    setOpen(false);
    if (closeActiveTip === hide) closeActiveTip = null;
  }, []);

  const show = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;

    if (closeActiveTip && closeActiveTip !== hide) closeActiveTip();
    closeActiveTip = hide;

    const rect = btn.getBoundingClientRect();
    const tipHeight = 120;
    const below = rect.bottom + 8 + tipHeight <= window.innerHeight - 8;
    setPos({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      above: !below,
    });
    setOpen(true);
  }, [hide]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => hide();
    const onResize = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, hide]);

  useEffect(() => () => {
    if (closeActiveTip === hide) closeActiveTip = null;
  }, [hide]);

  return (
    <>
      <span className="section-info">
        <button
          ref={btnRef}
          type="button"
          className="section-info-btn"
          aria-label={title ?? 'More information'}
          aria-describedby={open ? tipId : undefined}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          i
        </button>
      </span>
      {open &&
        createPortal(
          <div
            id={tipId}
            className={`section-info-tip section-info-tip-floating${pos.above ? ' above' : ''}`}
            role="tooltip"
            style={{
              top: pos.top,
              left: pos.left,
            }}
          >
            {title && <span className="section-info-tip-title">{title}</span>}
            <span className="section-info-tip-text">{text}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
