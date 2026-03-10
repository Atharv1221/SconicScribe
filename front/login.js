// ================= AUTH STATE =================
let isSignUp = false;
const API_BASE = window.APP_CONFIG?.API_BASE_URL || "http://localhost:3000";

// ================= CLEAR INVALID TOKEN =================
// (prevents broken auto-redirect)
const existingToken = localStorage.getItem("token");
if (existingToken && existingToken !== "undefined") {
  window.location.href = "index.html";
}

// ================= DOM ELEMENTS =================
const form = document.getElementById("authForm");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");
const usernameGroup = document.getElementById("usernameGroup");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const toggleText = document.getElementById("toggleText");
const ageGroup = document.getElementById("ageGroup");
const genderGroup = document.getElementById("genderGroup");
const phoneGroup = document.getElementById("phoneGroup");
const ageInput = document.getElementById("age");
const genderInput = document.getElementById("gender");
const phoneInput = document.getElementById("phone");
const emailError = document.getElementById("emailError");

function toggleAuthMode() {
  isSignUp = !isSignUp;
  form.reset();

  if (isSignUp) {
    title.textContent = "Create Account";
    subtitle.textContent = "Sign up to get started";

    usernameGroup.style.display = "block";
    ageGroup.style.display = "block";
    genderGroup.style.display = "block";
    phoneGroup.style.display = "block";

    usernameInput.required = true;
    ageInput.required = true;
    genderInput.required = true;
    phoneInput.required = true;

    submitBtn.textContent = "Sign Up";

    toggleText.innerHTML =
      'Already have an account? <button type="button" id="toggleBtn">Sign In</button>';

  } else {
    title.textContent = "Welcome Back";
    subtitle.textContent = "Sign in to continue";

    usernameGroup.style.display = "none";
    ageGroup.style.display = "none";
    genderGroup.style.display = "none";
    phoneGroup.style.display = "none";

    usernameInput.required = false;
    ageInput.required = false;
    genderInput.required = false;
    phoneInput.required = false;

    submitBtn.textContent = "Sign In";

    toggleText.innerHTML =
      'Don\'t have an account? <button type="button" id="toggleBtn">Sign Up</button>';
  }

  document.getElementById("toggleBtn").addEventListener("click", toggleAuthMode);
}
// ================= FORM SUBMIT =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const username = usernameInput.value.trim();
  const age = ageInput.value.trim();
  const gender = genderInput.value.trim();
  const phone = phoneInput.value.trim();
  const cleanPhone = phone.replace(/\D/g, "");

// Clear old errors
if (emailError) {
  emailError.textContent = "";
}
emailInput.classList.remove("input-error");

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

if (!gmailRegex.test(email)) {
  if (emailError) {
    emailError.textContent = "Only valid @gmail.com emails are allowed";
  }
  emailInput.classList.add("input-error");
  return;
}
  if (!email || !password) {
    alert("Email and password are required");
    return;
  }

  if (isSignUp) {
    if (!username || !age || !gender || !phone) {
      alert("Username, age, gender and phone are required");
      return;
    }

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
      alert("Age must be a whole number between 1 and 120");
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      alert("Phone number must be exactly 10 digits");
      return;
    }
  }

  const url = isSignUp
    ? `${API_BASE}/register`
    : `${API_BASE}/login`;

  const payload = isSignUp
    ? {
        username,
        email,
        password,
        age: Number(age),
        gender,
        phone: cleanPhone
      }
    : { email, password };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Authentication failed");
      return;
    }

    // LOGIN SUCCESS
    if (data.token) {
      localStorage.setItem("token", data.token);
      window.location.href = "index.html";
      return;
    }

    // SIGNUP SUCCESS
    alert("Signup successful. Please sign in.");
    toggleAuthMode();

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    alert("Backend not reachable. Is server running?");
  }
});

// ================= INITIAL LISTENER =================
document.getElementById("toggleBtn").addEventListener("click", toggleAuthMode);


// ================= PASSWORD TOGGLE =================
const togglePasswordBtn = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");
const eyeOffIcon = document.getElementById("eyeOffIcon");

togglePasswordBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";

  // Toggle input type
  passwordInput.type = isPassword ? "text" : "password";

  // Toggle icons
  eyeIcon.classList.toggle("hidden");
  eyeOffIcon.classList.toggle("hidden");
});
