// 맛집·카페의 음식 종류와 예시 사진을 고른다. (교통여지도 logic.js 의 규칙을 옮긴 것)
// 사진은 가게 사진이 아니라 음식 종류별 AI 생성 예시다 (public/images/food/CREDITS.md).

// 칩에 보이는 순서대로. group 은 식당/카페/주점 구분.
export const FOOD_TYPES = {
  jjamppong: { label: "짬뽕·짜장", group: "식당" },
  malatang: { label: "마라탕", group: "식당" },
  gukbap: { label: "국밥·찌개", group: "식당" },
  bbq: { label: "고기구이", group: "식당" },
  dakgalbi: { label: "닭갈비·찜닭", group: "식당" },
  chicken: { label: "치킨", group: "식당" },
  burger: { label: "버거", group: "식당" },
  bunsik: { label: "분식", group: "식당" },
  rice: { label: "덮밥·도시락", group: "식당" },
  noodle: { label: "국수", group: "식당" },
  donkatsu: { label: "돈가스", group: "식당" },
  sushi: { label: "초밥·우동", group: "식당" },
  pasta: { label: "파스타", group: "식당" },
  burrito: { label: "부리또·바비큐", group: "식당" },
  salad: { label: "샐러드·샌드위치", group: "식당" },
  cafeteria: { label: "학식", group: "식당" },
  coffee: { label: "커피", group: "카페" },
  bread: { label: "빵", group: "카페" },
  dessert: { label: "디저트", group: "카페" },
  pub: { label: "주점", group: "주점" },
};

// 이름 앞부분이 같으면 규칙보다 먼저 정한다.
const FOOD_EXCEPT = {
  엄정분식: "bbq",
  이씨식당: "bbq",
  뚝딱김치찌개: "gukbap",
  성대분식: "rice",
  만선식당: "rice",
  심향: "sushi",
  이정동묵밥: "noodle",
  꼬보: "pasta",
  커피단월: "bread",
  밀크티인: "coffee",
};

// 이름 + 메뉴에서 먼저 맞는 규칙을 쓴다.
const FOOD_RULES = [
  [/학교식단|학식|학생식당|교직원식당/, "cafeteria"],
  [/마라/, "malatang"],
  [/국수|묵밥|옹심이|육면/, "noodle"],
  [/짬뽕|짜장/, "jjamppong"],
  [/부리또|바베큐/, "burrito"],
  [/버거/, "burger"],
  [/파스타/, "pasta"],
  [/스시|초밥|우동/, "sushi"],
  [/도시락|덮밥|쌈밥/, "rice"],
  [/돈가스|돈까스|카츠/, "donkatsu"],
  [/닭갈비|찜닭/, "dakgalbi"],
  [/치킨|통닭/, "chicken"],
  [/삼겹|갈비살|갈매기|막창|곱창|목살/, "bbq"],
  [/국밥|순대국|해장국|감자탕|육개장|찌개/, "gukbap"],
  [/떡볶이|김밥|분식|쫄면/, "bunsik"],
  [/샐러드|샌드위치|포케|토스트/, "salad"],
];

const PUB = /주점|포차|이자카야|호프|술집|맥주|bar\b/i;

// category: 우리 분류(식당/카페) 또는 교통여지도 분류(음식점/카페/주점)
export function foodType({ name, menu = "", category }) {
  const exception = Object.keys(FOOD_EXCEPT).find((prefix) => name.startsWith(prefix));
  if (exception) return FOOD_EXCEPT[exception];
  if (category === "주점") return "pub";
  const text = `${name} ${menu}`;
  if (category === "카페") {
    if (/커피|다방/.test(name)) return "coffee";
    if (/빙수|와플|푸딩|밀크티|티라미수/.test(text)) return "dessert";
    if (/빵|크로와상|바게트|베이커리/.test(text)) return "bread";
    return "coffee";
  }
  for (const [re, key] of FOOD_RULES) if (re.test(text)) return key;
  if (PUB.test(name)) return "pub";
  return "";
}

// 같은 종류 안에서 메뉴에 맞는 변형 사진을 고른다. 이름과 첫 메뉴만 본다.
const PHOTO_VARIANTS = {
  gukbap: [
    [/뼈해장국|감자탕/, "gukbap-bone"],
    [/부대/, "gukbap-budae"],
    [/김치찌개/, "gukbap-kimchi"],
  ],
  bbq: [
    [/막창|곱창/, "bbq-makchang"],
    [/쭈꾸미|주꾸미/, "bbq-jjukkumi"],
  ],
  rice: [
    [/쌈밥/, "rice-ssam"],
    [/오징어볶음/, "bbq-jjukkumi"],
  ],
  burrito: [[/바베큐|바비큐|브리스킷/, "burrito-bbq"]],
  sushi: [
    [/우동/, "sushi-udon"],
    [/스시|초밥|오마카세/, "sushi-nigiri"],
  ],
};

export function foodPhoto({ name, menu = "" }, type) {
  if (!type) return "";
  const text = `${name} ${menu.split(/\s*[,|]\s*/)[0] ?? ""}`;
  const variant = (PHOTO_VARIANTS[type] ?? []).find(([re]) => re.test(text));
  return variant ? variant[1] : type;
}
