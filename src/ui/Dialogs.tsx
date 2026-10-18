import { useEffect, useRef } from 'react';

export function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  // ตัวจับเวลาทำให้ render บ่อย — ผูก focus/คีย์ครั้งเดียวตอนเปิด ไม่งั้นโฟกัสจะถูกดึงกลับทุกเฟรม
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">รีเซ็ตความคืบหน้า?</h2>
        <p id="confirm-msg">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className="btn primary" ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RestoreBanner({
  summary,
  onRestore,
  onDiscard,
}: {
  summary: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="restore" role="region" aria-label="เซสชันที่ค้างไว้">
      <p>
        <strong>พบเซสชันที่ยังไม่จบ</strong>
        <span>{summary}</span>
      </p>
      <div className="restore-actions">
        <button type="button" className="btn small primary" onClick={onRestore}>
          กู้คืน
        </button>
        <button type="button" className="btn small ghost" onClick={onDiscard}>
          ไม่ใช้
        </button>
      </div>
    </div>
  );
}
