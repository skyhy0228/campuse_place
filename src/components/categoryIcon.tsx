import { Coffee, Globe, Lightbulb, Megaphone, MessageCircle, Mountain, School, Sparkles, Utensils, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  식당: Utensils,
  카페: Coffee,
  학교시설: School,
  숨은장소: Sparkles,
  생활꿀팁: Lightbulb,
  유학생: Globe,
  관광지: Mountain,
  자유: MessageCircle,
  제보: Megaphone,
};

export const categoryIcon = (category: string): LucideIcon => ICONS[category] ?? MessageCircle;

// 캠퍼스 지도 핀처럼 HTML 문자열이 필요한 곳에서 쓰는 SVG 경로 (lucide 아이콘과 같은 모양을 단순화)
export const CATEGORY_PIN_COLORS: Record<string, string> = {
  식당: "#c2410c",
  카페: "#9a1f46",
  학교시설: "#134e7a",
  숨은장소: "#4c3a8f",
  생활꿀팁: "#1c5a3a",
  유학생: "#9b2c1f",
  관광지: "#6b5200",
  자유: "#3b4452",
  제보: "#1f4e6b",
};
