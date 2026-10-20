const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

// '교통대' → 'ㄱㅌㄷ'. 한글 음절이 아닌 글자는 그대로 둔다.
export function toChoseong(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.charCodeAt(0) - 0xac00;
    out += code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : ch;
  }
  return out;
}

export const isChoseongQuery = (token: string) => /^[ㄱ-ㅎ]+$/.test(token);
