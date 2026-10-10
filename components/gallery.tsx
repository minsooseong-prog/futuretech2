"use client";
import { useRef, useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { action } from "./forms";
export function Gallery({ ids, title }: { ids: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null),
    [index, setIndex] = useState(0);
  if (!ids.length) return null;
  function move(d: number) {
    setIndex((v) => (v + d + ids.length) % ids.length);
  }
  return (
    <>
      <div className="photo-grid">
        {ids.map((id, i) => (
          <button
            key={id}
            className="gallery-tile"
            onClick={() => {
              setIndex(i);
              dialog.current?.showModal();
            }}
            aria-label={`${title} 사진 ${i + 1} 크게 보기`}
          >
            <img
              src={`/api/media/${id}`}
              alt={`${title} 사진 ${i + 1}`}
              loading="lazy"
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="lightbox"
        aria-label="사진 크게 보기"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") move(-1);
          if (e.key === "ArrowRight") move(1);
        }}
      >
        <div className="lightbox-tools">
          <span>
            {index + 1} / {ids.length}
          </span>
          <button
            className="icon-button"
            aria-label="닫기"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <img
          src={`/api/media/${ids[index]}?size=full`}
          alt={`${title} 사진 ${index + 1}`}
        />
        {ids.length > 1 && (
          <div className="actions">
            <button
              className="button"
              onClick={() => move(-1)}
              aria-label="이전 사진"
            >
              <ChevronLeft />
            </button>
            <button
              className="button"
              onClick={() => move(1)}
              aria-label="다음 사진"
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    void action("view", { id }).catch(() => {});
  }, [id]);
  return null;
}
