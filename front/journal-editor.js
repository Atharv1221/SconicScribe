const API_BASE = window.APP_CONFIG?.API_BASE_URL || "http://localhost:3000";
const params = new URLSearchParams(window.location.search);
const templateType = params.get("template") || "notes";
const entryIdParam = params.get("id");
const initialEntryId = entryIdParam ? Number(entryIdParam) : null;

const title = document.getElementById("templateTitle");
const notesView = document.getElementById("notesView");
const mainView = document.getElementById("mainView");
const detailView = document.getElementById("detailView");

const TEMPLATE_TITLES = {
  weekly: "To-Do List",
  goals: "Goals",
  notes: "Notes"
};

title.textContent = TEMPLATE_TITLES[templateType] || "Journal";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();
  if (!token) {
    alert("Please login first.");
    window.location.href = "login.html";
    return null;
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function apiFetch(path, options = {}) {
  const headers = authHeaders();
  if (!headers) return null;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

if (templateType === "notes") {
  notesView.style.display = "block";
  setupNotes();
}

if (templateType === "weekly" || templateType === "goals") {
  mainView.style.display = "block";
  setupListSystem();
}

function setupNotes() {
  const topicInput = document.getElementById("notesTopicInput");
  const textarea = document.getElementById("notesContent");
  const saveBtn = document.getElementById("saveNotesBtn");
  const savedNotes = document.getElementById("savedNotes");
  const notesMicBtn = document.getElementById("notesMicBtn");
  const notesVoiceStatus = document.getElementById("notesVoiceStatus");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  let notes = [];
  let currentId = null;

  function setVoiceStatus(message) {
    if (notesVoiceStatus) notesVoiceStatus.textContent = message;
  }

  function insertAtCursor(text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const current = textarea.value;
    const prefix = current.slice(0, start);
    const suffix = current.slice(end);
    const spacer = prefix && !prefix.endsWith(" ") && !text.startsWith(" ") ? " " : "";

    textarea.value = `${prefix}${spacer}${text}${suffix}`;
    const nextPos = prefix.length + spacer.length + text.length;
    textarea.setSelectionRange(nextPos, nextPos);
    textarea.focus();
  }

  function resetForm() {
    topicInput.value = "";
    textarea.value = "";
    currentId = null;
    savedNotes.style.display = "block";
  }

  function openNote(id) {
    const note = notes.find(entry => entry.id === id);
    if (!note) return;

    currentId = id;
    topicInput.value = note.topic;
    textarea.value = note.content || "";
    savedNotes.style.display = "none";
  }

  function renderNotes() {
    savedNotes.innerHTML = "";

    notes.forEach(note => {
      const card = document.createElement("div");
      card.className = "container-card";
      card.innerHTML = `<h3>${escapeHtml(note.topic)}</h3>`;
      card.onclick = () => openNote(note.id);
      savedNotes.appendChild(card);
    });
  }

  async function loadNotes() {
    try {
      const result = await apiFetch(`/journal-entries?template=${templateType}`);
      if (!result) return;
      notes = result.entries || [];
      renderNotes();

      if (Number.isInteger(initialEntryId)) {
        openNote(initialEntryId);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
      alert(err.message);
    }
  }

  if (!SpeechRecognition) {
    if (notesMicBtn) notesMicBtn.disabled = true;
    setVoiceStatus("Voice typing not supported in this browser");
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      notesMicBtn.classList.add("listening");
      notesMicBtn.textContent = "Stop Voice Typing";
      setVoiceStatus("Listening...");
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) insertAtCursor(finalTranscript.trim());
    };

    recognition.onerror = () => {
      setVoiceStatus("Mic error or permission denied");
    };

    recognition.onend = () => {
      isListening = false;
      notesMicBtn.classList.remove("listening");
      notesMicBtn.textContent = "Start Voice Typing";
      setVoiceStatus("Press mic to dictate");
    };

    notesMicBtn.addEventListener("click", () => {
      if (!recognition) return;
      if (isListening) recognition.stop();
      else recognition.start();
    });
  }

  saveBtn.onclick = async () => {
    const topic = topicInput.value.trim();
    const content = textarea.value.trim();

    if (!topic || !content) return;

    const payload = {
      templateType,
      topic,
      content
    };

    try {
      const result = currentId
        ? await apiFetch(`/journal-entries/${currentId}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          })
        : await apiFetch("/journal-entries", {
            method: "POST",
            body: JSON.stringify(payload)
          });

      if (!result) return;

      const savedEntry = result.entry;
      const existingIndex = notes.findIndex(note => note.id === savedEntry.id);

      if (existingIndex >= 0) {
        notes[existingIndex] = savedEntry;
      } else {
        notes.unshift(savedEntry);
      }

      resetForm();
      renderNotes();
    } catch (err) {
      console.error("Failed to save note:", err);
      alert(err.message);
    }
  };

  loadNotes();
}

function setupListSystem() {
  const topicInput = document.getElementById("topicInput");
  const itemInput = document.getElementById("itemInput");
  const addBtn = document.getElementById("addItemBtn");
  const saveBtn = document.getElementById("saveContainerBtn");
  const tempList = document.getElementById("tempItemList");
  const savedContainers = document.getElementById("savedContainers");

  const detailTitle = document.getElementById("detailTitle");
  const detailList = document.getElementById("detailItemList");
  const detailInput = document.getElementById("detailNewItemInput");
  const detailAddBtn = document.getElementById("detailAddItemBtn");
  const deleteContainerBtn = document.getElementById("deleteContainerBtn");
  const backBtn = document.getElementById("backBtn");

  let currentItems = [];
  let containers = [];
  let currentContainerId = null;

  function renderTaskList(target, items, onDelete, onToggle) {
    target.innerHTML = "";

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "task-item";

      if (templateType === "weekly") {
        li.innerHTML = `
          <div class="task-left">
            <input type="checkbox" ${item.completed ? "checked" : ""}>
            <span>${escapeHtml(item.text)}</span>
          </div>
          <button type="button">Delete</button>
        `;

        li.classList.toggle("completed", Boolean(item.completed));
        li.querySelector("input").onchange = (event) => {
          onToggle(index, event.target.checked);
        };
      } else {
        li.innerHTML = `
          <div class="task-left">
            <span>${escapeHtml(item.text)}</span>
          </div>
          <button type="button">Delete</button>
        `;
      }

      li.querySelector("button").onclick = () => onDelete(index);
      target.appendChild(li);
    });
  }

  function renderTemp() {
    renderTaskList(
      tempList,
      currentItems,
      (index) => {
        currentItems.splice(index, 1);
        renderTemp();
      },
      (index, checked) => {
        currentItems[index].completed = checked;
        renderTemp();
      }
    );
  }

  function renderCards() {
    savedContainers.innerHTML = "";

    containers.forEach(container => {
      const div = document.createElement("div");
      div.className = "container-card";
      div.innerHTML = `<h3>${escapeHtml(container.topic)}</h3>`;
      div.onclick = () => openDetail(container.id);
      savedContainers.appendChild(div);
    });
  }

  async function loadContainers() {
    try {
      const result = await apiFetch(`/journal-entries?template=${templateType}`);
      if (!result) return;
      containers = result.entries || [];
      renderCards();

      if (Number.isInteger(initialEntryId)) {
        openDetail(initialEntryId);
      }
    } catch (err) {
      console.error("Failed to load journal lists:", err);
      alert(err.message);
    }
  }

  async function persistContainer(container) {
    const payload = {
      templateType,
      topic: container.topic,
      items: container.items.map((item, index) => ({
        text: item.text,
        completed: Boolean(item.completed),
        sortOrder: index
      }))
    };

    const result = await apiFetch(`/journal-entries/${container.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (!result) return null;

    const updated = result.entry;
    const idx = containers.findIndex(entry => entry.id === updated.id);
    if (idx >= 0) containers[idx] = updated;
    return updated;
  }

  function addItem() {
    const text = itemInput.value.trim();
    if (!text) return;

    currentItems.push({
      text,
      completed: false
    });
    itemInput.value = "";
    renderTemp();
  }

  addBtn.onclick = addItem;
  itemInput.onkeypress = (event) => {
    if (event.key === "Enter") addItem();
  };

  saveBtn.onclick = async () => {
    const topic = topicInput.value.trim();
    if (!topic) return;

    try {
      const result = await apiFetch("/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          templateType,
          topic,
          items: currentItems.map((item, index) => ({
            text: item.text,
            completed: Boolean(item.completed),
            sortOrder: index
          }))
        })
      });

      if (!result) return;

      containers.unshift(result.entry);
      topicInput.value = "";
      currentItems = [];
      renderTemp();
      renderCards();
    } catch (err) {
      console.error("Failed to save journal list:", err);
      alert(err.message);
    }
  };

  async function openDetail(id) {
    currentContainerId = id;

    try {
      const result = await apiFetch(`/journal-entries/${id}`);
      if (!result) return;

      const container = result.entry;
      const idx = containers.findIndex(entry => entry.id === container.id);
      if (idx >= 0) containers[idx] = container;

      detailTitle.textContent = container.topic;

      const renderDetail = () => {
        renderTaskList(
          detailList,
          container.items || [],
          async (index) => {
            container.items.splice(index, 1);
            const updated = await persistContainer(container);
            if (!updated) return;
            container.items = updated.items || [];
            renderDetail();
          },
          async (index, checked) => {
            container.items[index].completed = checked;
            const updated = await persistContainer(container);
            if (!updated) return;
            container.items = updated.items || [];
            renderDetail();
          }
        );
      };

      renderDetail();

      detailAddBtn.onclick = async () => {
        const text = detailInput.value.trim();
        if (!text) return;

        container.items.push({
          text,
          completed: false
        });
        detailInput.value = "";

        const updated = await persistContainer(container);
        if (!updated) return;
        container.items = updated.items || [];
        renderDetail();
      };

      detailInput.onkeypress = (event) => {
        if (event.key === "Enter") detailAddBtn.click();
      };

      mainView.style.display = "none";
      detailView.style.display = "block";
    } catch (err) {
      console.error("Failed to open journal list:", err);
      alert(err.message);
    }
  }

  backBtn.onclick = () => {
    detailView.style.display = "none";
    mainView.style.display = "block";
  };

  deleteContainerBtn.onclick = async () => {
    if (!currentContainerId) return;

    try {
      const result = await apiFetch(`/journal-entries/${currentContainerId}`, {
        method: "DELETE"
      });

      if (!result) return;

      containers = containers.filter(container => container.id !== currentContainerId);
      currentContainerId = null;
      detailView.style.display = "none";
      mainView.style.display = "block";
      renderCards();
    } catch (err) {
      console.error("Failed to delete journal list:", err);
      alert(err.message);
    }
  };

  loadContainers();
}

function goBack() {
  window.location.href = "journal.html";
}
