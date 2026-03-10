const API_BASE = window.APP_CONFIG?.API_BASE_URL || "http://localhost:3000";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();
  if (!token) return null;

  return {
    Authorization: `Bearer ${token}`
  };
}

/* ==============================
   TEMPLATE CLICK
============================== */

document.querySelectorAll(".template-card").forEach(card => {
  card.addEventListener("click", () => {
    const template = card.dataset.template;
    window.location.href = `journal-editor.html?template=${template}`;
  });
});


/* ==============================
   LOAD SAVED JOURNALS
============================== */

const savedContainer = document.getElementById("savedJournals");

if (savedContainer && getToken()) {
  loadSavedJournals();
}

async function loadSavedJournals() {
  try {
    const res = await fetch(`${API_BASE}/journal-entries`, {
      headers: authHeaders()
    });

    if (!res.ok) return;

    const data = await res.json();
    const pages = data.entries || [];

    pages.forEach(page => {
      const div = document.createElement("div");
      div.className = "template-card";

      div.innerHTML = `
        <div class="card-inner">
          <div class="template-title">
            ${page.topic}
          </div>
        </div>
      `;

      div.addEventListener("click", () => {
        window.location.href =
          `journal-editor.html?template=${page.templateType}&id=${page.id}`;
      });

      savedContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load saved journals:", err);
  }
}


/* ==============================
   LOTTIE ANIMATIONS
============================== */

function loadLottie(id, path) {
  const container = document.getElementById(id);
  if (!container) return;

  lottie.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: path
  });
}

loadLottie('weeklyAnim', 'assets/planner.json');
loadLottie('goalsAnim', 'assets/goals.json');
loadLottie('notesAnim', 'assets/notes.json');

function goHome() {
  window.location.href = "index.html";
}

/* ==============================
   BACK LOTTIE
============================== */

const backContainer = document.getElementById("backAnim");

if (backContainer) {
  const backAnimation = lottie.loadAnimation({
    container: backContainer,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: "assets/Back.json"
  });

  backContainer.addEventListener("click", () => {
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 0.3s ease";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 300);
  });
}
