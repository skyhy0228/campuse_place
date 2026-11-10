import { ImageOff } from "lucide-react";
import { useState } from "react";
import { assetUrl } from "../lib/places";

interface Props {
  src: string;
  alt: string;
  className?: string;
  srcSet?: string;
  sizes?: string;
  // true면 로딩 실패 시 자리 표시 아이콘을 보여주고, false면 이미지를 통째로 숨긴다.
  showFallback?: boolean;
  failedLabel?: string;
  eager?: boolean;
}

export function PlaceImage({ src, alt, className = "", srcSet, sizes, showFallback = false, failedLabel, eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return showFallback ? (
      <div className={`imageFallback ${className}`} role="img" aria-label={failedLabel ?? `${alt} (사진을 불러오지 못했습니다)`}>
        <ImageOff size={24} aria-hidden="true" />
      </div>
    ) : null;
  }
  return (
    <img
      className={className}
      src={/^https?:/.test(src) ? src : assetUrl(src)}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
