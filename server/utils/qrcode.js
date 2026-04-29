import QRCode from "qrcode";

/**
 * 동일 코드 반복 생성을 줄이기 위한 단순 LRU 캐시.
 * 리스트 응답마다 페이지당 20~50회 generateQR 가 호출되며, 같은 코드(품목코드/전표번호)에 대한
 * Data URL 은 결정적이라 캐시해도 안전하다.
 */
const QR_CACHE_MAX = 500;
const qrCache = new Map();

function getCached(key) {
  const hit = qrCache.get(key);
  if (hit === undefined) return undefined;
  // LRU: 최근 접근 키를 끝으로 이동
  qrCache.delete(key);
  qrCache.set(key, hit);
  return hit;
}

function setCached(key, value) {
  if (qrCache.has(key)) qrCache.delete(key);
  qrCache.set(key, value);
  if (qrCache.size > QR_CACHE_MAX) {
    // 가장 오래된 항목 제거
    const firstKey = qrCache.keys().next().value;
    qrCache.delete(firstKey);
  }
}

/**
 * 문자열을 Data URL 형식의 QR 이미지로 변환 (LRU 캐시 적용)
 * 품목 코드/입출고 번호 등을 프론트에서 바로 <img src> 로 표시하기 위해 사용
 * @param {string|null|undefined} code
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function generateQR(code) {
  if (!code) return "";
  const key = String(code);
  const cached = getCached(key);
  if (cached !== undefined) return cached;
  const qr = await QRCode.toDataURL(key);
  setCached(key, qr);
  return qr;
}
