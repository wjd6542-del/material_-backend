import QRCode from "qrcode";

/**
 * 문자열을 Data URL 형식의 QR 이미지로 변환
 * 품목 코드/입출고 번호 등을 프론트에서 바로 <img src> 로 표시하기 위해 사용
 * @param {string} code
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function generateQR(code) {
  const qr = await QRCode.toDataURL(code);
  return qr;
}
