// =====================================================================
// QR code generation utility
//
// We build a unique payload string for each batch, then render it to a
// PNG image saved on disk. The payload is what a scanner reads; in Week 2
// the verification module will look up the stock by this exact payload.
//
// Payload format:  FTRC-<batchNumber>-<random hex>
//   FTRC = a fixed prefix so we can recognise our own codes when scanning.
// =====================================================================

const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Where generated PNGs are stored. Created at startup if missing.
const QR_DIR = path.join(__dirname, '..', 'qr_codes');
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

// Build a unique, hard-to-guess payload for a batch.
function buildPayload(batchNumber) {
  const random = crypto.randomBytes(6).toString('hex'); // 12 hex chars
  return `FTRC-${batchNumber}-${random}`;
}

// Generate the QR PNG for a given payload. Returns the saved file path.
async function generateQrImage(payload) {
  // Filename is the payload with unsafe characters replaced.
  const safeName = payload.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(QR_DIR, `${safeName}.png`);
  await QRCode.toFile(filePath, payload, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M', // tolerates some smudging/damage on print
  });
  return filePath;
}

module.exports = { buildPayload, generateQrImage, QR_DIR };
