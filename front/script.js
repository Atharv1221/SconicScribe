const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const API_BASE = window.APP_CONFIG?.API_BASE_URL || "http://localhost:3000";

let recognition = null;
let isListening = false;
let finalTranscriptBuffer = "";
let useGoogleAPI = false;

// ================= AUTH CHECK =================
const token = localStorage.getItem("token");
if (!token) {
  console.warn("No token found");
}

// ================= DATA (FRONTEND CACHE) =================
const data = {
  notes: [],
  events: [],
  reminder: [],
  schedule: [],
  all: []
};

// ================= DOM =================
const micButton = document.getElementById("micButton");
const instructionText = document.getElementById("instructionText");
const transcriptText = document.getElementById("transcriptText");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const modalOverlay = document.getElementById("modalOverlay");
const clearBtn = document.getElementById("clearTranscriptBtn");
const clockTimeEl = document.getElementById("clockTime");
const clockDateEl = document.getElementById("clockDate");
const clockDayEl = document.getElementById("clockDay");

if ("Notification" in window) {
  Notification.requestPermission();
}

// Profile DOM
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const logoutBtn = document.getElementById("logoutBtn");

// ================= PROFILE ACTIONS =================
if (profileBtn) {
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
    const vPopup = document.getElementById("versionPopup");
    if (vPopup) vPopup.classList.remove("show");
  });
}

window.addEventListener("click", () => {
  if (profileDropdown) profileDropdown.classList.remove("show");
  const vPopup = document.getElementById("versionPopup");
  if (vPopup) vPopup.classList.remove("show");
  if (moreDropdown) moreDropdown.classList.remove("show");
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}

// ================= REGEX & CONSTANTS =================
const timeRegex = /\b(\d{1,2})(:\d{2})?\s?(am|pm)\b/i;
const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const MONTHS = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIcon(type, text) {
  const t = text.toLowerCase();

  // ===== KEYWORD MATCHING FIRST =====
  if (t.includes("school")) return "🏫";
  if (t.includes("college")) return "🎓";
  if (t.includes("class")) return "🏫";
  if (t.includes("study")) return "📚";
  if (t.includes("exam")) return "📝";
  if (t.includes("test")) return "📄";
  if (t.includes("assignment")) return "📑";
  if (t.includes("homework")) return "📘";
  if (t.includes("lecture")) return "👨‍🏫";
  if (t.includes("course")) return "📖";
  if (t.includes("meeting")) return "💼";
  if (t.includes("office")) return "🏢";
  if (t.includes("work")) return "💼";
  if (t.includes("project")) return "📊";
  if (t.includes("deadline")) return "⏳";
  if (t.includes("presentation")) return "📽️";
  if (t.includes("client")) return "👤";
  if (t.includes("interview")) return "🎤";
  if (t.includes("job")) return "💼";
  if (t.includes("resume")) return "📄";
  if (t.includes("code")) return "💻";
  if (t.includes("program")) return "👨‍💻";
  if (t.includes("debug")) return "🐞";
  if (t.includes("deploy")) return "🚀";
  if (t.includes("server")) return "🖥️";
  if (t.includes("database")) return "🗄️";
  if (t.includes("api")) return "🔗";
  if (t.includes("design")) return "🎨";
  if (t.includes("ui")) return "🖌️";
  if (t.includes("build")) return "🏗️";
  if (t.includes("call")) return "📞";
  if (t.includes("phone")) return "📱";
  if (t.includes("email")) return "✉️";
  if (t.includes("message")) return "💬";
  if (t.includes("chat")) return "💭";
  if (t.includes("zoom")) return "📹";
  if (t.includes("meet")) return "🎥";
  if (t.includes("gym")) return "🏋️";
  if (t.includes("workout")) return "💪";
  if (t.includes("exercise")) return "🤸";
  if (t.includes("run")) return "🏃";
  if (t.includes("walk")) return "🚶";
  if (t.includes("doctor")) return "👨‍⚕️";
  if (t.includes("hospital")) return "🏥";
  if (t.includes("medicine")) return "💊";
  if (t.includes("health")) return "❤️";
  if (t.includes("sleep")) return "😴";
  if (t.includes("eat")) return "🍽️";
  if (t.includes("lunch")) return "🍛";
  if (t.includes("dinner")) return "🍽️";
  if (t.includes("breakfast")) return "🥞";
  if (t.includes("cook")) return "🍳";
  if (t.includes("restaurant")) return "🍴";
  if (t.includes("water")) return "💧";
  if (t.includes("buy")) return "🛒";
  if (t.includes("shopping")) return "🛍️";
  if (t.includes("groceries")) return "🧺";
  if (t.includes("market")) return "🏬";
  if (t.includes("order")) return "📦";
  if (t.includes("amazon")) return "📦";
  if (t.includes("travel")) return "✈️";
  if (t.includes("flight")) return "✈️";
  if (t.includes("airport")) return "🛫";
  if (t.includes("drive")) return "🚗";
  if (t.includes("car")) return "🚗";
  if (t.includes("bus")) return "🚌";
  if (t.includes("train")) return "🚆";
  if (t.includes("taxi")) return "🚕";
  if (t.includes("trip")) return "🧳";
  if (t.includes("pay")) return "💳";
  if (t.includes("payment")) return "💰";
  if (t.includes("bill")) return "🧾";
  if (t.includes("salary")) return "💵";
  if (t.includes("bank")) return "🏦";
  if (t.includes("upi")) return "📱";
  if (t.includes("recharge")) return "🔋";
  if (t.includes("home")) return "🏠";
  if (t.includes("clean")) return "🧹";
  if (t.includes("wash")) return "🧼";
  if (t.includes("laundry")) return "👕";
  if (t.includes("repair")) return "🔧";
  if (t.includes("morning")) return "🌅";
  if (t.includes("afternoon")) return "🌤️";
  if (t.includes("evening")) return "🌇";
  if (t.includes("night")) return "🌙";
  if (t.includes("today")) return "📆";
  if (t.includes("tomorrow")) return "📅";
  if (t.includes("movie")) return "🎬";
  if (t.includes("music")) return "🎵";
  if (t.includes("game")) return "🎮";
  if (t.includes("youtube")) return "▶️";
  if (t.includes("netflix")) return "📺";
  if (t.includes("yoga")) return "🧘";
  if (t.includes("meditation")) return "🧘‍♂️";

  // ===== TYPE FALLBACK (only if no keyword matched) =====
  if (type === "reminder") return "⏰";
  if (type === "events") return "📅";
  if (type === "notes") return "📌";
  if (type === "schedule") return "🗓️";

  return "📝";
}

// ================= HEADERS =================
function authHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expired. Please login again.");
    window.location.href = "login.html";
    return {};
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

// ================= SPEECH SETUP =================
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

if (!SpeechRecognition) {
  alert("Speech Recognition not supported. Use Chrome.");
} else {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    instructionText.textContent = "Listening...";
    finalTranscriptBuffer = "";
    transcriptText.value = "";
    if (clearBtn) clearBtn.style.display = "none";
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      event.results[i].isFinal
        ? finalTranscriptBuffer += t + " "
        : interim += t;
    }
    transcriptText.value = finalTranscriptBuffer + interim;
    if (clearBtn) clearBtn.style.display = transcriptText.value.trim() ? "block" : "none";
  };
  recognition.onend = () => {
  isListening = false;
  micButton.classList.remove("listening");
};
}

// ================= MIC TOGGLE =================
if (micButton) {
  micButton.addEventListener("click", () => {

  if (!recognition) return;

  if (!isListening) {
    // START LISTENING
    recognition.start();
    isListening = true;

    micButton.classList.add("listening");

  } else {
    // STOP LISTENING
    recognition.stop();
    isListening = false;

    micButton.classList.remove("listening");
  }

});
}

// ================= MANUAL SAVE =================
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const text = transcriptText.value.trim();
    if (text) handleCommand(text);
  });
}

// ================= CLEAR =================
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    transcriptText.value = "";
    finalTranscriptBuffer = "";
    clearBtn.style.display = "none";
  });
}

if (transcriptText && clearBtn) {
  transcriptText.addEventListener("input", () => {
    clearBtn.style.display = transcriptText.value.trim() ? "block" : "none";
  });
}

// ================= PARSING =================
async function handleCommand(text) {
  const command = parseCommand(text);
  saveData(command);
  await syncToBackend(command);

  transcriptText.value = "";
  finalTranscriptBuffer = "";
  if (clearBtn) clearBtn.style.display = "none";
}

function parseCommand(text) {
  const raw = text.toLowerCase();
  const normalized = normalizeText(text);
  const parsedDate = extractDate(normalized);
  const parsedTime = extractTime(normalized);
  return {
    intent: detectIntent(raw),
    date: parsedDate,
    time: parsedTime,
    task: extractTask(normalized)
  };
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\b(a\.?\s?m\.?)\b/gi, "am")
    .replace(/\b(p\.?\s?m\.?)\b/gi, "pm")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(text) {
  if (/\b(remind|reminder|remind me|set reminder)\b/.test(text)) return "reminder";
  if (/\b(meeting|event)\b/.test(text)) return "events";
  if (/\b(schedule|plan|busy)\b/.test(text)) return "schedule";
  return "notes";
}

function extractDate(text) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const match = text.match(
    /\b(\d{1,2})(st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\b/
  );

  if (match) {
    const day = parseInt(match[1], 10);
    const month = MONTHS[match[3]];
    const year = today.getFullYear();
    const d = new Date(year, month, day);
    if (d < base) d.setFullYear(year + 1);
    return d.toDateString();
  }

  const nextWeekdayMatch = text.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (nextWeekdayMatch) {
    const isNext = Boolean(nextWeekdayMatch[1]);
    const target = WEEKDAYS[nextWeekdayMatch[2]];
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0 || isNext) diff += 7;
    const d = new Date(base);
    d.setDate(base.getDate() + diff);
    return d.toDateString();
  }

  if (text.includes("day after tomorrow")) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return d.toDateString();
  }
  if (text.includes("tomorrow")) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d.toDateString();
  }
  return base.toDateString();
}

function extractTime(text) {
  if (/\bnoon\b/i.test(text)) return "12:00 PM";
  if (/\bmidnight\b/i.test(text)) return "12:00 AM";

  // 12h style: 7pm, 7:30 pm
  const ampmMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const mins = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3].toUpperCase();
    if (hours >= 1 && hours <= 12 && mins >= 0 && mins <= 59) {
      const m = String(mins).padStart(2, "0");
      return `${hours}:${m} ${period}`;
    }
  }

  // 24h style: 19:30
  const h24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24Match) {
    let hours = parseInt(h24Match[1], 10);
    const mins = parseInt(h24Match[2], 10);
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${String(mins).padStart(2, "0")} ${period}`;
  }

  // hour only: at 7 / 7 o clock -> assume next upcoming hour, default PM if ambiguous daytime voice command
  const hourOnly = text.match(/\b(?:at|by)\s+(\d{1,2})(?:\s*o'?clock)?\b/i);
  if (hourOnly) {
    const rawHour = parseInt(hourOnly[1], 10);
    if (rawHour >= 1 && rawHour <= 12) {
      return `${rawHour}:00 PM`;
    }
  }

  return null;
}

function extractTask(text) {
  let task = text;
  const junk = [
    "to", "reminder", "set a reminder", "remind me", "schedule", "plan",
    "today", "tomorrow", "day after tomorrow", "next",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "at", "about", "as", "on"
  ];
  junk.forEach(j => {
    task = task.replace(new RegExp(`\\b${j}\\b`, "gi"), "");
  });
  task = task
    .replace(/\bnoon\b/gi, "")
    .replace(/\bmidnight\b/gi, "")
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, "")
    .replace(timeRegex, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!task) return "Untitled";
  return task.charAt(0).toUpperCase() + task.slice(1);
}

function composeReminderDateTime(dateStr, timeStr) {
  const baseDate = new Date(dateStr);
  if (Number.isNaN(baseDate.getTime())) {
    return new Date();
  }

  let hours = 9;
  let minutes = 0;

  if (timeStr) {
    const m = timeStr.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const p = m[3].toUpperCase();
      if (p === "PM" && h !== 12) h += 12;
      if (p === "AM" && h === 12) h = 0;
      hours = h;
      minutes = min;
    }
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

function toMySqlDateTime(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  const h = String(dateObj.getHours()).padStart(2, "0");
  const min = String(dateObj.getMinutes()).padStart(2, "0");
  const s = String(dateObj.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function parseBackendDateTime(value) {
  if (!value) return new Date();

  if (typeof value === "string" && (value.endsWith("Z") || value.includes("T"))) {
    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;
  }

  if (typeof value === "string") {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] || "0");
      const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MS;
      return new Date(utcMs);
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

// ================= FRONTEND SAVE =================
function saveData({ intent, task, date, time }) {
  const triggerAt = intent === "reminder"
    ? composeReminderDateTime(date, time).getTime()
    : null;

  const item = {
    id: crypto.randomUUID(),
    type: intent,
    text: task,
    date,
    time,
    triggerAt,
    triggered: false,
    done: false,
    createdAt: Date.now()
  };
  data[intent].push(item);
  rebuildUnifiedSchedule();
  updateCounts();
}

function rebuildUnifiedSchedule() {
  data.all = [
    ...data.notes,
    ...data.reminder,
    ...data.events,
    ...data.schedule
  ];
}

function renderSchedule() {
  rebuildUnifiedSchedule();
  const modalTitle = document.getElementById("modalTitle");
  if (modalTitle && modalTitle.textContent === "SCHEDULE") {
    viewCategory("schedule");
  }
}

function updateCounts() {
  const notesCount = document.getElementById("notesCount");
  const reminderCount = document.getElementById("reminderCount");
  const eventsCount = document.getElementById("eventsCount");
  const scheduleCount = document.getElementById("scheduleCount");

  if (notesCount) notesCount.textContent = data.notes.length;
  if (reminderCount) reminderCount.textContent = data.reminder.length;
  if (eventsCount) eventsCount.textContent = data.events.length;
  if (scheduleCount) scheduleCount.textContent = data.schedule.length;
}

// ================= BACKEND SYNC =================
async function syncToBackend({ intent, task, date, time }) {
  if (intent === "notes") return saveNote(task);
  if (intent === "reminder") return saveReminder(task, date, time);
  if (intent === "events") return saveEvent(task, date, time);
  if (intent === "schedule") return saveSchedule(task, date, time);
}

async function saveNote(content) {
  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content })
    });
    if (!res.ok) console.error(await res.text());
  } catch (err) {
    console.error("saveNote error:", err);
  }
}

async function saveReminder(content, date, time) {
  try {
    const reminderDate = composeReminderDateTime(date, time);
    const remindAt = toMySqlDateTime(reminderDate);
    const res = await fetch(`${API_BASE}/reminders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content, remindAt })
    });
    if (!res.ok) console.error(await res.text());
  } catch (err) {
    console.error("saveReminder error:", err);
  }
}

async function saveEvent(content, date, time) {
  try {
    const eventDate = composeReminderDateTime(date, time);
    const startTime = toMySqlDateTime(eventDate);
    const res = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: content, startTime, endTime: null })
    });
    if (!res.ok) console.error(await res.text());
  } catch (err) {
    console.error("saveEvent error:", err);
  }
}

async function saveSchedule(content, date, time) {
  try {
    const scheduleDate = composeReminderDateTime(date, time);
    const scheduleAt = toMySqlDateTime(scheduleDate);
    const res = await fetch(`${API_BASE}/schedule`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content, scheduleAt })
    });
    if (!res.ok) console.error(await res.text());
  } catch (err) {
    console.error("saveSchedule error:", err);
  }
}

// ================= FETCH & VIEW =================
async function fetchAndView(type) {
  const endpointMap = {
    notes: "notes",
    reminder: "reminders",
    events: "events",
    schedule: "schedule"
  };

  try {
    const res = await fetch(
      `${API_BASE}/${endpointMap[type]}`,
      { headers: authHeaders() }
    );

    if (!res.ok) {
      alert("Failed to load " + type);
      return;
    }

    const result = await res.json();

    if (type === "notes") {
      data.notes = result.notes.map(n => ({
        id: n.id,
        type: "notes",
        text: n.content,
        date: new Date().toDateString(),
        time: null,
        done: false
      }));
    }

    if (type === "reminder") {
      data.reminder = result.reminders.map(r => {
        const d = parseBackendDateTime(r.remind_at);
        return {
          id: r.id,
          type: "reminder",
          text: r.content,
          date: d.toDateString(),
          time: d.toLocaleTimeString("en-IN", {
            timeZone: IST_TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }),
          triggerAt: d.getTime(),
          triggered: false,
          done: Boolean(r.is_done)
        };
      });
      
    }

    if (type === "events") {
      data.events = result.events.map(e => {
        const d = parseBackendDateTime(e.start_time);
        return {
          id: e.id,
          type: "events",
          text: e.title,
          date: d.toDateString(),
          time: d.toLocaleTimeString("en-IN", {
            timeZone: IST_TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }),
          done: Boolean(e.is_done)
        };
      });
    }

    if (type === "schedule") {
      data.schedule = result.schedule.map(s => {
        const d = parseBackendDateTime(s.schedule_at || s.time);
        return {
          id: s.id,
          type: "schedule",
          text: s.content,
          date: d.toDateString(),
          time: d.toLocaleTimeString("en-IN", {
            timeZone: IST_TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }),
          done: false
        };
      });
    }

    rebuildUnifiedSchedule();
    updateCounts();

    if (type === "notes") {
      viewNotesEditable();
    } else {
      viewCategory(type);
    }

  } catch (err) {
    console.error(err);
    alert("Error loading " + type);
  }
}

// ================= VIEW CATEGORY =================
function viewCategory(type) {

  const modalItems = document.getElementById("modalItems");
  const modalTitle = document.getElementById("modalTitle");
  const modalOverlay = document.getElementById("modalOverlay");

  if (modalTitle) modalTitle.textContent = type.toUpperCase();
  if (!modalItems) return;

  modalItems.innerHTML = "";

  const items = data[type];

  if (!items || items.length === 0) {

    modalItems.innerHTML = "<p style='color:#6b7280'>No items found</p>";

  } else {

    // sort by date and time
    items.sort((a, b) => {
      const da = new Date(a.date + " " + (a.time || "23:59"));
      const db = new Date(b.date + " " + (b.time || "23:59"));
      return da - db;
    });

    let currentDate = "";

    items.forEach((item, index) => {

      // DATE HEADER
      if (item.date !== currentDate) {

        currentDate = item.date;

        const dateDiv = document.createElement("div");
        dateDiv.className = "date-header";
        dateDiv.textContent = formatDate(item.date);

        modalItems.appendChild(dateDiv);
      }

      // TEMPLATE RENDERING
      const template = document.getElementById("scheduleItemTemplate");

      if (!template) {
        console.error("scheduleItemTemplate not found in HTML");
        return;
      }

      const clone = template.content.cloneNode(true);

      // get elements
      const icon = clone.querySelector(".item-icon");
      const text = clone.querySelector(".item-text");
      const time = clone.querySelector(".item-time");

      const doneBtn = clone.querySelector(".btn-done");
      const editBtn = clone.querySelector(".btn-edit");
      const deleteBtn = clone.querySelector(".btn-delete");

      // set values
      icon.textContent = getIcon(type, item.text);

      text.textContent = item.text;

      if (item.done) {
        text.classList.add("done");
      }

      if (item.time) {
        time.textContent = item.time;
      } else {
        time.style.display = "none";
      }

      doneBtn.textContent = item.done ? "UNDO" : "DONE";

      // button logic
      doneBtn.onclick = () => toggleDone(type, index);
      editBtn.onclick = () => editItem(type, index);
      deleteBtn.onclick = () => deleteItem(type, index);

      // append to modal
      modalItems.appendChild(clone);

    });

  }

  if (modalOverlay) modalOverlay.style.display = "flex";
}

async function deleteItem(type, index) {
  if (!confirm("Delete this item?")) return;

  const item = data[type][index];

  let endpoint;
  if (type === "reminder") endpoint = "reminders";
  else if (type === "events") endpoint = "events";
  else return;

  try {
    const res = await fetch(
      `${API_BASE}/${endpoint}/${item.id}`,
      {
        method: "DELETE",
        headers: authHeaders()
      }
    );

    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    data[type].splice(index, 1);
    viewCategory(type);

  } catch (err) {
    console.error("Delete error:", err);
  }
}

async function editItem(type, index) {
  const item = data[type][index];
  const newText = prompt("Edit item:", item.text);

  if (!newText) return;

  let endpoint;
  if (type === "reminder") endpoint = "reminders";
  else if (type === "events") endpoint = "events";
  else return;

  try {
    const res = await fetch(
      `${API_BASE}/${endpoint}/${item.id}`,
      {
        method: "PUT",
        // FIX: Added 'Content-Type' so the backend reads the body
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: newText,   // for reminders
          title: newText,     // for events
          is_done: item.done
        })
      }
    );

    if (!res.ok) {
      alert("Update failed");
      return;
    }
    
    // Update frontend only after success
    item.text = newText;
    viewCategory(type);

  } catch (err) {
    console.error("Edit error:", err);
  }
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

async function toggleDone(type, index) {
  const item = data[type][index];

  let endpoint;
  if (type === "reminder") endpoint = "reminders";
  else if (type === "events") endpoint = "events";
  else return; // schedule doesn't support done yet

  const newDoneState = !item.done;

  try {
    const res = await fetch(
      `${API_BASE}/${endpoint}/${item.id}`,
      {
        method: "PUT",
        // FIX: Added 'Content-Type' so the backend reads the body
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: item.text,  // for reminder
          title: item.text,    // for events
          is_done: newDoneState
        })
      }
    );

    if (!res.ok) {
      alert("Failed to update");
      return;
    }

    // Update frontend after backend success
    item.done = newDoneState;
    viewCategory(type);

  } catch (err) {
    console.error("Toggle error:", err);
  }
}
// ================= CLOSE MODAL =================
const closeModalBtn = document.getElementById("closeModalBtn");
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    document.getElementById("modalOverlay").style.display = "none";
  });
}

// ================= REMINDERS =================
setInterval(checkReminders, 1000);

function checkReminders() {
  const now = Date.now();
  data.reminder.forEach(reminder => {
    if (reminder.triggered) return;
    if (reminder.triggerAt < now - 60000) return;
    if (now >= reminder.triggerAt) {
      reminder.triggered = true;
      showReminderPopup(reminder);
    }
  });
}

function showReminderPopup(reminder) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("⏰ Reminder", {
      body: reminder.text,
      requireInteraction: true,
      silent: false
    });
  }
  if (document.visibilityState === "visible") {
    showInAppPopup(reminder.text);
  }
}

function showInAppPopup(text) {
  const popup = document.getElementById("reminderPopup");
  const popupText = document.getElementById("popupText");
  const closeBtn = document.getElementById("closePopup");

  if (popup && popupText) {
    popupText.textContent = text;
    popup.style.display = "block";
    if (closeBtn) closeBtn.onclick = () => popup.style.display = "none";
    setTimeout(() => { popup.style.display = "none"; }, 30000);
  }
}

// ================= LOAD COUNTS =================
async function loadCounts() {
  const endpoints = { notes: "notes", reminder: "reminders", events: "events", schedule: "schedule" };
  for (const key in endpoints) {
    try {
      const res = await fetch(`${API_BASE}/${endpoints[key]}`, { headers: authHeaders() });
      if (!res.ok) continue;
      const result = await res.json();
      if (key === "notes") data.notes = result.notes || [];
if (key === "reminder") {
  data.reminder = result.reminders.map(r => {
    const d = parseBackendDateTime(r.remind_at);
    return {
      id: r.id,
      type: "reminder",
      text: r.content,
      date: d.toDateString(),
      time: d.toLocaleTimeString("en-IN", {
        timeZone: IST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      triggerAt: d.getTime(),
      triggered: false,
      done: Boolean(r.is_done)
    };
  });
}

if (key === "events") {
  data.events = result.events.map(e => {
    const d = parseBackendDateTime(e.start_time);
    return {
      id: e.id,
      type: "events",
      text: e.title,
      date: d.toDateString(),
      time: d.toLocaleTimeString("en-IN", {
        timeZone: IST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      done: Boolean(e.is_done)
    };
  });
}
      if (key === "schedule") data.schedule = result.schedule || [];
      const countEl = document.getElementById(`${key}Count`);
      if (countEl) countEl.textContent = data[key].length;
    } catch (err) {
      console.error("Failed loading", key, err);
    }
  }
}
loadCounts();

// ================= LOAD PROFILE =================
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    if (!res.ok) {
      console.warn("Profile fetch failed:", res.status);
      return;
    }

    const profileData = await res.json();
    const usernameEl = document.getElementById("profileUsername");
    const emailEl = document.getElementById("displayEmail");

    if (usernameEl) usernameEl.textContent = profileData.user.username || "";
    if (emailEl) emailEl.textContent = profileData.user.email || "";
  } catch (err) {
    console.error("Profile load error:", err);
  }
}
loadProfile();

// ================= VERSION / UPGRADE =================
const versionBtn = document.getElementById("versionBtn");
const versionPopup = document.getElementById("versionPopup");
const upgradeOverlay = document.getElementById("upgradeOverlay");
const closeUpgrade = document.getElementById("closeUpgrade");

if (versionBtn) {
  versionBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    versionPopup.classList.toggle("show");
  });
}

document.querySelectorAll(".upgrade-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (upgradeOverlay) upgradeOverlay.classList.add("show");
    if (versionPopup) versionPopup.classList.remove("show");
  });
});

if (closeUpgrade) {
  closeUpgrade.addEventListener("click", () => {
    if (upgradeOverlay) upgradeOverlay.classList.remove("show");
    resetCouponUI();
  });
}

if (upgradeOverlay) {
  upgradeOverlay.addEventListener("click", (e) => {
    if (e.target === upgradeOverlay) {
      upgradeOverlay.classList.remove("show");
      resetCouponUI();
    }
  });
}

document.querySelectorAll(".pay-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    alert(`Redirecting to payment for ${btn.dataset.plan.toUpperCase()} plan`);
  });
});

// ================= COUPON LOGIC =================
const showCouponBtn = document.getElementById("showCouponInputBtn");
const couponContainer = document.getElementById("couponContainer");
const couponInput = document.getElementById("couponInput");
const applyCouponBtn = document.getElementById("applyCouponBtn");
const couponMessage = document.getElementById("couponMessage");

const silverOption = document.getElementById("silverOption");
const goldOption = document.getElementById("goldOption");
const platinumOption = document.getElementById("platinumOption");

if (showCouponBtn && couponContainer) {
  showCouponBtn.addEventListener("click", (e) => {
    e.preventDefault();
    couponContainer.classList.toggle("show");
    if (couponContainer.classList.contains("show")) {
      showCouponBtn.style.display = "none";
    }
  });
}

if (applyCouponBtn && couponInput) {
  applyCouponBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const code = couponInput.value.trim().toLowerCase();
    if (code === "pro100") activateTheme("gold");
    else if (code === "proplus100") activateTheme("platinum");
    else showError("Invalid coupon code");
  });
}

const silverBtn = document.getElementById("silverBtn");
if (silverBtn) {
  silverBtn.addEventListener("click", () => {
    activateTheme("silver");
    if (upgradeOverlay) upgradeOverlay.classList.remove("show");
  });
}

if (silverOption) {
  silverOption.addEventListener("click", () => {
    activateTheme("silver");
    if (versionPopup) versionPopup.classList.remove("show");
  });
}
if (goldOption) {
  goldOption.addEventListener("click", () => {
    if (!goldOption.classList.contains("active")) {
      if (upgradeOverlay) upgradeOverlay.classList.add("show");
      if (versionPopup) versionPopup.classList.remove("show");
    }
  });
}
if (platinumOption) {
  platinumOption.addEventListener("click", () => {
    if (!platinumOption.classList.contains("active")) {
      if (upgradeOverlay) upgradeOverlay.classList.add("show");
      if (versionPopup) versionPopup.classList.remove("show");
    }
  });
}

// ================= THEME =================
function activateTheme(plan) {
  const root = document.documentElement;
  let themeColor, themeShadow, themeName, activeCardId;

  if (plan === "gold") {
    themeColor = '#FFD700';
    themeShadow = 'rgba(255, 215, 0, 0.45)';
    themeName = "Gold";
    activeCardId = "goldCard";
    useGoogleAPI = true;
  } else if (plan === "platinum") {
    themeColor = '#00FFFF';
    themeShadow = 'rgba(0, 255, 255, 0.45)';
    themeName = "Platinum";
    activeCardId = "platinumCard";
    useGoogleAPI = true;
  } else {
    themeColor = '#2563eb';
    themeShadow = 'rgba(37, 99, 235, 0.35)';
    themeName = "Silver";
    activeCardId = "silverCard";
    useGoogleAPI = false;
  }

  root.style.setProperty('--theme-color', themeColor);
  root.style.setProperty('--theme-shadow', themeShadow);

  if (versionBtn) {
    versionBtn.innerHTML = `${themeName} <span class="caret">▾</span>`;
  }

  updateDropdownUI(plan);

  document.querySelectorAll('.plan-card').forEach(c => {
    c.className = 'plan-card';
    const btn = c.querySelector('button');
    const titleEl = c.querySelector('h3');
    if (btn && titleEl && !btn.classList.contains('pay-btn')) {
      btn.textContent = titleEl.innerText === "Silver" ? "Current Plan" : `Switch to ${titleEl.innerText}`;
    }
  });

  const activeCard = document.getElementById(activeCardId);
  if (activeCard) {
    activeCard.classList.add(`active-${plan}`);
    const btn = activeCard.querySelector('button');
    if (btn) btn.textContent = "Current Plan";
  }

  if (plan !== "silver") {
    closeModalAndNotify(`${themeName} Plan Unlocked!`);
  } else {
    console.log("Silver plan active");
  }
}

function updateDropdownUI(activePlan) {
  ['silver', 'gold', 'platinum'].forEach(plan => {
    const optionRow = document.getElementById(`${plan}Option`);
    const iconContainer = document.getElementById(`${plan}Icon`);

    if (optionRow && iconContainer) {
      if (plan === activePlan) {
        optionRow.classList.add('active');
        iconContainer.innerHTML = '<span class="check">✓</span>';
      } else {
        optionRow.classList.remove('active');
        if (plan === 'silver') iconContainer.innerHTML = '';
        else iconContainer.innerHTML = '<button class="upgrade-btn">Upgrade</button>';
      }
    }
  });
}

function showError(msg) {
  if (couponMessage) {
    couponMessage.textContent = msg;
    couponMessage.className = "coupon-msg error";
  }
}

function resetCouponUI() {
  if (couponContainer) couponContainer.classList.remove("show");
  if (showCouponBtn) showCouponBtn.style.display = "block";
  if (couponInput) couponInput.value = "";
  if (couponMessage) {
    couponMessage.textContent = "";
    couponMessage.className = "coupon-msg";
  }
}

function closeModalAndNotify(msg) {
  if (couponMessage) {
    couponMessage.textContent = msg;
    couponMessage.className = "coupon-msg success";
  }

  setTimeout(() => {
    if (upgradeOverlay) {
      upgradeOverlay.classList.remove("show");
      upgradeOverlay.style.display = "none";
      setTimeout(() => { upgradeOverlay.style.display = ""; }, 500);
    }
    resetCouponUI();
    alert(msg);

    if (micButton) {
      micButton.classList.add("active");
      setTimeout(() => micButton.classList.remove("active"), 1000);
    }
  }, 500);
}

function initMainClock() {
  if (!clockTimeEl || !clockDateEl || !clockDayEl) return;

  const updateClock = () => {
    const now = new Date();

    clockTimeEl.textContent = now.toLocaleTimeString("en-IN", {
      timeZone: IST_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    clockDateEl.textContent = now.toLocaleDateString("en-IN", {
      timeZone: IST_TIME_ZONE,
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    clockDayEl.textContent = now.toLocaleDateString("en-IN", {
      timeZone: IST_TIME_ZONE,
      weekday: "long"
    });
  };

  updateClock();
  setInterval(updateClock, 1000);
}

// ================= MORE DROPDOWN =================
const moreBtn = document.getElementById("moreBtn");
const moreDropdown = document.getElementById("moreDropdown");

if (moreBtn) {
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moreDropdown.classList.toggle("show");
  });
}

// ================= HELP WIDGET =================
const openHelp = document.getElementById("openHelp");
const closeHelp = document.getElementById("closeHelp");
const helpWidget = document.getElementById("helpWidget");
const helpBody = document.getElementById("helpBody");

if (openHelp) {
  openHelp.addEventListener("click", () => {
    helpWidget.classList.toggle("show");
  });
}

if (closeHelp) {
  closeHelp.addEventListener("click", () => {
    helpWidget.classList.remove("show");
  });
}

document.querySelectorAll(".help-options button").forEach(btn => {
  btn.addEventListener("click", () => {
    const question = btn.textContent;
    const answer =btn.dataset.answer;
    if (helpBody) {
      helpBody.innerHTML += `
        <div class="user-msg">${question}</div>
        <div class="bot-msg">${answer}</div>
      `;
      helpBody.scrollTop = helpBody.scrollHeight;
    }
  });
});

// ================= NOTES EDITABLE VIEW =================
function viewNotesEditable() {
  const modalItems = document.getElementById("modalItems");
  const modalTitle = document.getElementById("modalTitle");
  const modalOverlay = document.getElementById("modalOverlay");

  if (modalTitle) modalTitle.textContent = "NOTES";
  if (!modalItems) return;
  modalItems.innerHTML = "";

  if (data.notes.length === 0) {
    modalItems.innerHTML = "<p style='color:#666'>No notes yet</p>";
  }

  data.notes.forEach(note => {
    const row = document.createElement("div");
    row.className = "item-row";

    const template = document.getElementById("noteTemplate");
const clone = template.content.cloneNode(true);

const textarea = clone.querySelector(".edit-note");
const saveBtn = clone.querySelector(".note-save-btn");
const deleteBtn = clone.querySelector(".note-delete-btn");

textarea.value = note.text;
textarea.dataset.id = note.id;

saveBtn.addEventListener("click", () => updateNote(note.id));
deleteBtn.addEventListener("click", () => deleteNote(note.id));

modalItems.appendChild(clone);
});

  if (modalOverlay) modalOverlay.style.display = "flex";
}

async function updateNote(id) {
  const textarea = document.querySelector(`textarea[data-id="${id}"]`);
  if (!textarea) return;
  const content = textarea.value.trim();

  if (!content) {
    alert("Note cannot be empty");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ content })
    });

    if (!res.ok) {
      alert("Failed to save note");
      return;
    }

    textarea.style.borderColor = "#22c55e";
    setTimeout(() => textarea.style.borderColor = "#222", 800);
  } catch (err) {
    console.error("updateNote error:", err);
  }
}

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;

  try {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    data.notes = data.notes.filter(n => n.id !== id);
    viewNotesEditable();
  } catch (err) {
    console.error("deleteNote error:", err);
  }
}


// SIDEBAR TOGGLE
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");

if (menuToggle) {
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("active");
  });
}

// Close sidebar if clicking outside
document.addEventListener("click", (e) => {
  if (!sidebar.contains(e.target) && e.target !== menuToggle) {
    sidebar.classList.remove("active");
  }
});
document.addEventListener("click", function (e) {

    if (e.target.closest(".sidebar-menu li")) {
        alert("You need a Platinum subscription to access this feature.");
    }

});

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  activateTheme("silver");
  initMainClock();
});

