import express from "express";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import authMiddleware from "./middleware/auth.js";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});




const PORT = Number(process.env.PORT || 3000);
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "1234";
const DB_NAME = process.env.DB_NAME || "voice_app";
const DB_SSL = process.env.DB_SSL === "true";
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
const DB_SSL_CA = process.env.DB_SSL_CA || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "google_session_secret";
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5500";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || [
  FRONTEND_URL,
  "http://127.0.0.1:5500",
  "http://localhost:5501"
].join(","))
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const app = express();

const dbConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  timezone: "+05:30"
};

if (DB_SSL) {
  dbConfig.ssl = {
    rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED
  };

  if (DB_SSL_CA) {
    dbConfig.ssl.ca = DB_SSL_CA.replace(/\\n/g, "\n");
  }
}


// ================= BASIC MIDDLEWARE =================
app.set("trust proxy", 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());

// ================= SESSION (REQUIRED FOR GOOGLE) =================
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ================= MYSQL =================
const db = mysql.createConnection({
  ...dbConfig
});

db.connect(err => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
    return;
  }
  console.log("✅ MySQL connected");
});

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(results);
    });
  });
}

const JOURNAL_TEMPLATES = new Set(["notes", "weekly", "goals"]);

function normalizeJournalItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          text: item.trim(),
          completed: false,
          sortOrder: index
        };
      }

      if (!item || typeof item !== "object") return null;

      return {
        text: String(item.text || "").trim(),
        completed: Boolean(item.completed),
        sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index
      };
    })
    .filter(item => item && item.text);
}

async function fetchJournalEntry(userId, entryId) {
  const entries = await dbQuery(
    `SELECT id, user_id, template_type, topic, content, created_at, updated_at
     FROM journal_entries
     WHERE id = ? AND user_id = ?`,
    [entryId, userId]
  );

  if (entries.length === 0) return null;

  const entry = entries[0];
  const items = await dbQuery(
    `SELECT id, item_text, is_completed, sort_order, created_at, updated_at
     FROM journal_entry_items
     WHERE entry_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [entryId]
  );

  return {
    id: entry.id,
    templateType: entry.template_type,
    topic: entry.topic,
    content: entry.content,
    items: items.map(item => ({
      id: item.id,
      text: item.item_text,
      completed: Boolean(item.is_completed),
      sortOrder: item.sort_order,
      created_at: item.created_at,
      updated_at: item.updated_at
    })),
    created_at: entry.created_at,
    updated_at: entry.updated_at
  };
}

// ================= PASSPORT GOOGLE =================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/auth/google/callback`
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ================= TEST =================
app.get("/", (req, res) => {
  res.json({ message: "Backend running" });
});

// ================= EMAIL AUTH =================
// ================= EMAIL AUTH =================
// ================= EMAIL AUTH =================

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const validGenders = new Set(["Male", "Female", "Other"]);


// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
  const { username, email, password, age, gender, phone } = req.body;

  // Required fields
  if (!username || !email || !password || age === undefined || !gender || !phone) {
    return res.status(400).json({
      message: "Username, email, password, age, gender and phone are required"
    });
  }

  // Strict Gmail validation
  if (!gmailRegex.test(email)) {
    return res.status(400).json({
      message: "Only valid @gmail.com emails are allowed"
    });
  }

  const numericAge = Number(age);
  if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
    return res.status(400).json({
      message: "Age must be a whole number between 1 and 120"
    });
  }

  if (!validGenders.has(gender)) {
    return res.status(400).json({
      message: "Gender must be Male, Female, or Other"
    });
  }

  const normalizedPhone = String(phone).replace(/\D/g, "");
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return res.status(400).json({
      message: "Phone number must be exactly 10 digits"
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (username, email, password, age, gender, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        username,
        email,
        hashed,
        numericAge,
        gender,
        normalizedPhone
      ],
      (err) => {

        if (err) {

          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
              message: "Email or username already exists"
            });
          }

          console.error("Register DB error:", err);
          return res.status(500).json({
            message: "Database error"
          });
        }

        res.status(201).json({
          message: "Registered successfully"
        });
      }
    );

  } catch (err) {
    console.error("Register crash:", err);
    res.status(500).json({
      message: "Server error"
    });
  }
});


// ---------------- LOGIN ----------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  // Strict Gmail validation
  if (!gmailRegex.test(email)) {
    return res.status(400).json({
      message: "Only valid @gmail.com emails are allowed"
    });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, rows) => {

      if (err) {
        console.error("Login DB error:", err);
        return res.status(500).json({
          message: "Database error"
        });
      }

      if (rows.length === 0) {
        return res.status(401).json({
          message: "Invalid credentials"
        });
      }

      const user = rows[0];

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid credentials"
        });
      }

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token });
    }
  );
});
// ================= GOOGLE AUTH =================
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    try {
      console.log("GOOGLE PROFILE:", req.user);

      if (
        !req.user ||
        !req.user.emails ||
        !req.user.emails.length
      ) {
        console.error("❌ Google profile has no email");
        return res.status(500).send("Google account has no email");
      }

      const email = req.user.emails[0].value;
      const name = req.user.displayName || "Google User";

      db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, rows) => {
          if (err) {
            console.error("DB SELECT ERROR:", err);
            return res.status(500).send("Database error");
          }

          if (rows.length > 0) {
            issueToken(rows[0].id);
          } else {
            db.query(
              "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
              [name, email, "GOOGLE_AUTH"],
              (err, result) => {
                if (err) {
                  console.error("DB INSERT ERROR:", err);
                  return res.status(500).send("Database insert failed");
                }
                issueToken(result.insertId);
              }
            );
          }
        }
      );

      function issueToken(userId) {
        const token = jwt.sign(
          { userId },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.redirect(
          `${FRONTEND_URL}/index.html?token=${token}`
        );
      }
    } catch (err) {
      console.error("🔥 GOOGLE CALLBACK CRASH:", err);
      res.status(500).send("Google auth failed");
    }
  }
);


// ================= PROTECTED =================
app.get("/me", authMiddleware, (req, res) => {
  res.json({ userId: req.user.userId });
});

app.get("/profile", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  db.query("SELECT username, email FROM users WHERE id = ?", [userId], (err, rows) => {
    if (err) {
      console.error("Profile fetch error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ user: rows[0] });
  });
});

// ================= JOURNAL EDITOR =================

app.get("/journal-entries", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { template } = req.query;

  if (template && !JOURNAL_TEMPLATES.has(template)) {
    return res.status(400).json({ message: "Invalid journal template" });
  }

  try {
    const params = [userId];
    let sql = `
      SELECT id, template_type, topic, content, created_at, updated_at
      FROM journal_entries
      WHERE user_id = ?
    `;

    if (template) {
      sql += " AND template_type = ?";
      params.push(template);
    }

    sql += " ORDER BY updated_at DESC, id DESC";

    const entries = await dbQuery(sql, params);
    res.json({
      entries: entries.map(entry => ({
        id: entry.id,
        templateType: entry.template_type,
        topic: entry.topic,
        content: entry.content,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      }))
    });
  } catch (err) {
    console.error("Fetch journal entries error:", err);
    res.status(500).json({ message: "Failed to fetch journal entries" });
  }
});

app.get("/journal-entries/:id", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const entryId = Number(req.params.id);

  if (!Number.isInteger(entryId)) {
    return res.status(400).json({ message: "Invalid journal entry id" });
  }

  try {
    const entry = await fetchJournalEntry(userId, entryId);
    if (!entry) {
      return res.status(404).json({ message: "Journal entry not found" });
    }

    res.json({ entry });
  } catch (err) {
    console.error("Fetch journal entry error:", err);
    res.status(500).json({ message: "Failed to fetch journal entry" });
  }
});

app.post("/journal-entries", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { templateType, topic, content } = req.body;
  const items = normalizeJournalItems(req.body.items);

  if (!JOURNAL_TEMPLATES.has(templateType)) {
    return res.status(400).json({ message: "Invalid journal template" });
  }

  const safeTopic = String(topic || "").trim();
  const safeContent = String(content || "").trim();

  if (!safeTopic) {
    return res.status(400).json({ message: "Topic is required" });
  }

  if (templateType === "notes" && !safeContent) {
    return res.status(400).json({ message: "Content is required for notes" });
  }

  try {
    const result = await dbQuery(
      `INSERT INTO journal_entries (user_id, template_type, topic, content)
       VALUES (?, ?, ?, ?)`,
      [userId, templateType, safeTopic, templateType === "notes" ? safeContent : null]
    );

    if (templateType !== "notes" && items.length > 0) {
      const values = items.map(item => [
        result.insertId,
        item.text,
        item.completed ? 1 : 0,
        item.sortOrder
      ]);

      await dbQuery(
        "INSERT INTO journal_entry_items (entry_id, item_text, is_completed, sort_order) VALUES ?",
        [values]
      );
    }

    const entry = await fetchJournalEntry(userId, result.insertId);
    res.status(201).json({ message: "Journal entry created", entry });
  } catch (err) {
    console.error("Create journal entry error:", err);
    res.status(500).json({ message: "Failed to create journal entry" });
  }
});

app.put("/journal-entries/:id", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const entryId = Number(req.params.id);
  const { templateType, topic, content } = req.body;
  const items = normalizeJournalItems(req.body.items);

  if (!Number.isInteger(entryId)) {
    return res.status(400).json({ message: "Invalid journal entry id" });
  }

  if (!JOURNAL_TEMPLATES.has(templateType)) {
    return res.status(400).json({ message: "Invalid journal template" });
  }

  const safeTopic = String(topic || "").trim();
  const safeContent = String(content || "").trim();

  if (!safeTopic) {
    return res.status(400).json({ message: "Topic is required" });
  }

  if (templateType === "notes" && !safeContent) {
    return res.status(400).json({ message: "Content is required for notes" });
  }

  try {
    const existing = await fetchJournalEntry(userId, entryId);
    if (!existing) {
      return res.status(404).json({ message: "Journal entry not found" });
    }

    await dbQuery(
      `UPDATE journal_entries
       SET template_type = ?, topic = ?, content = ?
       WHERE id = ? AND user_id = ?`,
      [templateType, safeTopic, templateType === "notes" ? safeContent : null, entryId, userId]
    );

    await dbQuery("DELETE FROM journal_entry_items WHERE entry_id = ?", [entryId]);

    if (templateType !== "notes" && items.length > 0) {
      const values = items.map(item => [
        entryId,
        item.text,
        item.completed ? 1 : 0,
        item.sortOrder
      ]);

      await dbQuery(
        "INSERT INTO journal_entry_items (entry_id, item_text, is_completed, sort_order) VALUES ?",
        [values]
      );
    }

    const entry = await fetchJournalEntry(userId, entryId);
    res.json({ message: "Journal entry updated", entry });
  } catch (err) {
    console.error("Update journal entry error:", err);
    res.status(500).json({ message: "Failed to update journal entry" });
  }
});

app.delete("/journal-entries/:id", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const entryId = Number(req.params.id);

  if (!Number.isInteger(entryId)) {
    return res.status(400).json({ message: "Invalid journal entry id" });
  }

  try {
    const result = await dbQuery(
      "DELETE FROM journal_entries WHERE id = ? AND user_id = ?",
      [entryId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Journal entry not found" });
    }

    res.json({ message: "Journal entry deleted" });
  } catch (err) {
    console.error("Delete journal entry error:", err);
    res.status(500).json({ message: "Failed to delete journal entry" });
  }
});



// ================= NOTES =================

app.post("/notes", authMiddleware, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content) {
    return res.status(400).json({ message: "Note content required" });
  }

  const sql = "INSERT INTO notes (user_id, content) VALUES (?, ?)";

  db.query(sql, [userId, content], (err, result) => {
    if (err) {
      console.error("Note insert error:", err);
      return res.status(500).json({ message: "Failed to save note" });
    }

    res.status(201).json({
      message: "Note saved",
      noteId: result.insertId
    });
  });
});

app.get("/notes", authMiddleware, (req, res) => {
  const userId = req.user.userId;

  const sql =
    "SELECT id, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC";

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Fetch notes error:", err);
      return res.status(500).json({ message: "Failed to fetch notes" });
    }

    res.status(200).json({ notes: results });
  });
});

app.put("/notes/:id", authMiddleware, (req, res) => {
  const { content } = req.body;
  const noteId = req.params.id;
  const userId = req.user.userId;

  db.query(
    "UPDATE notes SET content = ? WHERE id = ? AND user_id = ?",
    [content, noteId, userId],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to update note" });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Note not found" });
      res.json({ message: "Note updated" });
    }
  );
});

app.delete("/notes/:id", authMiddleware, (req, res) => {
  const noteId = req.params.id;
  const userId = req.user.userId;

  db.query(
    "DELETE FROM notes WHERE id = ? AND user_id = ?",
    [noteId, userId],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to delete note" });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Note not found" });
      res.json({ message: "Note deleted" });
    }
  );
});

// ================= REMINDERS =================

// CREATE REMINDER
app.post("/reminders", authMiddleware, (req, res) => {
  const { content, remindAt } = req.body;
  const userId = req.user.userId;

  if (!content || !remindAt) {
    return res.status(400).json({
      message: "content and remindAt are required"
    });
  }

  const sql = `
    INSERT INTO reminders (user_id, content, remind_at, is_done)
    VALUES (?, ?, ?, 0)
  `;

  db.query(sql, [userId, content, remindAt], (err, result) => {
    if (err) {
      console.error("Reminder insert error:", err);
      return res.status(500).json({ message: "Failed to create reminder" });
    }

    res.status(201).json({
      message: "Reminder created",
      reminderId: result.insertId
    });
  });
});


// GET ALL REMINDERS (INCLUDING is_done)
app.get("/reminders", authMiddleware, (req, res) => {
  const userId = req.user.userId;

  const sql = `
    SELECT id, content, remind_at, is_triggered, is_done, created_at
    FROM reminders
    WHERE user_id = ?
    ORDER BY remind_at ASC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Fetch reminders error:", err);
      return res.status(500).json({ message: "Failed to fetch reminders" });
    }

    res.status(200).json({ reminders: results });
  });
});


// UPDATE REMINDER (CONTENT + DONE STATE)
app.put("/reminders/:id", authMiddleware, (req, res) => {
  const { content, is_done } = req.body;
  const reminderId = req.params.id;
  const userId = req.user.userId;

  if (typeof is_done === "undefined") {
    return res.status(400).json({ message: "is_done is required" });
  }

  const sql = `
    UPDATE reminders
    SET content = ?, is_done = ?
    WHERE id = ? AND user_id = ?
  `;

  db.query(
    sql,
    [content, is_done ? 1 : 0, reminderId, userId],
    (err, result) => {
      if (err) {
        console.error("Reminder update error:", err);
        return res.status(500).json({ message: "Update failed" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      res.json({ message: "Reminder updated" });
    }
  );
});


// DELETE REMINDER
app.delete("/reminders/:id", authMiddleware, (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.userId;

  const sql = `
    DELETE FROM reminders
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [reminderId, userId], (err, result) => {
    if (err) {
      console.error("Reminder delete error:", err);
      return res.status(500).json({ message: "Delete failed" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    res.json({ message: "Reminder deleted" });
  });
});
// ================= EVENTS =================

// ➕ CREATE EVENT
app.post("/events", authMiddleware, (req, res) => {
  const { title, startTime, endTime } = req.body;
  const userId = req.user.userId;

  if (!title || !startTime) {
    return res.status(400).json({
      message: "title and startTime are required"
    });
  }

  const sql = `
    INSERT INTO events (user_id, title, start_time, end_time, is_done)
    VALUES (?, ?, ?, ?, 0)
  `;

  db.query(sql, [userId, title, startTime, endTime || null], (err, result) => {
    if (err) {
      console.error("Event insert error:", err);
      return res.status(500).json({ message: "Failed to create event" });
    }

    res.status(201).json({
      message: "Event created",
      eventId: result.insertId
    });
  });
});


// 📄 GET EVENTS (INCLUDING is_done)
app.get("/events", authMiddleware, (req, res) => {
  const userId = req.user.userId;

  const sql = `
    SELECT id, title, start_time, end_time, is_done, created_at
    FROM events
    WHERE user_id = ?
    ORDER BY start_time ASC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Fetch events error:", err);
      return res.status(500).json({ message: "Failed to fetch events" });
    }

    res.status(200).json({ events: results });
  });
});


// ✏️ UPDATE EVENT (TITLE + DONE)
app.put("/events/:id", authMiddleware, (req, res) => {
  const { title, is_done } = req.body;
  const eventId = req.params.id;
  const userId = req.user.userId;

  const sql = `
    UPDATE events
    SET title = ?, is_done = ?
    WHERE id = ? AND user_id = ?
  `;

  db.query(
    sql,
    [title, is_done ? 1 : 0, eventId, userId],
    (err, result) => {
      if (err) {
        console.error("Event update error:", err);
        return res.status(500).json({ message: "Update failed" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json({ message: "Event updated" });
    }
  );
});


// ❌ DELETE EVENT
app.delete("/events/:id", authMiddleware, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.userId;

  const sql = `
    DELETE FROM events
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [eventId, userId], (err, result) => {
    if (err) {
      console.error("Event delete error:", err);
      return res.status(500).json({ message: "Delete failed" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ message: "Event deleted" });
  });
});
// ================= SCHEDULE =================

app.get("/schedule", authMiddleware, (req, res) => {
  const userId = req.user.userId;

  const sql = `
    SELECT
      content,
      remind_at AS schedule_at
    FROM reminders
    WHERE user_id = ?

    UNION ALL

    SELECT
      title AS content,
      start_time AS schedule_at
    FROM events
    WHERE user_id = ?

    ORDER BY schedule_at ASC
  `;

  db.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error("Schedule fetch error:", err);
      return res.status(500).json({ message: "Failed to fetch schedule" });
    }

    res.status(200).json({ schedule: results });
  });
});

// // ================= WHISPER TRANSCRIPTION =================
// console.log("=== TRANSCRIBE HIT ===");
// console.log("File object:", req.file);

// app.post("/transcribe", authMiddleware, upload.single("audio"), async (req, res) => {

//   try {

//     if (!req.file) {
//       return res.status(400).json({
//         text: "",
//         error: "No audio file received"
//       });
//     }

//     const transcription = await openai.audio.transcriptions.create({
//       file: fs.createReadStream(req.file.path),
//       model: "gpt-4o-transcribe"
//     });

//     // delete temp file
//     fs.unlink(req.file.path, (err) => {
//       if (err) console.error("File delete error:", err);
//     });

//     res.json({
//       text: transcription.text
//     });

//   } catch (err) {

//     console.error("Whisper transcription error:", err);

//     res.status(500).json({
//       text: "",
//       error: "Transcription failed"
//     });

//   }

// });

// ================= START SERVER (ALWAYS LAST) =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
