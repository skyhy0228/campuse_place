import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

// 네이티브 <dialog>의 showModal 은 포커스 가두기와 배경 비활성화를 처리한다.
// 요소가 먼저 제거되므로 닫은 뒤 포커스 복원은 직접 한다.
export function Modal({ labelledBy, onClose, children, className = "" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // 렌더 시점(autoFocus 이전)의 포커스 위치를 기억했다가 닫을 때 되돌린다.
  const opener = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modalOpen");
    const previous = opener.current;
    return () => {
      if (dialog.open) dialog.close();
      // 다른 모달이 아직 열려 있으면 스크롤 잠금을 유지한다.
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("modalOpen");
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // ESC 는 브라우저 기본 닫기 대신 앱 상태(주소 해시 포함)를 통해 닫는다.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
