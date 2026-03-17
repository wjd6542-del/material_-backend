import QRCode from "qrcode";

// 문자열 qr 출력 처리
export async function generateQR(code) {
  const qr = await QRCode.toDataURL(code);
  return qr;
}
