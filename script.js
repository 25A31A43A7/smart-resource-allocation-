const KEYS = {
  USERS: "users",
  SESSION: "sessionUser",
  RESOURCES: "resources",
  REQUESTS: "requests",
  LOGISTICS: "logistics",
  MATCHES: "matches"
};

let dashboardChart = null;
let currentSession = null;

let resourceMap = null;
let resourceMarker = null;
let requestMap = null;
let requestMarker = null;

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

window.onload = () => {
  initInteractiveBackground();
  initAuthPage();
  initAppPage();
};

function initInteractiveBackground() {
  const glow = document.getElementById("cursorGlow");
  if (!glow) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  let ticking = false;
  document.addEventListener("mousemove", (event) => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--pointer-x", `${x}%`);
      document.documentElement.style.setProperty("--pointer-y", `${y}%`);
      ticking = false;
    });
  });

  document.addEventListener("mouseleave", () => {
    document.documentElement.style.setProperty("--pointer-x", "50%");
    document.documentElement.style.setProperty("--pointer-y", "50%");
  });
}

function initAuthPage() {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  if (!loginForm || !signupForm) return;

  const showLoginBtn = document.getElementById("showLoginBtn");
  const showSignupBtn = document.getElementById("showSignupBtn");
  const authMessage = document.getElementById("authMessage");

  const switchTab = (isLogin) => {
    if (isLogin) {
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
      showLoginBtn?.classList.add("active");
      showSignupBtn?.classList.remove("active");
    } else {
      signupForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      showSignupBtn?.classList.add("active");
      showLoginBtn?.classList.remove("active");
    }
    setMessage(authMessage, "");
  };

  showLoginBtn?.addEventListener("click", () => switchTab(true));
  showSignupBtn?.addEventListener("click", () => switchTab(false));

  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = getValue("signupName");
    const email = getValue("signupEmail").toLowerCase();
    const password = getValue("signupPassword");

    if (!name || !email || !password) {
      setMessage(authMessage, "Please fill all signup fields.", "error");
      return;
    }

    const users = getStore(KEYS.USERS, []);
    const exists = users.some((user) => user.email === email);
    if (exists) {
      setMessage(authMessage, "Account already exists. Please login.", "error");
      return;
    }

    users.push({ name, email, password });
    setStore(KEYS.USERS, users);
    setMessage(authMessage, "Signup successful. Please login now.", "success");
    signupForm.reset();
    switchTab(true);
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = getValue("loginEmail").toLowerCase();
    const password = getValue("loginPassword");
    const users = getStore(KEYS.USERS, []);

    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) {
      setMessage(authMessage, "Invalid credentials.", "error");
      return;
    }

    setStore(KEYS.SESSION, { name: user.name, email: user.email });
    window.location.href = "app.html";
  });
}

function initAppPage() {
  const appWrapper = document.querySelector(".app-wrapper");
  if (!appWrapper) return;

  currentSession = getStore(KEYS.SESSION, null);
  if (!currentSession) {
    window.location.href = "index.html";
    return;
  }

  setText("sessionInfo", `Logged in as: ${safeText(currentSession.name, "User")} (${safeText(currentSession.email, "N/A")})`);
  ensureCoreStorage();
  initSectionToggles();
  setTimeout(initResourceMap, 100); // Initialize default active map
  initForms();
  initLogout();
  renderAll();
}

function ensureCoreStorage() {
  if (!localStorage.getItem(KEYS.RESOURCES)) setStore(KEYS.RESOURCES, {});
  if (!localStorage.getItem(KEYS.REQUESTS)) setStore(KEYS.REQUESTS, []);
  if (!localStorage.getItem(KEYS.LOGISTICS)) setStore(KEYS.LOGISTICS, []);
  if (!localStorage.getItem(KEYS.MATCHES)) setStore(KEYS.MATCHES, []);
}

function initSectionToggles() {
  const toggles = document.querySelectorAll(".section-toggle");
  const sections = ["addResourceSection", "requestResourceSection", "logisticsSection"];

  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      sections.forEach((sectionId) => {
        const el = document.getElementById(sectionId);
        if (!el) return;
        el.classList.toggle("hidden", sectionId !== target);
      });
      toggles.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");

      if (target === "addResourceSection") {
        setTimeout(initResourceMap, 100);
      } else if (target === "requestResourceSection") {
        setTimeout(initRequestMap, 100);
      }
    });
  });
}

function initForms() {
  const resourceForm = document.getElementById("resourceForm");
  const requestForm = document.getElementById("requestForm");
  const logisticsForm = document.getElementById("logisticsForm");

  resourceForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    let name = normalizeName(getValue("resourceName"));
    const qty = Number(getValue("resourceQty"));
    const user = getValue("providerName");
    const contact = getValue("providerPhone");
    const address = getValue("providerAddress");
    const lat = getValue("providerLat");
    const lng = getValue("providerLng");
    const resourceMessage = document.getElementById("resourceMessage");

    if (!isValidCommon(name, qty, user, contact, address, resourceMessage)) return;

    const resources = getStore(KEYS.RESOURCES, {});
    const existingKey = findResourceKey(resources, name);
    if (existingKey) {
      name = existingKey;
    }
    if (!resources[name]) resources[name] = [];
    resources[name].push({
      qty,
      user,
      contact,
      address,
      lat,
      lng,
      ownerEmail: safeText(currentSession?.email, "unknown@local")
    });

    setStore(KEYS.RESOURCES, resources);
    resourceForm.reset();
    if (resourceMarker) {
      resourceMap.removeLayer(resourceMarker);
      resourceMarker = null;
    }
    setMessage(resourceMessage, "Resource added successfully.", "success");
    renderAll();
  });

  requestForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = normalizeName(getValue("requestName"));
    const qty = Number(getValue("requestQty"));
    const user = getValue("requesterName");
    const contact = getValue("requesterPhone");
    const address = getValue("requesterAddress");
    const lat = getValue("requesterLat");
    const lng = getValue("requesterLng");
    const wantDelivery = document.querySelector('input[name="requestDelivery"]:checked')?.value === "yes";
    const requestMessage = document.getElementById("requestMessage");

    if (!isValidCommon(name, qty, user, contact, address, requestMessage)) return;

    const requests = getStore(KEYS.REQUESTS, []);
    requests.push({
      id: makeId("req"),
      name,
      qty,
      user,
      contact,
      address,
      lat,
      lng,
      wantDelivery,
      status: "Pending",
      requestedByEmail: safeText(currentSession?.email, "unknown@local"),
      approvedBy: "",
      approvedAt: "",
      requestedAt: new Date().toISOString(),
      deliveryDate: "",
      logisticsShared: false
    });
    setStore(KEYS.REQUESTS, requests);

    requestForm.reset();
    if (requestMarker) {
      requestMap.removeLayer(requestMarker);
      requestMarker = null;
    }
    setMessage(requestMessage, "Request submitted.", "success");
    renderAll();
  });

  logisticsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = getValue("logisticsName");
    const contact = getValue("logisticsPhone");
    const logisticsMessage = document.getElementById("logisticsMessage");

    if (!name || !contact) {
      setMessage(logisticsMessage, "Please fill all logistics fields.", "error");
      return;
    }
    if (!isValidPhone(contact)) {
      setMessage(logisticsMessage, "Logistics phone must be 10 digits.", "error");
      return;
    }

    const logistics = getStore(KEYS.LOGISTICS, []);
    logistics.push({ name, contact });
    setStore(KEYS.LOGISTICS, logistics);
    assignLogisticsToPendingMatches({ name, contact });

    logisticsForm.reset();
    setMessage(logisticsMessage, "Logistics member added and pending deliveries scheduled.", "success");
    renderAll();
  });
}

function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(KEYS.SESSION);
    window.location.href = "index.html";
  });
}

function renderAll() {
  checkDeliveries();
  renderRequests();
  renderMatches();
  renderStatsAndChart();
}

function renderRequests() {
  const list = document.getElementById("requestsList");
  if (!list) return;

  const requests = getStore(KEYS.REQUESTS, []);
  if (!requests.length) {
    list.innerHTML = '<div class="empty-state">No requests yet. Add a request to get started.</div>';
    return;
  }

  list.innerHTML = "";
  requests.forEach((request, index) => {
    const safe = sanitizeRequest(request);
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `
      <h4>${safe.name} (${safe.qty})</h4>
      <p>👤 ${safe.user}</p>
      <p>📞 ${safe.status === "Approved" ? safe.contact : "Visible after approval"}</p>
      <p>📍 ${safe.address}</p>
      <p>🧾 Submitted by: ${safe.requestedByEmail}</p>
      <p>📅 Delivery Date: ${safe.deliveryDate}</p>
      ${safe.logisticsShared ? '<p class="notify-badge">📣 Requester notified: Delivery date assigned</p>' : ""}
      <p><span class="badge ${safe.status.toLowerCase()}">${safe.status}</span></p>
    `;

    const approveBtn = document.createElement("button");
    approveBtn.className = "approve-btn";
    approveBtn.textContent = safe.status === "Approved" ? `Approved by ${safe.approvedBy}` : "Approve Request";
    approveBtn.disabled = safe.status === "Approved";
    approveBtn.addEventListener("click", () => approveRequest(index));
    card.appendChild(approveBtn);
    list.appendChild(card);
  });
}

function renderMatches() {
  const list = document.getElementById("matchesList");
  if (!list) return;

  const matches = getStore(KEYS.MATCHES, []);
  if (!matches.length) {
    list.innerHTML = '<div class="empty-state">No matches yet. Approve a request to create one.</div>';
    return;
  }

  list.innerHTML = "";
  matches.forEach((match) => {
    const safe = sanitizeMatch(match);
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `
      <h4>${safe.resource} (${safe.qty})</h4>
      <p class="match-highlight">🤝 Contact exchange completed after approval</p>
      ${safe.wantDelivery ? `<p><strong>Delivery Date</strong> → ${safe.deliveryDate}</p>` : ''}
      ${!safe.wantDelivery ? `<p><strong>Provider</strong> → 👤 ${safe.providerName} | 📞 ${safe.providerContact} | 📍 ${safe.providerAddress}</p>` : ''}
      <p><strong>Requester</strong> → 👤 ${safe.requesterName} | 📞 ${safe.requesterContact} | 📍 ${safe.requesterAddress}</p>
      ${safe.wantDelivery ? `<p><strong>Logistics</strong> → ${safe.logisticsLine}</p>` : ''}
      <p><strong>Requested On</strong> → ${safe.requestDate}</p>
      <p><strong>Approved By</strong> → ${safe.approvedBy}</p>
      <p><span class="badge ${safe.statusClass}">${safe.status}</span></p>
    `;
    list.appendChild(card);
  });
}

function renderStatsAndChart() {
  const resources = getStore(KEYS.RESOURCES, {});
  const requests = getStore(KEYS.REQUESTS, []);
  const matches = getStore(KEYS.MATCHES, []);

  const totalAvailable = sumAvailable(resources);
  const totalRequestedAll = requests.reduce((sum, req) => sum + safeNumber(req.qty), 0);
  const totalRequestedPending = requests
    .filter((req) => safeText(req.status).toLowerCase() !== "approved")
    .reduce((sum, req) => sum + safeNumber(req.qty), 0);
  const totalScheduled = matches
    .filter((match) => safeText(match.status).toLowerCase() === "scheduled")
    .reduce((sum, match) => sum + safeNumber(match.qty), 0);
  const totalDelivered = matches
    .filter((match) => safeText(match.status).toLowerCase() === "delivered")
    .reduce((sum, match) => sum + safeNumber(match.qty), 0);
  const successRate = totalRequestedAll > 0 ? Math.round((totalDelivered / totalRequestedAll) * 100) : 0;

  setText("statAvailable", totalAvailable);
  setText("statRequested", totalRequestedPending);
  setText("statScheduled", totalScheduled);
  setText("statDelivered", totalDelivered);
  setText("statSuccessRate", `${successRate}%`);

  renderChart(totalAvailable, totalRequestedPending, totalScheduled, totalDelivered);
}

function renderChart(available, requested, scheduled, delivered) {
  const canvas = document.getElementById("resourceChart");
  if (!canvas || typeof Chart === "undefined") return;

  const context = canvas.getContext("2d");
  if (!context) return;

  if (dashboardChart) {
    dashboardChart.destroy();
  }

  dashboardChart = new Chart(context, {
    type: "bar",
    data: {
      labels: ["Available", "Requested (Pending)", "Scheduled", "Delivered"],
      datasets: [
        {
          label: "Quantity",
          data: [available, requested, scheduled, delivered],
          backgroundColor: ["#40AFE1", "#F5BE24", "#3EC695", "#8E44AD"],
          borderColor: ["#5dc5f3", "#ffd45b", "#72e0b7", "#9B59B6"],
          borderWidth: 1.5,
          borderRadius: 14,
          borderSkipped: false,
          maxBarThickness: 72
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(6, 16, 30, 0.94)",
          titleColor: "#ffffff",
          bodyColor: "#d6e9ff",
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (tooltipItem) => `${tooltipItem.label}: ${tooltipItem.raw}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#ffffff", font: { weight: "600" }, maxRotation: 0, minRotation: 0 },
          grid: { color: "rgba(255,255,255,0.10)", drawBorder: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#ffffff", precision: 0, font: { weight: "600" }, stepSize: 50 },
          grid: { color: "rgba(255,255,255,0.10)", drawBorder: false }
        }
      }
    }
  });
}

function approveRequest(index) {
  const requests = getStore(KEYS.REQUESTS, []);
  const request = requests[index];
  if (!request || request.status === "Approved") return;
  if (!currentSession?.email) {
    alert("Please login first to approve requests.");
    return;
  }

  const resourceName = normalizeName(request.name);
  const requestQty = safeNumber(request.qty);
  const resourceKey = findResourceKey(resources, resourceName);

  if (!resourceName || requestQty <= 0 || !resourceKey || !resources[resourceKey] || !resources[resourceKey].length) {
    alert("No matching resource available for this request.");
    return;
  }

  let totalAvailable = resources[resourceKey].reduce((sum, p) => sum + safeNumber(p.qty), 0);
  if (totalAvailable < requestQty) {
    alert("Resource quantity is insufficient for approval.");
    return;
  }

  const requestDateISO = safeText(request.requestedAt, new Date().toISOString());
  const wantDelivery = request.wantDelivery !== false;
  let remainingReq = requestQty;
  let matchesToCreate = [];

  while (remainingReq > 0 && resources[resourceKey].length > 0) {
    let provider = resources[resourceKey][0];
    let providerQty = safeNumber(provider.qty);
    let qtyToTake = Math.min(providerQty, remainingReq);
    
    provider.qty = providerQty - qtyToTake;
    remainingReq -= qtyToTake;

    const match = {
      requestId: safeText(request.id, makeId("legacyReq")),
      resource: resourceKey,
      qty: qtyToTake,
      providerName: safeText(provider.user),
      providerContact: safeText(provider.contact),
      providerAddress: safeText(provider.address),
      requesterName: safeText(request.user),
      requesterContact: safeText(request.contact),
      requesterAddress: safeText(request.address),
      logisticsName: wantDelivery ? "To Be Assigned" : "N/A (Pickup)",
      logisticsContact: wantDelivery ? "Will be shared after assignment" : "N/A",
      approvedBy: safeText(currentSession.name, "System"),
      requestDate: formatDate(requestDateISO),
      deliveryDate: wantDelivery ? "Will be assigned after logistics confirmation" : "N/A",
      status: wantDelivery ? "Pending Logistics" : "Ready for Pickup",
      wantDelivery: wantDelivery
    };
    matchesToCreate.push(match);

    if (provider.qty === 0) {
      resources[resourceKey].shift();
    }
  }

  if (resources[resourceKey].length === 0) {
    delete resources[resourceKey];
  }

  const matches = getStore(KEYS.MATCHES, []);
  matches.push(...matchesToCreate);
  requests[index].status = "Approved";
  requests[index].approvedBy = safeText(currentSession.name, "System");
  requests[index].approvedAt = new Date().toLocaleString();

  setStore(KEYS.MATCHES, matches);
  setStore(KEYS.REQUESTS, requests);
  setStore(KEYS.RESOURCES, resources);
  renderAll();
}

function isValidCommon(name, qty, user, contact, address, messageNode) {
  if (!name || !qty || !user || !contact || !address) {
    setMessage(messageNode, "Please fill all fields.", "error");
    return false;
  }
  if (qty < 1) {
    setMessage(messageNode, "Quantity must be at least 1.", "error");
    return false;
  }
  if (!isValidPhone(contact)) {
    setMessage(messageNode, "Phone number must be exactly 10 digits.", "error");
    return false;
  }
  return true;
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(String(phone).trim());
}

function normalizeName(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function findResourceKey(resources, requestedName) {
  const cleaned = normalizeName(requestedName);
  if (!cleaned || !resources || typeof resources !== "object") return "";
  if (resources[cleaned]) return cleaned;
  const lowered = cleaned.toLowerCase();
  const keys = Object.keys(resources);
  return keys.find((key) => normalizeName(key).toLowerCase() === lowered) || "";
}

function sanitizeRequest(request = {}) {
  return {
    name: safeText(request.name, "Unknown Resource"),
    qty: safeNumber(request.qty),
    user: safeText(request.user, "Unknown Requester"),
    contact: safeText(request.contact, "N/A"),
    address: safeText(request.address, "N/A"),
    status: safeText(request.status, "Pending"),
    requestedByEmail: safeText(request.requestedByEmail, "N/A"),
    approvedBy: safeText(request.approvedBy, "N/A"),
    deliveryDate: safeText(request.deliveryDate, "Pending logistics assignment"),
    logisticsShared: Boolean(request.logisticsShared)
  };
}

function sanitizeMatch(match = {}) {
  const status = safeText(match.status, "Pending");
  const hasLogisticsDetails = safeText(match.logisticsName).toLowerCase() !== "to be assigned";
  return {
    resource: safeText(match.resource, "Unknown Resource"),
    qty: safeNumber(match.qty),
    providerName: safeText(match.providerName, "Unknown Provider"),
    providerContact: safeText(match.providerContact, "N/A"),
    providerAddress: safeText(match.providerAddress, "N/A"),
    requesterName: safeText(match.requesterName, "Unknown Requester"),
    requesterContact: safeText(match.requesterContact, "N/A"),
    requesterAddress: safeText(match.requesterAddress, "N/A"),
    logisticsName: safeText(match.logisticsName, "Not Assigned"),
    logisticsContact: safeText(match.logisticsContact, "N/A"),
    approvedBy: safeText(match.approvedBy, "System"),
    requestDate: safeText(match.requestDate, "N/A"),
    deliveryDate: safeText(match.deliveryDate, "Not Scheduled"),
    status,
    statusClass: status.toLowerCase().includes("scheduled") ? "scheduled" : (status.toLowerCase().includes("delivered") ? "scheduled" : (status.toLowerCase().includes("pickup") ? "approved" : "pending")),
    logisticsLine: match.wantDelivery === false 
      ? "🚫 Not required (Pickup by requester)"
      : (hasLogisticsDetails
        ? `🚚 ${safeText(match.logisticsName)} | 📞 ${safeText(match.logisticsContact)}`
        : "🚚 Details will be shared after logistics member assignment"),
    wantDelivery: match.wantDelivery !== false
  };
}

function generateScheduledDate(requestDateISO) {
  const base = new Date(requestDateISO);
  const start = Number.isNaN(base.getTime()) ? new Date() : base;
  const plusDays = Math.random() < 0.5 ? 4 : 5;
  const output = new Date(start);
  output.setDate(start.getDate() + plusDays);
  output.setHours(10 + Math.floor(Math.random() * 8), 0, 0, 0);
  return output.toISOString();
}

function assignLogisticsToPendingMatches(logisticsPerson) {
  const matches = getStore(KEYS.MATCHES, []);
  const requests = getStore(KEYS.REQUESTS, []);
  const pendingMatches = matches.filter((item) => safeText(item.status).toLowerCase() === "pending logistics");
  if (!pendingMatches.length) return;

  pendingMatches.forEach((match) => {
    const baseDateISO = convertDisplayDateToISO(safeText(match.requestDate)) || new Date().toISOString();
    const scheduledISO = generateScheduledDate(baseDateISO);
    match.deliveryDateISO = scheduledISO;
    match.deliveryDate = formatDate(scheduledISO);
    match.logisticsName = safeText(logisticsPerson.name, "Not Assigned");
    match.logisticsContact = safeText(logisticsPerson.contact, "N/A");
    match.status = "Scheduled";

    const reqId = safeText(match.requestId);
    if (reqId) {
      const reqIndex = requests.findIndex((req) => safeText(req.id) === reqId);
      if (reqIndex > -1) {
        requests[reqIndex].deliveryDate = match.deliveryDate;
        requests[reqIndex].logisticsShared = true;
      }
    }
  });

  setStore(KEYS.MATCHES, matches);
  setStore(KEYS.REQUESTS, requests);
}

function checkDeliveries() {
  const matches = getStore(KEYS.MATCHES, []);
  let changed = false;
  const now = new Date();
  matches.forEach(match => {
    if (match.status === "Scheduled" && match.deliveryDateISO) {
      if (now > new Date(match.deliveryDateISO)) {
        match.status = "Delivered";
        changed = true;
      }
    }
  });
  if (changed) {
    setStore(KEYS.MATCHES, matches);
  }
}

function convertDisplayDateToISO(displayDate) {
  if (!displayDate || displayDate === "N/A") return "";
  const parsed = new Date(displayDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function formatDate(dateISO) {
  const value = new Date(dateISO);
  if (Number.isNaN(value.getTime())) return "N/A";
  return value.toLocaleDateString() + " " + value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sumAvailable(resources) {
  return Object.values(resources || {}).reduce((sum, providerList) => {
    if (!Array.isArray(providerList)) return sum;
    return sum + providerList.reduce((inner, provider) => inner + safeNumber(provider.qty), 0);
  }, 0);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = String(value);
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : "";
}

function setMessage(el, text, type = "") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("error", "success");
  if (type) el.classList.add(type);
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function setStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initResourceMap() {
  const mapEl = document.getElementById('resourceMap');
  if (!mapEl) return;
  mapEl.classList.remove('hidden');

  if (resourceMap) {
    setTimeout(() => resourceMap.invalidateSize(), 100);
    return;
  }
  resourceMap = L.map('resourceMap').setView([20.5937, 78.9629], 5); // Default to India
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(resourceMap);

  resourceMap.on('click', function(e) {
    setMapLocation(resourceMap, 'resourceMarker', e.latlng.lat, e.latlng.lng, 'providerLat', 'providerLng', 'providerAddress');
  });

  const btn = document.getElementById('btnResourceLocation');
  if (btn) {
    btn.addEventListener('click', () => {
      getCurrentLocation(resourceMap, 'resourceMarker', 'providerLat', 'providerLng', 'providerAddress');
    });
  }
}

function initRequestMap() {
  const mapEl = document.getElementById('requestMap');
  if (!mapEl) return;
  mapEl.classList.remove('hidden');

  if (requestMap) {
    setTimeout(() => requestMap.invalidateSize(), 100);
    return;
  }
  requestMap = L.map('requestMap').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(requestMap);

  requestMap.on('click', function(e) {
    setMapLocation(requestMap, 'requestMarker', e.latlng.lat, e.latlng.lng, 'requesterLat', 'requesterLng', 'requesterAddress');
  });

  const btn = document.getElementById('btnRequestLocation');
  if (btn) {
    btn.addEventListener('click', () => {
      getCurrentLocation(requestMap, 'requestMarker', 'requesterLat', 'requesterLng', 'requesterAddress');
    });
  }
}

function setMapLocation(map, markerName, lat, lng, latInputId, lngInputId, addressInputId) {
  const latEl = document.getElementById(latInputId);
  const lngEl = document.getElementById(lngInputId);
  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;

  map.setView([lat, lng], 13);
  
  if (window[markerName]) {
    map.removeLayer(window[markerName]);
  }
  window[markerName] = L.marker([lat, lng]).addTo(map);

  // Reverse Geocoding
  fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng)
    .then(res => res.json())
    .then(data => {
      const addressEl = document.getElementById(addressInputId);
      if (addressEl && data && data.display_name) {
        addressEl.value = data.display_name;
      }
    })
    .catch(err => console.error('Geocoding error', err));
}

function getCurrentLocation(map, markerName, latInputId, lngInputId, addressInputId) {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setMapLocation(map, markerName, lat, lng, latInputId, lngInputId, addressInputId);
    },
    (error) => {
      alert('Unable to retrieve your location');
      console.error(error);
    }
  );
}

