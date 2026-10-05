const DATA_URLS = {
  matkul: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQB4FSvr4NZRfnYY6es0RcsSvbQphap4lPjIJBg8fM-PAuFooGNcOPxz4SvNr6jgA9BBLUZQpjeWsCq/pub?gid=0&single=true&output=csv",
  materi: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQB4FSvr4NZRfnYY6es0RcsSvbQphap4lPjIJBg8fM-PAuFooGNcOPxz4SvNr6jgA9BBLUZQpjeWsCq/pub?gid=1754728472&single=true&output=csv",
  project: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQB4FSvr4NZRfnYY6es0RcsSvbQphap4lPjIJBg8fM-PAuFooGNcOPxz4SvNr6jgA9BBLUZQpjeWsCq/pub?gid=678966839&single=true&output=csv",
  settings: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQB4FSvr4NZRfnYY6es0RcsSvbQphap4lPjIJBg8fM-PAuFooGNcOPxz4SvNr6jgA9BBLUZQpjeWsCq/pub?gid=1424245249&single=true&output=csv",
  // Sheet baru. Gviz memakai nama sheet, jadi tidak perlu mengetahui gid akademik.
  akademik: "https://docs.google.com/spreadsheets/d/1WfV6Vr1-daUjMoAFyVZIbku1SSVV6mzblZJ19OxmBtU/gviz/tq?tqx=out:csv&sheet=akademik",
  praktikum: "https://docs.google.com/spreadsheets/d/1WfV6Vr1-daUjMoAFyVZIbku1SSVV6mzblZJ19OxmBtU/gviz/tq?tqx=out:csv&sheet=praktikum"
};

const state = {
  matkul: [],
  materi: [],
  project: [],
  settings: {},
  akademik: [],
  praktikum: [],
  semester: null
};

document.addEventListener("DOMContentLoaded", () => {
  setupMenu();
  initPage();
});

function setupMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const links = document.querySelector("#navLinks");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

async function initPage() {
  try {
    const [matkul, materi, project, settings, akademik, praktikum] = await Promise.all([
      fetchCSV(DATA_URLS.matkul),
      fetchCSV(DATA_URLS.materi),
      fetchCSV(DATA_URLS.project),
      fetchCSV(DATA_URLS.settings),
      fetchOptionalCSV(DATA_URLS.akademik),
      fetchOptionalCSV(DATA_URLS.praktikum)
    ]);

    state.matkul = matkul;
    state.materi = materi;
    state.project = project;
    state.settings = objectifySettings(settings);
    state.akademik = akademik;
    state.praktikum = praktikum;
    state.semester = getSelectedSemester();

    const page = document.body.dataset.page;

    if (page === "home") renderHome();
    if (page === "semester") renderSemesterPage();
    if (page === "matkul") renderCoursePage();
  } catch (error) {
    console.error(error);
    showGlobalError(error);
  }
}

async function fetchCSV(url) {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Gagal mengambil data CSV (${response.status}).`);
  const text = await response.text();
  return parseCSV(text);
}

async function fetchOptionalCSV(url) {
  try {
    return await fetchCSV(url);
  } catch (error) {
    console.warn("Data opsional belum dapat dimuat:", url, error);
    return [];
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(header => header.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map(values => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = (values[index] ?? "").trim();
    });
    return object;
  });
}

function objectifySettings(rows) {
  return rows.reduce((result, row) => {
    if (row.pengaturan) result[row.pengaturan.trim()] = row.nilai?.trim() ?? "";
    return result;
  }, {});
}

function getDefaultSemester() {
  const value = Number(state.settings.semester_sekarang);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function getSelectedSemester() {
  const saved = Number(localStorage.getItem("selectedSemester"));
  return Number.isFinite(saved) && saved > 0 ? saved : getDefaultSemester();
}

function setSelectedSemester(semester) {
  localStorage.setItem("selectedSemester", String(semester));
}

function activeCourses(semester) {
  return state.matkul
    .filter(item =>
      Number(item.semester) === Number(semester) &&
      String(item.aktif).toLowerCase() === "true"
    )
    .sort((a, b) => Number(a.id_matkul.replace(/\D/g, "")) - Number(b.id_matkul.replace(/\D/g, "")));
}

function renderHome() {
  const badge = document.querySelector("#semesterBadge");
  const courseList = document.querySelector("#courseList");
  const projectList = document.querySelector("#projectList");

  badge.textContent = `Semester ${state.semester}`;

  const courses = activeCourses(state.semester);

  courseList.innerHTML = courses.length
    ? courses.map((course, index) => `
        <a class="course-card" href="matkul.html?slug=${encodeURIComponent(course.slug)}">
          <div>
            <span class="card-number">${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHTML(course.nama_matkul)}</h3>
            <div class="course-info">
              <span>Kelas ${escapeHTML(course.kelas || "—")}</span>
              ${isYes(course.praktikum) ? `<span>Praktikum</span>` : ""}
            </div>
          </div>
          <span class="card-link">Lihat Detail →</span>
        </a>
      `).join("")
    : `<div class="empty-state">Belum ada mata kuliah untuk Semester ${state.semester}.</div>`;

  const projects = state.project.filter(item =>
    String(item.aktif).toLowerCase() === "true"
  );

  projectList.innerHTML = projects.length
    ? projects.map(project => `
        <div class="project-card">
          <div>
            <span class="project-platform">${escapeHTML(project.platform || "Project")}</span>
            <h3>${escapeHTML(project.nama)}</h3>
            <p>${escapeHTML(project.deskripsi || "")}</p>
          </div>
          ${validUrl(project.link)
            ? `<a class="card-link" href="${escapeAttribute(getProjectUrl(project.link))}" target="_blank" rel="noopener noreferrer">Download Project ↗</a>`
            : `<span class="card-link muted-link">Link belum tersedia</span>`}
        </div>
      `).join("")
    : `<div class="empty-state">Belum ada project yang ditampilkan.</div>`;
}

function renderSemesterPage() {
  const container = document.querySelector("#semesterList");
  const academicContainer = document.querySelector("#academicList");

  const available = [...new Set(
    state.matkul
      .filter(item => String(item.aktif).toLowerCase() === "true")
      .map(item => Number(item.semester))
      .filter(Number.isFinite)
  )].sort((a, b) => a - b);

  const academicSemesters = state.akademik
    .map(item => Number(item.semester))
    .filter(Number.isFinite);

  const maxSemester = Math.max(8, ...available, ...academicSemesters, getDefaultSemester());
  const semesters = Array.from({ length: maxSemester }, (_, i) => i + 1);

  const academicRows = [...state.akademik]
    .filter(item => Number.isFinite(Number(item.semester)))
    .sort((a, b) => Number(a.semester) - Number(b.semester));

  academicContainer.innerHTML = academicRows.length
    ? academicRows.map(row => `
        <div class="academic-card">
          <span class="academic-semester">SEMESTER ${escapeHTML(row.semester)}</span>
          <div class="academic-values">
            <div>
              <small>IP</small>
              <strong>${escapeHTML(row.IP || "—")}</strong>
            </div>
            <div>
              <small>IPK</small>
              <strong>${escapeHTML(row.IPK || "—")}</strong>
            </div>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">Data IP dan IPK belum tersedia.</div>`;

  container.innerHTML = semesters.map(semester => {
    const count = activeCourses(semester).length;
    const current = Number(state.semester) === semester;
    const academic = state.akademik.find(item => Number(item.semester) === semester);
    const academicText = academic
      ? `IP ${escapeHTML(academic.IP || "—")} · IPK ${escapeHTML(academic.IPK || "—")}`
      : "Data IP/IPK belum tersedia";

    return `
      <a class="semester-card ${current ? "current" : ""}" href="index.html#mata-kuliah"
         data-semester="${semester}">
        <span class="number">SEMESTER ${String(semester).padStart(2, "0")}</span>
        <h3>Semester ${semester}</h3>
        <div class="semester-academic">${academicText}</div>
        <small>${count} mata kuliah tersedia${current ? " · aktif" : ""}</small>
      </a>
    `;
  }).join("");

  container.querySelectorAll("[data-semester]").forEach(card => {
    card.addEventListener("click", event => {
      const semester = Number(event.currentTarget.dataset.semester);
      setSelectedSemester(semester);
    });
  });
}

function renderCoursePage() {
  const slug = new URLSearchParams(location.search).get("slug");
  const course = state.matkul.find(item =>
    item.slug === slug &&
    String(item.aktif).toLowerCase() === "true"
  );

  if (!course) {
    document.querySelector("#courseDetail").innerHTML = `
      <section class="page-hero">
        <div class="container">
          <p class="eyebrow">ERROR</p>
          <h1>Mata kuliah tidak ditemukan.</h1>
          <p>Periksa kembali link mata kuliah atau data pada Google Sheets.</p>
        </div>
      </section>`;
    document.title = "Portfolio | Tidak Ditemukan";
    return;
  }

  document.title = `Portfolio | ${course.nama_matkul}`;
  document.querySelector("#courseTitle").textContent = course.nama_matkul;
  document.querySelector("#courseSemester").textContent = `SEMESTER ${course.semester}`;
  document.querySelector("#courseMeta").innerHTML = `
    <span>Kelas ${escapeHTML(course.kelas || "—")}</span>
    ${isYes(course.praktikum) ? `<span>Praktikum</span>` : ""}
  `;
  document.querySelector("#courseSubtitle").textContent = "Arsip catatan, tugas, dan dokumentasi mata kuliah.";

  const rows = state.materi
    .filter(item => item.id_matkul === course.id_matkul)
    .sort((a, b) => Number(a.nomor) - Number(b.nomor));

  const notes = rows.filter(item => String(item.jenis).toLowerCase() === "catatan");
  const tasks = rows.filter(item => String(item.jenis).toLowerCase() === "tugas");

  renderContentList("#notesList", notes, "Belum ada catatan.");
  renderContentList("#tasksList", tasks, "Belum ada tugas.");
  renderPracticum(course);
}

function renderPracticum(course) {
  const section = document.querySelector("#practicumSection");
  const container = document.querySelector("#practicumList");

  if (!isYes(course.praktikum)) {
    section.remove();
    return;
  }

  const rows = state.praktikum
    .filter(item => item.id_matkul === course.id_matkul)
    .sort((a, b) => Number(a.nomor) - Number(b.nomor));

  if (!rows.length) {
    container.innerHTML = `
      <div class="practicum-empty">
        <strong>Praktikum belum dimulai.</strong>
        <p>Dokumentasi project praktikum, file coding, catatan proses, dan analisis hasil akan ditambahkan setelah kegiatan praktikum dimulai.</p>
      </div>`;
    return;
  }

  container.innerHTML = rows.map(row => `
    <article class="practicum-card">
      <div class="practicum-title">
        <span class="card-number">PRAKTIKUM ${escapeHTML(row.nomor || "")}</span>
        <h3>${escapeHTML(row.judul || `Praktikum ${row.nomor || ""}`)}</h3>
      </div>
      <div class="practicum-links">
        ${practicumLink("Project Praktikum", row.project)}
        ${practicumLink("File Coding", row.coding)}
        ${practicumLink("Catatan Proses", row.catatan_proses)}
        ${practicumLink("Analisis Hasil", row.analisi_hasil || row.analisis_hasil)}
      </div>
    </article>
  `).join("");
}

function practicumLink(label, link) {
  return validUrl(link)
    ? `<a class="practicum-link" href="${escapeAttribute(getProjectUrl(link))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
    : `<span class="practicum-link disabled">${label}<small>Belum tersedia</small></span>`;
}

function renderContentList(selector, items, emptyText) {
  const container = document.querySelector(selector);

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="content-item">
      <div class="meta">
        <small>${escapeHTML(item.jenis)} ${item.nomor ? `· ${escapeHTML(item.nomor)}` : ""}</small>
        <h3>${escapeHTML(item.judul)}</h3>
      </div>
      ${validUrl(item.link)
        ? `<a class="file-btn" href="${escapeAttribute(item.link)}" target="_blank" rel="noopener noreferrer">Lihat File ↗</a>`
        : `<span class="file-btn disabled">File belum tersedia</span>`}
    </div>
  `).join("");
}

function isYes(value) {
  return ["ya", "yes", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

function getProjectUrl(value) {
  if (!validUrl(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname === "drive.google.com") {
      const match = url.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(match[1])}`;
    }
  } catch {}
  return value;
}

function validUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHTML(value).replace(/`/g, "&#096;");
}

function showGlobalError(error) {
  const message = escapeHTML(error?.message || "Terjadi kesalahan saat mengambil data.");
  document.querySelectorAll(".loading-card").forEach(element => {
    element.outerHTML = `<div class="error-state">Gagal memuat data: ${message}</div>`;
  });
}
