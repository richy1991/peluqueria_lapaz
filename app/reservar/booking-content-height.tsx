import { useLayoutEffect, useRef, type ReactNode } from "react";

export function BookingContentHeight({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || typeof ResizeObserver === "undefined") return;

    const updateHeight = () => {
      frame.style.height = `${content.getBoundingClientRect().height}px`;
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="booking-content-height" ref={frameRef}>
      <div className="booking-content-inner" ref={contentRef}>{children}</div>
    </div>
  );
}
