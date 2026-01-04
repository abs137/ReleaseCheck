// ------------ CONFIG ------------
const EXCEL_URL = "./PRV File.xlsx";   // Excel file in same folder as index.html
// ---------------------------------

let rows = [];          // [ [ID, VALUE], ... ]
let html5QrCode = null;
let isScanning = false;
let videoTrack = null;
let torchOn = false;

/* ---------- Load Excel ---------- */
async function loadExcel() {
  const msg = document.getElementById("message");
  if (msg) msg.textContent = "Loading data...";

  try {
    const res = await fetch(`${EXCEL_URL}?ts=${Date.now()}`); // cache buster
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const all = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    if (!all.length) throw new Error("Sheet is empty.");

    const firstRow = all[0];
    const firstCell = (firstRow[0] ?? "").toString().trim().toUpperCase();
    const hasHeader = firstCell === "ID";

    const startIndex = hasHeader ? 1 : 0;

    rows = all.slice(startIndex).map(r => [
      String(r[0] ?? "").trim().toUpperCase(),   // ID (normalized)
      String(r[1] ?? "").trim()                  // VALUE
    ]);

    console.log("Excel loaded. Rows:", rows.length);
    if (msg) msg.textContent = "Ready. Scan or enter an ID.";

  } catch (err) {
    console.error("Error loading Excel:", err);
    if (msg) msg.textContent = "⚠️ Could not load Excel file.";
  }
}

/* ---------- Helpers ---------- */
function cleanId(text) {
  if (!text) return "";
  return String(text)
    .replace(/^\][A-Z0-9]{2}/i, "")      // strips leading ]XX from some scanners
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function findValueById(idRaw) {
  const id = cleanId(idRaw).toUpperCase();
  if (!id) return null;

  const match = rows.find(r => r[0] === id);
  return match ? match[1] : null;
}

/* ---------- Search handler ---------- */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const input = document.getElementById("id");
  const msg = document.getElementById("message");
  const grid = document.getElementById("binsGrid");

  const searchId = cleanId(input.value);

  if (grid) grid.innerHTML = "";   // we are not using the grid now

  if (!searchId) {
    msg.innerHTML = "<span style='color:red'>Please enter or scan an ID.</span>";
    return;
  }

  if (!rows.length) {
    msg.innerHTML = "<span style='color:red'>Data not loaded yet. Please wait or refresh.</span>";
    return;
  }

  const value = findValueById(searchId);

  if (value === null || value === "") {
    msg.innerHTML = `<span style='color:red'>ID not found in data.</span>`;
  } else {
    msg.innerHTML = `<strong>${searchId}</strong> → ${value}`;
  }
  input.value = "";
  input.focus();
});

/* ---------- Scanner ---------- */
async function startScanner() {
  try {
    html5QrCode = new Html5Qrcode("qr-reader");
    isScanning = true;

    document.getElementById("scannerWrap").style.display = "block";
    const torchDiv = document.getElementById("torchControls");
    if (torchDiv) torchDiv.style.display = "block";

    await html5QrCode.start(
      { facingMode: "environment" },  // back camera
      {
        fps: 10,
        qrbox: 250,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      },
      (decodedText) => {
        const cleaned = cleanId(decodedText);
        document.getElementById("id").value = cleaned;
        stopScanner();
        document.getElementById("searchForm").requestSubmit();
      }
    );

    const video = document.querySelector("#qr-reader video");
    if (video && video.srcObject) {
      videoTrack = video.srcObject.getVideoTracks()[0];
    }

  } catch (err) {
    console.error("Scanner error:", err);
    alert("Could not start camera. Check permission and HTTPS.");
    stopScanner();
  }
}

async function stopScanner() {
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
    } catch (e) {
      console.warn("Error stopping scanner:", e);
    }
  }
  isScanning = false;
  document.getElementById("scannerWrap").style.display = "none";
  const torchDiv = document.getElementById("torchControls");
  if (torchDiv) torchDiv.style.display = "none";
  enableTorch(false);
}

async function enableTorch(on) {
  if (!videoTrack) return;
  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    torchOn = on;
    const btn = document.getElementById("torchToggleBtn");
    if (btn) {
      btn.textContent = on ? "🔦 Turn OFF Flashlight" : "💡 Turn ON Flashlight";
    }
  } catch (err) {
    console.warn("Torch not supported:", err);
  }
}

/* ---------- Wire buttons ---------- */
document.getElementById("scanBtn").addEventListener("click", startScanner);
document.getElementById("stopScanBtn").addEventListener("click", stopScanner);
document.getElementById("torchToggleBtn").addEventListener("click", () => {
  enableTorch(!torchOn);
});

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadExcel();
});
