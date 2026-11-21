const MEMORY_KEY = "reaction_memory_v1";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const HORROR_DURATION_MS = 6000;

let userData = {
  ad: "",
  soyad: ""
};

let cameraStream = null;
let snapTimer = null;

function goStep(stepId) {
  document.querySelectorAll(".step").forEach((sec) => {
    sec.classList.remove("active");
  });
  const target = document.getElementById(stepId);
  if (target) {
    target.classList.add("active");
  }
}

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
}

async function requestFrontCamPermission() {
  const permErr = document.getElementById("permErr");
  permErr.textContent = "";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    permErr.textContent = "Bu brauzer ön kameranı dəstəkləmir.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    stream.getTracks().forEach((track) => track.stop());
    goStep("step-1");
  } catch (err) {
    permErr.textContent = "Davam etmək üçün ön kameraya icazə verməlisiniz.";
  }
}

function saveName() {
  const ad = document.getElementById("adInput").value.trim();
  const soyad = document.getElementById("soyadInput").value.trim();
  const errMsg = document.getElementById("errMsg");

  if (!ad || !soyad) {
    errMsg.textContent = "Zəhmət olmasa ad və soyadınızı tam daxil edin.";
    return;
  }

  errMsg.textContent = "";
  userData.ad = ad;
  userData.soyad = soyad;
  goStep("step-3");
}

function getRawMemory() {
  try {
    const data = JSON.parse(localStorage.getItem(MEMORY_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveRawMemory(list) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(list));
}

function getActiveMemory() {
  const now = Date.now();
  const raw = getRawMemory();

  const validList = raw.filter((item) => now - item.createdAt < THREE_DAYS_MS);

  if (validList.length !== raw.length) {
    saveRawMemory(validList);
  }

  updateMemoryCount(validList.filter((item) => !item.deleted).length);
  return validList.filter((item) => !item.deleted);
}

function updateMemoryCount(count) {
  const el = document.getElementById("memCount");
  if (el) {
    el.textContent = count;
  }
}

function exitHorrorFullscreen() {
  const horrorVideo = document.getElementById("horrorVideo");
  if (horrorVideo) {
    horrorVideo.pause();
    horrorVideo.currentTime = 0;
    horrorVideo.classList.remove("active-horror-video");
  }

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

async function openHorror(answer) {
  goStep("step-horror");

  const label = document.getElementById("horrorChoiceText");
  const camInfo = document.getElementById("camInfo");
  const photoBox = document.getElementById("photoResultBox");
  const horrorVideo = document.getElementById("horrorVideo");
  const frontCam = document.getElementById("frontCam");

  photoBox.style.display = "none";
  label.textContent = `Son suala cavabınız: ${answer}`;
  camInfo.textContent = "Reaksiya çəkilir...";

  stopCameraStream();
  clearTimeout(snapTimer);

  horrorVideo.loop = false;
  horrorVideo.classList.add("active-horror-video");
  horrorVideo.currentTime = 0;
  horrorVideo.muted = false;

  try {
    await horrorVideo.play();
  } catch (err) {
    horrorVideo.muted = true;
    await horrorVideo.play().catch(() => {});
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    frontCam.srcObject = cameraStream;
    await frontCam.play();
  } catch (err) {
    camInfo.textContent = "Kamera açılmadı və ya icazə verilmədi.";
  }

  snapTimer = setTimeout(() => {
    takeSnapshot(frontCam, answer);
  }, HORROR_DURATION_MS);
}

function takeSnapshot(videoEl, answer) {
  exitHorrorFullscreen();

  if (!videoEl || videoEl.readyState < 2) {
    stopCameraStream();
    camInfo.textContent = "Kamera kadrı alınmadı.";
    return;
  }

  const canvas = document.getElementById("snapCanvas");
  const photoBox = document.getElementById("photoResultBox");
  const capturedPhoto = document.getElementById("capturedPhoto");
  const camInfo = document.getElementById("camInfo");

  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

  capturedPhoto.src = imageDataUrl;
  photoBox.style.display = "block";
  camInfo.textContent = "Şəkil çəkildi və Memory bölməsində 3 günlük saxlanıldı.";

  const record = {
    id: "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    ad: userData.ad || "Naməlum",
    soyad: userData.soyad || "",
    cavab: answer,
    image: imageDataUrl,
    createdAt: Date.now(),
    deleted: false
  };

  const list = getActiveMemory();
  list.unshift(record);
  saveRawMemory(list);
  updateMemoryCount(list.length);

  stopCameraStream();
}

function openMemory() {
  stopCameraStream();
  clearTimeout(snapTimer);
  exitHorrorFullscreen();

  renderMemory();
  goStep("step-memory");
}

function renderMemory() {
  const grid = document.getElementById("memoryGrid");
  const items = getActiveMemory();

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-msg">Memory boşdur və ya 3 günlük müddət bitib.</p>`;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const dateStr = new Date(item.createdAt).toLocaleString("az-AZ");
      const remainingDays = Math.max(
        0,
        ((THREE_DAYS_MS - (Date.now() - item.createdAt)) / (24 * 60 * 60 * 1000)).toFixed(1)
      );

      return `
        <div class="memory-card">
          <img src="${item.image}" alt="Reaksiya şəkli" />
          <div class="memory-meta">
            <strong>${escapeHtml(item.ad)} ${escapeHtml(item.soyad)}</strong><br/>
            Cavab: ${escapeHtml(item.cavab)}<br/>
            Tarix: ${dateStr}<br/>
            Qalan vaxt: ~${remainingDays} gün
          </div>
          <button type="button" class="del-btn" onclick="deleteMemoryItem('${item.id}')">Sil</button>
        </div>
      `;
    })
    .join("");
}

function deleteMemoryItem(id) {
  const raw = getRawMemory().map((item) => {
    if (item.id === id) {
      return { ...item, deleted: true };
    }
    return item;
  });
  saveRawMemory(raw);
  getActiveMemory();
  renderMemory();
}

function clearMemory() {
  const raw = getRawMemory().map((item) => ({ ...item, deleted: true }));
  saveRawMemory(raw);
  getActiveMemory();
  renderMemory();
}

function stopAndReset() {
  stopCameraStream();
  clearTimeout(snapTimer);
  exitHorrorFullscreen();
  resetPage();
}

function resetPage() {
  document.getElementById("adInput").value = "";
  document.getElementById("soyadInput").value = "";
  document.getElementById("errMsg").textContent = "";
  document.getElementById("permErr").textContent = "";
  document.getElementById("photoResultBox").style.display = "none";
  getActiveMemory();
  goStep("step-cam-perm");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

getActiveMemory();
    
