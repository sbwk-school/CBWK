/**
 * adminSheet.js - หน้าแอดมินสำหรับแก้ไขตารางสอนสไตล์ Spreadsheet และการตั้งค่าระบบ Firebase
 */

(function(global) {
  const { 
    getSchoolSettings, 
    saveSchoolSettings, 
    getPeriods, 
    savePeriods, 
    getTeachers, 
    saveTeachers, 
    getTeacherGrades,
    saveTeacherGrades,
    getAllTimetables, 
    saveDayTimetable, 
    saveAllTimetables,
    getFirebaseConfig, 
    parseConfigInput, 
    saveFirebaseConfig, 
    testFirebaseConnection, 
    seedAllDataToFirebase 
  } = global.TeachDatabase;

  const {
    GRADE_BANDS = [
      { key: "ป.1-3", label: "ป.1-3 (เขียวพาสเทล)", colorName: "เขียว", color: "emerald", cellBg: "bg-emerald-50", rowHover: "hover:bg-emerald-100/80", badgeClass: "bg-emerald-200/90 text-emerald-950 border-emerald-300", borderClass: "border-l-emerald-500", dotClass: "bg-emerald-500", textClass: "text-emerald-950" },
      { key: "ป.4-6", label: "ป.4-6 (แดงพาสเทล)", colorName: "แดง", color: "rose", cellBg: "bg-rose-50", rowHover: "hover:bg-rose-100/80", badgeClass: "bg-rose-200/90 text-rose-950 border-rose-300", borderClass: "border-l-rose-500", dotClass: "bg-rose-500", textClass: "text-rose-950" },
      { key: "ม.1-3", label: "ม.1-3 (ฟ้าพาสเทล)", colorName: "ฟ้า", color: "sky", cellBg: "bg-sky-50", rowHover: "hover:bg-sky-100/80", badgeClass: "bg-sky-200/90 text-sky-950 border-sky-300", borderClass: "border-l-sky-500", dotClass: "bg-sky-500", textClass: "text-sky-950" },
      { key: "ม.4-6", label: "ม.4-6 (ม่วงพาสเทล)", colorName: "ม่วง", color: "purple", cellBg: "bg-purple-50", rowHover: "hover:bg-purple-100/80", badgeClass: "bg-purple-200/90 text-purple-950 border-purple-300", borderClass: "border-l-purple-500", dotClass: "bg-purple-500", textClass: "text-purple-950" }
    ],
    THAI_DAY_CONFIG = {
      "จันทร์": { name: "วันจันทร์", colorName: "เหลือง", activeClass: "bg-amber-200 text-amber-950 border-amber-400 shadow-xs ring-2 ring-amber-400/50 font-black", inactiveClass: "bg-amber-50/80 text-amber-900 border-amber-200/80 hover:bg-amber-100 hover:border-amber-300", dotClass: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-900 border-amber-300" },
      "อังคาร": { name: "วันอังคาร", colorName: "ชมพู", activeClass: "bg-pink-200 text-pink-950 border-pink-400 shadow-xs ring-2 ring-pink-400/50 font-black", inactiveClass: "bg-pink-50/80 text-pink-900 border-pink-200/80 hover:bg-pink-100 hover:border-pink-300", dotClass: "bg-pink-500", badgeClass: "bg-pink-100 text-pink-900 border-pink-300" },
      "พุธ": { name: "วันพุธ", colorName: "เขียว", activeClass: "bg-emerald-200 text-emerald-950 border-emerald-400 shadow-xs ring-2 ring-emerald-400/50 font-black", inactiveClass: "bg-emerald-50/80 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300" },
      "พฤหัสบดี": { name: "วันพฤหัสบดี", colorName: "ส้ม", activeClass: "bg-orange-200 text-orange-950 border-orange-400 shadow-xs ring-2 ring-orange-400/50 font-black", inactiveClass: "bg-orange-50/80 text-orange-900 border-orange-200/80 hover:bg-orange-100 hover:border-orange-300", dotClass: "bg-orange-500", badgeClass: "bg-orange-100 text-orange-900 border-orange-300" },
      "ศุกร์": { name: "วันศุกร์", colorName: "ฟ้า", activeClass: "bg-sky-200 text-sky-950 border-sky-400 shadow-xs ring-2 ring-sky-400/50 font-black", inactiveClass: "bg-sky-50/80 text-sky-900 border-sky-200/80 hover:bg-sky-100 hover:border-sky-300", dotClass: "bg-sky-500", badgeClass: "bg-sky-100 text-sky-900 border-sky-300" }
    },
    DEFAULT_TEACHER_GRADES = {}
  } = global.TeachData || {};

  const ADMIN_PIN_KEY = 'teach_admin_pin';
  const DEFAULT_PIN = '0000';

  let isUnlocked = false;
  let activeAdminTab = 'school';
  let selectedDay = 'จันทร์';
  let activeTimetables = {};
  let activeTeachers = [];
  let activePeriods = [];
  let activeSettings = {};
  let activeTeacherGrades = {};
  let teacherFilterGrade = 'ALL';
  let teacherSearchQuery = '';
  let sheetFilterGrade = 'ALL';
  let sessionRawLogoUrl = null;

  async function initAdminPage() {
    const container = document.getElementById('view-admin');
    if (!container) return;

    isUnlocked = sessionStorage.getItem('teach_admin_unlocked') === 'true';

    if (!isUnlocked) {
      renderPinLockScreen();
    } else {
      try {
        await loadAdminData();
      } catch (err) {
        console.warn("loadAdminData error fallback:", err);
      }
      try {
        renderAdminDashboard();
      } catch (err2) {
        console.error("renderAdminDashboard error:", err2);
        renderPinLockScreen();
      }
    }
  }

  function getStoredPin() {
    return localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_PIN;
  }

  function renderPinLockScreen() {
    const container = document.getElementById('view-admin');
    container.innerHTML = `
      <div class="max-w-md mx-auto my-12 glass-card hover-lift rounded-3xl shadow-xl border border-slate-200/90 p-8 text-center animate-in fade-in duration-200">
        <div class="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm shadow-indigo-500/25">
          <i data-lucide="lock" class="w-8 h-8"></i>
        </div>
        <h2 class="text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแลระบบ (Admin)</h2>
        <p class="text-xs text-slate-500 mt-1 mb-6">กรุณากรอกรหัสผ่าน 4 หลัก เพื่อจัดการตารางสอนและการตั้งค่า</p>

        <div class="flex justify-center gap-3 mb-6">
          <input type="password" id="pin-input" maxlength="4" placeholder="••••" autofocus
            class="w-48 text-center tracking-[1em] text-2xl font-black py-3 bg-white border-2 border-slate-300 rounded-2xl outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all shadow-2xs">
        </div>

        <div id="pin-error-msg" class="text-xs text-rose-500 font-semibold mb-4 hidden">
          รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
        </div>

        <button id="btn-unlock-admin" 
          class="btn-press hover-lift-sm w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-sm shadow-indigo-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
          <i data-lucide="key" class="w-4 h-4"></i>
          ปลดล็อคเข้าสู่ระบบ
        </button>

        <div class="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          รหัสผ่านเริ่มต้นของระบบคือ <strong class="text-slate-600 font-mono">0000</strong>
        </div>
      </div>
    `;

    const pinInput = document.getElementById('pin-input');
    const errorMsg = document.getElementById('pin-error-msg');
    const unlockBtn = document.getElementById('btn-unlock-admin');

    const checkPin = async () => {
      const entered = pinInput.value.trim();
      if (entered === getStoredPin()) {
        isUnlocked = true;
        sessionStorage.setItem('teach_admin_unlocked', 'true');
        await loadAdminData();
        renderAdminDashboard();
      } else {
        errorMsg.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
      }
    };

    unlockBtn.addEventListener('click', checkPin);
    pinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkPin();
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadAdminData() {
    activeTeachers = (await getTeachers()) || [];
    activeTimetables = (await getAllTimetables()) || {};
    activePeriods = (await getPeriods()) || [];
    activeSettings = (await getSchoolSettings()) || {};
    if (activeSettings) {
      delete activeSettings.rawLogoUrl;
    }
    if (getTeacherGrades) {
      activeTeacherGrades = (await getTeacherGrades()) || {};
    } else {
      activeTeacherGrades = { ...DEFAULT_TEACHER_GRADES };
    }
  }

  function renderAdminDashboard() {
    const container = document.getElementById('view-admin');
    const config = getFirebaseConfig();

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-6">

        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <span class="p-2.5 bg-gradient-to-tr from-slate-800 to-slate-950 text-white rounded-2xl shadow-sm">
                <i data-lucide="layout-grid" class="w-5 h-5 sm:w-6 sm:h-6"></i>
              </span>
              จัดการระบบแอดมิน (Admin Panel)
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">จัดการตารางสอนสไตล์ Sheet, ตั้งค่าคาบเรียน, ข้อมูลโรงเรียน และเชื่อมต่อฐานข้อมูล Firebase</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-2xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              เชื่อมต่อคลาวด์ Firebase แล้ว (arrange-c24b2)
            </span>

            <button id="btn-lock-admin" 
              class="btn-press hover-lift-sm inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold rounded-xl border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
              title="ล็อคหน้าแอดมิน">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              ล็อคระบบ
            </button>
          </div>
        </div>

        <!-- Admin Sub-Navigation (Segmented Glass Pills) -->
        <div class="p-1 bg-slate-100/80 backdrop-blur-xs rounded-2xl border border-slate-200/60 inline-flex flex-wrap gap-1">
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'school' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="school">
            <i data-lucide="building-2" class="w-4 h-4 inline mr-1.5 text-amber-500"></i>
            ข้อมูลโรงเรียน & ผู้บริหาร
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'periods' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="periods">
            <i data-lucide="clock" class="w-4 h-4 inline mr-1.5 text-blue-500"></i>
            คาบเรียน & รายชื่อครู
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'sheet' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="sheet">
            <i data-lucide="sheet" class="w-4 h-4 inline mr-1.5 text-indigo-500"></i>
            ตารางสอน
          </button>
        </div>

        <div id="admin-tab-content">
        </div>

      </div>
    `;

    document.getElementById('btn-lock-admin').addEventListener('click', () => {
      sessionStorage.removeItem('teach_admin_unlocked');
      isUnlocked = false;
      renderPinLockScreen();
    });

    container.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeAdminTab = e.currentTarget.dataset.tab;
        renderAdminDashboard();
      });
    });

    renderActiveTabContent();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderActiveTabContent() {
    const contentArea = document.getElementById('admin-tab-content');
    if (!contentArea) return;

    if (activeAdminTab === 'school') {
      renderSchoolTab(contentArea);
    } else if (activeAdminTab === 'periods') {
      renderPeriodsTab(contentArea);
    } else if (activeAdminTab === 'sheet') {
      renderSpreadsheetTab(contentArea);
    } else {
      renderSchoolTab(contentArea);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // Excel / CSV Parsing & Auto-Analysis
  // -------------------------------------------------------------
  function parseCsvToRows(csvText) {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];
    for (let line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let inQuotes = false;
      let curr = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          row.push(curr.trim());
          curr = '';
        } else {
          curr += c;
        }
      }
      row.push(curr.trim());
      result.push(row);
    }
    return result;
  }

  function analyzeGradeBandFromSubjects(subs, fallbackGrade) {
    let scoreP13 = 0;
    let scoreP46 = 0;
    let scoreM13 = 0;
    let scoreM46 = 0;

    (subs || []).forEach(s => {
      if (!s) return;
      if (/ป\s*[.\-]?\s*[1-3]/i.test(s)) scoreP13 += 2;
      if (/ป\s*[.\-]?\s*[4-6]/i.test(s)) scoreP46 += 2;
      if (/ม\s*[.\-]?\s*[1-3]/i.test(s)) scoreM13 += 2;
      if (/ม\s*[.\-]?\s*[4-6]/i.test(s)) scoreM46 += 2;
    });

    const max = Math.max(scoreP13, scoreP46, scoreM13, scoreM46);
    if (max > 0) {
      if (max === scoreP13) return "ป.1-3";
      if (max === scoreP46) return "ป.4-6";
      if (max === scoreM13) return "ม.1-3";
      if (max === scoreM46) return "ม.4-6";
    }
    return fallbackGrade || "ป.1-3";
  }

  function analyzeScheduleRows(rows) {
    let headerRowIdx = 0;
    let colDay = -1;
    let colTeacher = -1;
    let periodCols = [];

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i] || [];
      const rowStr = r.map(c => String(c).trim()).join(' ');
      if (rowStr.includes("ครู") || rowStr.includes("รายชื่อ") || rowStr.includes("ชื่อ") || rowStr.includes("คาบ") || rowStr.includes("วัน")) {
        headerRowIdx = i;
        r.forEach((cellVal, cIdx) => {
          const val = String(cellVal).trim();
          if (/วัน/i.test(val) && colDay === -1) colDay = cIdx;
          if ((/ครู|อาจารย์|ผู้สอน|รายชื่อ|ชื่อ\s*[-–]?\s*สกุล/i.test(val)) && colTeacher === -1) colTeacher = cIdx;
          if (/คาบ/i.test(val)) periodCols.push(cIdx);
        });
        break;
      }
    }

    // Auto-detect teacher column from Thai prefix if still not found
    if (colTeacher === -1) {
      for (let i = headerRowIdx + 1; i < Math.min(rows.length, headerRowIdx + 15); i++) {
        const r = rows[i] || [];
        for (let c = 0; c < r.length; c++) {
          const val = String(r[c] || '').trim();
          if (/^(นาย|นาง|นางสาว|น\.?ส\.?|ว่าที่\s*ร\.?ต\.?|ดร\.)\s*[ก-๙]/i.test(val)) {
            colTeacher = c;
            break;
          }
        }
        if (colTeacher !== -1) break;
      }
      if (colTeacher === -1) colTeacher = 2; // fallback column C
    }

    if (colDay === -1) {
      for (let i = headerRowIdx + 1; i < Math.min(rows.length, headerRowIdx + 15); i++) {
        const r = rows[i] || [];
        for (let c = 0; c < r.length; c++) {
          const val = String(r[c] || '').trim();
          if (/จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์/.test(val)) {
            colDay = c;
            break;
          }
        }
        if (colDay !== -1) break;
      }
      if (colDay === -1) colDay = 1; // fallback column B
    }

    if (periodCols.length === 0) {
      periodCols = [3, 4, 5, 6, 7, 8, 9];
    }

    const detectedTeachers = [];
    const teacherMap = {};
    const parsedTimetables = {
      "จันทร์": {},
      "อังคาร": {},
      "พุธ": {},
      "พฤหัสบดี": {},
      "ศุกร์": {}
    };
    const teacherSubjects = {};
    let totalSlotsCount = 0;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const rawTeacher = String(r[colTeacher] || '').trim();
      if (!rawTeacher || /^(รายชื่อครู|ครู|ลำดับ|ที่|No\.?)$/i.test(rawTeacher) || /^\d+$/.test(rawTeacher)) {
        continue;
      }

      // Normalize multiple spaces in teacher name so matches across days are 100% exact
      const teacherName = rawTeacher.replace(/\s+/g, ' ').trim();
      if (!teacherMap[teacherName]) {
        teacherMap[teacherName] = true;
        detectedTeachers.push(teacherName);
        teacherSubjects[teacherName] = [];
      }

      const rawDay = String(r[colDay] || '').trim();
      let dayKey = "";
      if (rawDay.includes("จันทร์")) dayKey = "จันทร์";
      else if (rawDay.includes("อังคาร")) dayKey = "อังคาร";
      else if (rawDay.includes("พุธ")) dayKey = "พุธ";
      else if (rawDay.includes("พฤหัส")) dayKey = "พฤหัสบดี";
      else if (rawDay.includes("ศุกร์")) dayKey = "ศุกร์";

      if (!dayKey) {
        dayKey = selectedDay || "จันทร์";
      }

      const periods = [];
      for (let p = 0; p < 7; p++) {
        const colIdx = periodCols[p] !== undefined ? periodCols[p] : (colTeacher + 1 + p);
        const cellVal = String(r[colIdx] || '').trim();
        if (/พักกลางวัน/i.test(cellVal) || /^\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}$/.test(cellVal)) {
          periods.push("");
        } else {
          periods.push(cellVal);
          if (cellVal) {
            teacherSubjects[teacherName].push(cellVal);
            totalSlotsCount++;
          }
        }
      }

      parsedTimetables[dayKey][teacherName] = periods;
    }

    const analyzedGrades = {};
    const gradeCounts = { "ป.1-3": 0, "ป.4-6": 0, "ม.1-3": 0, "ม.4-6": 0 };

    detectedTeachers.forEach(tName => {
      const subs = teacherSubjects[tName] || [];
      const grade = analyzeGradeBandFromSubjects(subs, activeTeacherGrades[tName] || "ป.1-3");
      analyzedGrades[tName] = grade;
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });

    return {
      teachers: detectedTeachers,
      timetables: parsedTimetables,
      grades: analyzedGrades,
      gradeCounts: gradeCounts,
      teacherSubjects: teacherSubjects,
      totalSlots: totalSlotsCount
    };
  }

  async function processExcelTimetable(file, container) {
    if (!file) return;

    if (global.TeachApp && global.TeachApp.showToast) {
      global.TeachApp.showToast(`กำลังอ่านและวิเคราะห์ไฟล์ "${file.name}"...`, "info");
    }

    try {
      let rows = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        rows = parseCsvToRows(text);
      } else {
        if (typeof XLSX === 'undefined') {
          throw new Error("ระบบกำลังโหลดไลบรารี Excel กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
        }
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        const thaiDays = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
        const daySheetNames = workbook.SheetNames.filter(name => 
          thaiDays.some(d => name.includes(d) || (d === "พฤหัสบดี" && name.includes("พฤหัส")))
        );

        if (daySheetNames.length >= 2) {
          rows = [];
          daySheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            let matchedDay = "จันทร์";
            if (sheetName.includes("จันทร์")) matchedDay = "จันทร์";
            else if (sheetName.includes("อังคาร")) matchedDay = "อังคาร";
            else if (sheetName.includes("พุธ")) matchedDay = "พุธ";
            else if (sheetName.includes("พฤหัส")) matchedDay = "พฤหัสบดี";
            else if (sheetName.includes("ศุกร์")) matchedDay = "ศุกร์";

            rawRows.forEach((r, idx) => {
              if (idx === 0) {
                if (rows.length === 0) rows.push(["ลำดับ", "วัน", "รายชื่อครู", "คาบ 1", "คาบ 2", "คาบ 3", "คาบ 4", "คาบ 5", "คาบ 6", "คาบ 7"]);
              } else {
                if (r && r.some(cell => String(cell).trim())) {
                  rows.push([r[0] || "", matchedDay, r[1] || r[2] || "", ...(r.slice(2, 9))]);
                }
              }
            });
          });
        } else {
          const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'data' || n.includes('ตาราง')) || workbook.SheetNames[0];
          const sheet = workbook.Sheets[targetSheetName];
          rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        }
      }

      if (!rows || rows.length < 2) {
        throw new Error("ไม่พบข้อมูลตารางสอนในไฟล์นี้");
      }

      const analysisResult = analyzeScheduleRows(rows);
      if (analysisResult.teachers.length === 0) {
        throw new Error("ไม่สามารถค้นหารายชื่อครูจากไฟล์นี้ได้ กรุณาตรวจสอบว่ามีคอลัมน์ 'รายชื่อครู' หรือ 'ครู'");
      }

      showUploadAnalysisModal(analysisResult, file.name, container);

    } catch (err) {
      console.error("Excel parse error:", err);
      if (global.TeachApp && global.TeachApp.showToast) {
        global.TeachApp.showToast("เกิดข้อผิดพลาดในการอ่านไฟล์: " + err.message, "error");
      } else {
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: " + err.message);
      }
    }
  }

  function showUploadAnalysisModal(analysisResult, fileName, container) {
    let existingModal = document.getElementById('excel-analysis-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div id="excel-analysis-modal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div class="glass-card bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          
          <!-- Modal Header -->
          <div class="px-6 py-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-100 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-xs shadow-emerald-500/30">
                <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
              </span>
              <div>
                <h3 class="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>วิเคราะห์ตารางสอนจากไฟล์ Excel สำเร็จ</span>
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    วิเคราะห์อัตโนมัติ
                  </span>
                </h3>
                <p class="text-xs text-slate-500">ไฟล์: <span class="font-bold text-emerald-800">${fileName}</span> • ระบบวิเคราะห์วิชาสอนและจำแนกช่วงชั้นครูแต่ละท่านให้อัตโนมัติ</p>
              </div>
            </div>

            <button id="btn-close-analysis-modal" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Modal Stats Row -->
          <div class="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <i data-lucide="users" class="w-3.5 h-3.5 text-indigo-500"></i>
                <span>ตรวจพบคุณครู</span>
              </div>
              <div class="text-lg font-black text-slate-800 mt-1">${analysisResult.teachers.length} <span class="text-xs font-normal text-slate-500">ท่าน</span></div>
            </div>

            <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-500"></i>
                <span>ตารางสอน</span>
              </div>
              <div class="text-lg font-black text-slate-800 mt-1">5 <span class="text-xs font-normal text-slate-500">วัน (จันทร์-ศุกร์)</span></div>
            </div>

            <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <i data-lucide="book-open" class="w-3.5 h-3.5 text-blue-500"></i>
                <span>คาบเรียนที่อ่านได้</span>
              </div>
              <div class="text-lg font-black text-slate-800 mt-1">${analysisResult.totalSlots} <span class="text-xs font-normal text-slate-500">คาบ</span></div>
            </div>

            <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <i data-lucide="palette" class="w-3.5 h-3.5 text-amber-500"></i>
                <span>ช่วงชั้นที่จำแนกได้</span>
              </div>
              <div class="text-xs font-bold text-slate-700 mt-1 space-y-0.5">
                <span class="text-emerald-700 font-bold">ป.1-3 (${analysisResult.gradeCounts['ป.1-3'] || 0})</span> • 
                <span class="text-rose-700 font-bold">ป.4-6 (${analysisResult.gradeCounts['ป.4-6'] || 0})</span><br/>
                <span class="text-sky-700 font-bold">ม.1-3 (${analysisResult.gradeCounts['ม.1-3'] || 0})</span>
              </div>
            </div>
          </div>

          <!-- Modal Body Table Preview -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 sheet-scroll">
            <div class="text-xs font-bold text-slate-600 mb-2 flex items-center justify-between">
              <span>รายชื่อครูและช่วงชั้นที่ระบบวิเคราะห์ (สามารถตรวจสอบหรือปรับเปลี่ยนได้):</span>
              <span class="text-[11px] text-slate-400 font-normal">เรียงตามลำดับในไฟล์ Excel</span>
            </div>

            <div class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <table class="w-full text-xs">
                <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th class="py-2.5 px-3 text-center w-12">ลำดับ</th>
                    <th class="py-2.5 px-4 text-left w-64">ชื่อ-นามสกุลคุณครู</th>
                    <th class="py-2.5 px-4 text-left w-48">ช่วงชั้น (วิเคราะห์อัตโนมัติ)</th>
                    <th class="py-2.5 px-4 text-left">ตัวอย่างวิชาที่สอนจากตาราง</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${analysisResult.teachers.map((teacherName, idx) => {
                    const grade = analysisResult.grades[teacherName] || 'ป.1-3';
                    const subs = analysisResult.teacherSubjects[teacherName] || [];
                    const uniqueSubs = [...new Set(subs)].slice(0, 4);

                    return `
                      <tr class="hover:bg-slate-50/80 transition-colors">
                        <td class="text-center font-bold text-slate-500 py-2.5 px-3">${idx + 1}</td>
                        <td class="py-2.5 px-4 font-bold text-slate-800">${teacherName}</td>
                        <td class="py-2.5 px-4">
                          <select class="modal-grade-select px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                            data-teacher="${teacherName}">
                            ${(GRADE_BANDS || []).map(b => `
                              <option value="${b.key}" ${b.key === grade ? 'selected' : ''}>${b.key} (${b.colorName})</option>
                            `).join('')}
                          </select>
                        </td>
                        <td class="py-2.5 px-4">
                          <div class="flex flex-wrap gap-1">
                            ${uniqueSubs.length > 0 ? uniqueSubs.map(s => `
                              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                ${s}
                              </span>
                            `).join('') : '<span class="text-slate-400 italic">- ไม่พบวิชาสอน -</span>'}
                            ${subs.length > 4 ? `<span class="text-[10px] text-slate-400 font-bold self-center">+${subs.length - 4}</span>` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button id="btn-cancel-analysis" type="button"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">
              ยกเลิก
            </button>

            <button id="btn-confirm-apply-excel" type="button"
              class="btn-press hover-lift-sm px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>นำเข้าข้อมูลสู่ตารางและบันทึก (${analysisResult.teachers.length} ท่าน)</span>
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) window.lucide.createIcons();

    const modalEl = document.getElementById('excel-analysis-modal');
    const closeModal = () => modalEl && modalEl.remove();

    document.getElementById('btn-close-analysis-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-analysis').addEventListener('click', closeModal);

    document.getElementById('btn-confirm-apply-excel').addEventListener('click', async () => {
      const confirmBtn = document.getElementById('btn-confirm-apply-excel');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังนำเข้าและบันทึก...</span>`;
      if (window.lucide) window.lucide.createIcons();

      try {
        modalEl.querySelectorAll('.modal-grade-select').forEach(sel => {
          const tName = sel.dataset.teacher;
          if (tName) {
            analysisResult.grades[tName] = sel.value;
          }
        });

        activeTeachers = [...analysisResult.teachers];
        activeTeacherGrades = { ...analysisResult.grades };

        const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
        days.forEach(day => {
          activeTimetables[day] = activeTeachers.map(tName => {
            return (analysisResult.timetables[day] && analysisResult.timetables[day][tName]) || ["", "", "", "", "", "", ""];
          });
        });

        await saveTeachers(activeTeachers);
        if (saveTeacherGrades) {
          await saveTeacherGrades(activeTeacherGrades);
        }
        if (saveAllTimetables) {
          await saveAllTimetables(activeTimetables, activeTeachers);
        } else {
          await saveDayTimetable(selectedDay, activeTimetables[selectedDay], activeTeachers);
        }

        closeModal();
        renderSpreadsheetTab(container);

        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast(`นำเข้าตารางสอนครู ${activeTeachers.length} ท่านและบันทึกสำเร็จ!`, "success");
        }
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>นำเข้าข้อมูลสู่ตารางและบันทึก</span>`;
        if (window.lucide) window.lucide.createIcons();
        alert("เกิดข้อผิดพลาดในการนำเข้าข้อมูล: " + err.message);
      }
    });
  }

  function renderSpreadsheetTab(container) {
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const currentDayGrid = activeTimetables[selectedDay] || [];
    const currentDayConfig = (THAI_DAY_CONFIG && THAI_DAY_CONFIG[selectedDay]) || {
      name: `วัน${selectedDay}`,
      colorName: "",
      dotClass: "bg-indigo-500",
      badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300"
    };

    container.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-4">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div class="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70 shadow-2xs">
            <span class="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>เลือกวัน:</span>
            </span>
            ${days.map(day => {
              const cfg = (THAI_DAY_CONFIG && THAI_DAY_CONFIG[day]) || {
                colorName: '',
                activeClass: 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black',
                inactiveClass: 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent',
                dotClass: 'bg-indigo-500'
              };
              const isSelected = selectedDay === day;
              return `
                <button class="sheet-day-btn btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border ${isSelected ? cfg.activeClass : cfg.inactiveClass}"
                  data-day="${day}"
                  title="ตารางสอนวัน${day} (สี${cfg.colorName})">
                  <span class="w-2.5 h-2.5 rounded-full ${cfg.dotClass} ${isSelected ? 'ring-2 ring-white/90 shadow-2xs' : ''}"></span>
                  <span>วัน${day}</span>
                </button>
              `;
            }).join('')}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-add-teacher-row" 
              class="btn-press hover-lift-sm px-3 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
              เพิ่มคุณครู
            </button>

            <!-- 1. ปุ่มดาวน์โหลด Excel -->
            <button id="btn-export-excel" 
              class="btn-press hover-lift-sm px-3.5 py-2 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="ดาวน์โหลดตารางสอน Excel เพื่อแก้ไขตารางแล้วนำกลับมาอัปโหลด">
              <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
              <span>ดาวน์โหลด Excel</span>
            </button>

            <!-- 2. ปุ่มอัปโหลด Excel (แทนที่บันทึกเดิมตามที่ขอ) -->
            <button id="btn-upload-excel" 
              class="btn-press hover-lift-sm px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="อัปโหลดไฟล์ Excel (.xlsx) เพื่อวิเคราะห์รายชื่อครูและวิชาสอนเข้าสู่ตารางอัตโนมัติ">
              <i data-lucide="upload" class="w-4 h-4"></i>
              <span>อัปโหลด Excel</span>
            </button>
            <input type="file" id="input-upload-excel" accept=".xlsx, .xls" class="hidden" />

            <!-- 2. ปุ่มบันทึกข้อมูล (แทนที่ส่งข้อมูลเดิมตามที่ขอ) -->
            <button id="btn-save-all-data" 
              class="btn-press hover-lift-sm px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="บันทึกข้อมูลตารางสอน รายชื่อครู และช่วงชั้นทั้งหมดลงระบบและคลาวด์ Firebase">
              <i data-lucide="save" class="w-4 h-4"></i>
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </div>

        <!-- Combined Single-Row Grade Band Filter (รวมในบรรทัดเดียว ไม่เปลืองพื้นที่) -->
        <div class="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/60">
          <span class="text-xs font-bold text-slate-600 flex items-center gap-1 px-1.5">
            <i data-lucide="palette" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>กรองช่วงชั้น:</span>
          </span>

          <button type="button" 
            class="sheet-grade-filter-btn btn-press px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${sheetFilterGrade === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}" 
            data-grade="ALL">
            ทั้งหมด (${activeTeachers.length})
          </button>

          ${(GRADE_BANDS || []).map(b => {
            const count = activeTeachers.filter(t => (activeTeacherGrades[t] || 'ป.1-3') === b.key).length;
            const isSelected = sheetFilterGrade === b.key;
            return `
              <button type="button" 
                class="sheet-grade-filter-btn btn-press inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${b.badgeClass} ${isSelected ? 'ring-2 ring-indigo-500/40 shadow-xs scale-105 font-black' : 'opacity-85 hover:opacity-100 shadow-2xs'}" 
                data-grade="${b.key}"
                title="คลิกเพื่อกรองดูเฉพาะ ${b.key}">
                <span class="w-2 h-2 rounded-full ${b.dotClass}"></span>
                <span>${b.key}</span>
                <span class="px-1.5 py-0.2 rounded-full bg-white/90 text-[11px] font-black">${count}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-800 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
          <div class="flex items-center gap-2">
            <i data-lucide="info" class="w-4 h-4 text-indigo-600 shrink-0"></i>
            <span>กำลังแสดงตารางสอน<strong>วัน${selectedDay}</strong> — สามารถแก้ไขในช่องตาราง หรือกดปุ่ม <strong>"อัปโหลด Excel"</strong> เพื่อวิเคราะห์ไฟล์ แล้วกด <strong>"บันทึกข้อมูล"</strong></span>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${currentDayConfig.badgeClass} self-start sm:self-auto shadow-2xs">
            <span class="w-2 h-2 rounded-full ${currentDayConfig.dotClass}"></span>
            <span>วัน${selectedDay} (${currentDayConfig.colorName})</span>
          </span>
        </div>

        <div class="sheet-scroll overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
          <table class="sheet-table w-full text-xs">
            <thead class="bg-slate-100 text-slate-700 font-bold shadow-xs">
              <tr>
                <th class="py-2.5 px-2 text-center w-12">ลำดับ</th>
                <th class="py-2.5 px-4 text-left w-64">รายชื่อคุณครู</th>
                ${activePeriods.map(p => `
                  <th class="py-2.5 px-2 text-center w-36 ${p.isBreak ? 'bg-amber-100/60 text-amber-900' : ''}">
                    <div>${p.name}</div>
                    <div class="text-[10px] font-normal text-slate-500">${p.time}</div>
                  </th>
                `).join('')}
                <th class="py-2.5 px-2 text-center w-12">ลบ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200/60">
              ${activeTeachers.map((teacherName, tIdx) => {
                const grade = activeTeacherGrades[teacherName] || 'ป.1-3';
                if (sheetFilterGrade !== 'ALL' && grade !== sheetFilterGrade) return '';

                const band = (GRADE_BANDS || []).find(b => b.key === grade) || (GRADE_BANDS && GRADE_BANDS[0]) || { 
                  key: 'ป.1-3', label: 'ป.1-3 (เขียวพาสเทล)', badgeClass: 'bg-emerald-200/90 text-emerald-950 border-emerald-300', 
                  dotClass: 'bg-emerald-500', borderClass: 'border-l-emerald-500', cellBg: 'bg-emerald-50', rowHover: 'hover:bg-emerald-100/80', textClass: 'text-emerald-950' 
                };
                const teacherRow = currentDayGrid[tIdx] || ["", "", "", "", "", "", ""];

                return `
                  <tr class="${band.cellBg} ${band.rowHover} transition-colors border-l-4 ${band.borderClass}">
                    <td class="text-center font-bold ${band.textClass} py-2 px-2.5 ${band.cellBg}">
                      ${tIdx + 1}
                    </td>
                    <td class="px-2.5 py-1 font-semibold text-slate-800 ${band.cellBg}">
                      <div class="flex items-center gap-1.5">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border ${band.badgeClass} shrink-0 select-none shadow-2xs" title="ช่วงชั้น: ${band.label}">
                          ${band.key}
                        </span>
                        <input type="text" value="${teacherName}" 
                          class="teacher-name-input sheet-cell-input font-bold text-slate-800 bg-transparent hover:bg-white/40 focus:bg-white transition-all"
                          data-index="${tIdx}" data-oldname="${teacherName}">
                      </div>
                    </td>
                    ${activePeriods.map((period, pIdx) => {
                      const val = teacherRow[pIdx] || "";
                      return `
                        <td class="p-0 ${period.isBreak ? 'bg-amber-100/50' : band.cellBg}">
                          <input type="text" value="${val}" 
                            placeholder="${period.isBreak ? 'พักกลางวัน' : '-'}" 
                            class="grid-cell-input sheet-cell-input text-center text-slate-800 font-semibold bg-transparent hover:bg-white/40 focus:bg-white transition-all"
                            data-tindex="${tIdx}" data-pindex="${pIdx}">
                        </td>
                      `;
                    }).join('')}
                    <td class="text-center p-1 ${band.cellBg}">
                      <button class="btn-delete-teacher-row text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        data-index="${tIdx}" title="ลบคุณครูแถวนี้">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;

    container.querySelectorAll('.sheet-day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedDay = e.currentTarget.dataset.day;
        renderSpreadsheetTab(container);
      });
    });

    container.querySelectorAll('.sheet-grade-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sheetFilterGrade = e.currentTarget.dataset.grade;
        renderSpreadsheetTab(container);
      });
    });

    container.querySelectorAll('.grid-cell-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const tIdx = parseInt(e.target.dataset.tindex);
        const pIdx = parseInt(e.target.dataset.pindex);
        if (!activeTimetables[selectedDay]) activeTimetables[selectedDay] = [];
        if (!activeTimetables[selectedDay][tIdx]) activeTimetables[selectedDay][tIdx] = ["", "", "", "", "", "", ""];
        activeTimetables[selectedDay][tIdx][pIdx] = e.target.value;
      });
    });

    container.querySelectorAll('.teacher-name-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const oldName = e.target.dataset.oldname || activeTeachers[idx];
        const newName = e.target.value.trim();
        if (newName && newName !== oldName) {
          activeTeacherGrades[newName] = activeTeacherGrades[oldName] || "ป.1-3";
          delete activeTeacherGrades[oldName];
          activeTeachers[idx] = newName;
          e.target.dataset.oldname = newName;
        }
      });
    });

    document.getElementById('btn-add-teacher-row').addEventListener('click', () => {
      const newName = prompt("กรุณาระบุชื่อ-นามสกุลของคุณครูท่านใหม่:");
      if (newName && newName.trim()) {
        const trimmed = newName.trim();
        activeTeachers.push(trimmed);
        activeTeacherGrades[trimmed] = sheetFilterGrade !== 'ALL' ? sheetFilterGrade : 'ป.1-3';
        const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
        daysList.forEach(d => {
          if (!activeTimetables[d]) activeTimetables[d] = [];
          activeTimetables[d].push(["", "", "", "", "", "", ""]);
        });
        renderSpreadsheetTab(container);
      }
    });

    container.querySelectorAll('.btn-delete-teacher-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const name = activeTeachers[idx];
        if (confirm(`ต้องการลบคุณครู "${name}" ออกจากระบบใช่หรือไม่?`)) {
          delete activeTeacherGrades[name];
          activeTeachers.splice(idx, 1);
          const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          daysList.forEach(d => {
            if (activeTimetables[d]) activeTimetables[d].splice(idx, 1);
          });
          renderSpreadsheetTab(container);
        }
      });
    });

    // 1. Upload Excel / CSV Handler
    const btnUploadExcel = document.getElementById('btn-upload-excel');
    const inputUploadExcel = document.getElementById('input-upload-excel');
    if (btnUploadExcel && inputUploadExcel) {
      btnUploadExcel.addEventListener('click', () => {
        inputUploadExcel.value = '';
        inputUploadExcel.click();
      });

      inputUploadExcel.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await processExcelTimetable(file, container);
        }
      });
    }

    // 2. Save All Data Handler (เปลี่ยนจากส่งข้อมูลขึ้น Firebase เดิม)
    const btnSaveAllData = document.getElementById('btn-save-all-data');
    if (btnSaveAllData) {
      btnSaveAllData.addEventListener('click', async () => {
        // Collect latest cell inputs from table before saving
        container.querySelectorAll('.grid-cell-input').forEach(input => {
          const tIdx = parseInt(input.dataset.tindex);
          const pIdx = parseInt(input.dataset.pindex);
          if (!isNaN(tIdx) && !isNaN(pIdx)) {
            if (!activeTimetables[selectedDay]) activeTimetables[selectedDay] = [];
            if (!activeTimetables[selectedDay][tIdx]) activeTimetables[selectedDay][tIdx] = ["", "", "", "", "", "", ""];
            activeTimetables[selectedDay][tIdx][pIdx] = input.value;
          }
        });

        btnSaveAllData.disabled = true;
        btnSaveAllData.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังบันทึกข้อมูล...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
          await saveTeachers(activeTeachers);
          if (saveTeacherGrades) {
            await saveTeacherGrades(activeTeacherGrades);
          }
          if (saveAllTimetables) {
            await saveAllTimetables(activeTimetables, activeTeachers);
          } else {
            await saveDayTimetable(selectedDay, activeTimetables[selectedDay], activeTeachers);
          }
          
          btnSaveAllData.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกสำเร็จ!</span>`;
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("บันทึกข้อมูลตารางสอน รายชื่อครู และช่วงชั้นเรียบร้อยแล้ว", "success");
          }

          setTimeout(() => {
            btnSaveAllData.disabled = false;
            btnSaveAllData.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>บันทึกข้อมูล</span>`;
            if (window.lucide) window.lucide.createIcons();
          }, 2400);
        } catch (e) {
          btnSaveAllData.disabled = false;
          btnSaveAllData.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>บันทึกข้อมูล</span>`;
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("เกิดข้อผิดพลาดในการบันทึก: " + e.message, "error");
          }
        }
      });
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => {
        exportCurrentTimetableToExcel();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  async function exportCurrentTimetableToExcel() {
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const schoolName = activeSettings.schoolName || 'โรงเรียนชุมชนบ้านวังพิกุล';
    const fileName = `ตารางสอน_${schoolName}.xlsx`;

    // 1. ตรวจสอบว่ามีไลบรารี ExcelJS เพื่อสร้างไฟล์ .xlsx พร้อมฟอนต์ TH SarabunPSK ขนาด 14 และหัวข้อตัวหนา
    if (typeof ExcelJS !== 'undefined') {
      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = schoolName;
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('ตารางสอน', {
          views: [{ showGridLines: true }]
        });

        // กำหนดคอลัมน์และหัวข้อ (แถวที่ 1: เฉพาะหัวข้อคาบ ไม่ใส่เวลา และหัวข้อคาบ 4 มี (พักกลางวัน))
        worksheet.columns = [
          { header: 'ลำดับ', key: 'num', width: 8 },
          { header: 'วัน', key: 'day', width: 12 },
          { header: 'รายชื่อครู', key: 'teacher', width: 28 },
          { header: 'คาบ 1', key: 'p1', width: 16 },
          { header: 'คาบ 2', key: 'p2', width: 16 },
          { header: 'คาบ 3', key: 'p3', width: 16 },
          { header: 'คาบ 4 (พักกลางวัน)', key: 'p4', width: 20 },
          { header: 'คาบ 5', key: 'p5', width: 16 },
          { header: 'คาบ 6', key: 'p6', width: 16 },
          { header: 'คาบ 7', key: 'p7', width: 16 }
        ];

        // แถวหัวข้อ: ฟอนต์ TH SarabunPSK ขนาด 14 ตัวหนา
        const headerRow = worksheet.getRow(1);
        headerRow.height = 26;
        headerRow.font = { name: 'TH SarabunPSK', size: 14, bold: true, color: { argb: 'FF000000' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };

        const thinBorder = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        headerRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = thinBorder;
        });

        // แถวข้อมูล: เริ่มแถวที่ 2 ทันที (ไม่มีแถวเวลาคาบ และช่องพักกลางวันเว้นว่างเป็นช่องว่าง)
        let rowNum = 1;
        days.forEach(day => {
          const grid = activeTimetables[day] || [];
          activeTeachers.forEach((teacherName, idx) => {
            const schedule = grid[idx] || ["", "", "", "", "", "", ""];
            const p4Val = (schedule[3] && !schedule[3].includes("พัก")) ? schedule[3] : "";
            const row = worksheet.addRow({
              num: rowNum++,
              day: day,
              teacher: teacherName,
              p1: schedule[0] || "",
              p2: schedule[1] || "",
              p3: schedule[2] || "",
              p4: p4Val, // ช่องว่าง ไม่มีคำว่าพักกลางวัน
              p5: schedule[4] || "",
              p6: schedule[5] || "",
              p7: schedule[6] || ""
            });

            row.height = 22;
            row.font = { name: 'TH SarabunPSK', size: 14, bold: false };

            row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
            row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
            row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
            for (let c = 4; c <= 10; c++) {
              row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
            }

            const dataBorder = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.border = dataBorder;
            });
          });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("ดาวน์โหลดไฟล์ตารางสอน Excel สำเร็จ", "success");
        }
        return;
      } catch (err) {
        console.warn("ExcelJS error, fallback to SheetJS:", err);
      }
    }

    // 2. Fallback: SheetJS (แผ่นเดียว รวมทุกวัน ไม่มีแถวเวลา และพักกลางวันเป็นช่องว่าง)
    if (typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new();
      const allRows = [
        ["ลำดับ", "วัน", "รายชื่อครู", "คาบ 1", "คาบ 2", "คาบ 3", "คาบ 4 (พักกลางวัน)", "คาบ 5", "คาบ 6", "คาบ 7"]
      ];

      let rowNum = 1;
      days.forEach(day => {
        const grid = activeTimetables[day] || [];
        activeTeachers.forEach((teacherName, idx) => {
          const schedule = grid[idx] || ["", "", "", "", "", "", ""];
          const p4Val = (schedule[3] && !schedule[3].includes("พัก")) ? schedule[3] : "";
          allRows.push([
            rowNum++,
            day,
            teacherName,
            schedule[0] || "",
            schedule[1] || "",
            schedule[2] || "",
            p4Val, // ช่องว่าง ไม่มีคำว่าพักกลางวัน
            schedule[4] || "",
            schedule[5] || "",
            schedule[6] || ""
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(allRows);
      ws['!cols'] = [
        { wch: 8 },  // ลำดับ
        { wch: 12 }, // วัน
        { wch: 28 }, // รายชื่อครู
        { wch: 16 }, // คาบ 1
        { wch: 16 }, // คาบ 2
        { wch: 16 }, // คาบ 3
        { wch: 20 }, // คาบ 4 (พักกลางวัน)
        { wch: 16 }, // คาบ 5
        { wch: 16 }, // คาบ 6
        { wch: 16 }  // คาบ 7
      ];
      XLSX.utils.book_append_sheet(wb, ws, "ตารางสอน");
      XLSX.writeFile(wb, fileName);

      if (global.TeachApp && global.TeachApp.showToast) {
        global.TeachApp.showToast("ดาวน์โหลดไฟล์ตารางสอน Excel สำเร็จ", "success");
      }
    }
  }

  function renderPeriodsTab(container) {
    function syncInputsToActivePeriods() {
      container.querySelectorAll('.period-name-input').forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (!isNaN(idx) && activePeriods[idx]) {
          activePeriods[idx].name = input.value;
        }
      });
      container.querySelectorAll('.period-time-input').forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (!isNaN(idx) && activePeriods[idx]) {
          activePeriods[idx].time = input.value;
        }
      });
    }

    const searchLower = teacherSearchQuery.trim().toLowerCase();
    const visibleTeachers = activeTeachers
      .map((name, origIdx) => ({ name, origIdx }))
      .filter(item => {
        if (searchLower && !item.name.toLowerCase().includes(searchLower)) return false;
        if (teacherFilterGrade !== 'ALL') {
          const g = activeTeacherGrades[item.name] || 'ป.1-3';
          if (g !== teacherFilterGrade) return false;
        }
        return true;
      });

    container.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-6 w-full">
        
        <!-- Header & Top Save Button -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>ตั้งค่าคาบเรียนและเวลา</span>
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                7 คาบเรียน (แถวเดียว)
              </span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">กำหนดชื่อคาบ ช่วงเวลา และระบุคาบพักกลางวันสำหรับแสดงผลในเอกสารและตารางสอน</p>
          </div>
          <button type="button" 
            class="btn-save-periods-action btn-press hover-lift-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>

        <!-- Single-row Grid Cards (7 คาบในแถวเดียวกัน) -->
        <div class="overflow-x-auto pb-3 sheet-scroll -mx-1 px-1">
          <div class="grid gap-2.5 sm:gap-3 min-w-[920px] 2xl:min-w-0" style="grid-template-columns: repeat(${activePeriods.length}, minmax(0, 1fr));">
            ${activePeriods.map((p, idx) => `
              <div class="glass-card-subtle hover-lift-sm rounded-2xl p-3 border transition-all flex flex-col justify-between gap-3 shadow-2xs ${p.isBreak ? 'border-amber-300/90 bg-amber-50/50 ring-1 ring-amber-300/40' : 'border-slate-200/90 bg-white/95'}">
                
                <!-- Card Top: Badge, Name & Break Checkbox -->
                <div class="flex items-center justify-between pb-2 border-b ${p.isBreak ? 'border-amber-200/70' : 'border-slate-100'}">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center text-white shadow-2xs shrink-0 ${p.isBreak ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/25' : 'bg-gradient-to-tr from-indigo-500 to-blue-600 shadow-indigo-500/25'}">
                      ${p.id}
                    </span>
                    <span class="text-xs font-bold truncate ${p.isBreak ? 'text-amber-900' : 'text-slate-800'}" title="${p.name || `คาบ ${p.id}`}">
                      ${p.name || `คาบ ${p.id}`}
                    </span>
                  </div>

                  <label class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all shrink-0 select-none ${p.isBreak ? 'bg-amber-200 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" title="ติ๊กเพื่อกำหนดให้เป็นคาบพักกลางวัน">
                    <input type="checkbox" ${p.isBreak ? 'checked' : ''} class="period-break-check rounded text-amber-600 focus:ring-amber-500 w-3 h-3 cursor-pointer" data-index="${idx}">
                    <span>${p.isBreak ? '🍽️ พัก' : 'พัก'}</span>
                  </label>
                </div>

                <!-- Inputs -->
                <div class="space-y-2">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">ชื่อคาบ:</label>
                    <input type="text" value="${p.name}" placeholder="เช่น คาบ 1" 
                      class="period-name-input w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                      data-index="${idx}">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-1">ช่วงเวลา:</label>
                    <input type="text" value="${p.time}" placeholder="08.30 - 09.30" 
                      class="period-time-input w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-slate-700 text-center outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs tracking-tight"
                      data-index="${idx}">
                  </div>
                </div>

                <!-- Status Pill -->
                <div class="pt-1 text-center">
                  ${p.isBreak ? `
                    <span class="inline-block w-full py-0.5 rounded text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-200/70">
                      🍽️ คาบพักกลางวัน
                    </span>
                  ` : `
                    <span class="inline-block w-full py-0.5 rounded text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100">
                      คาบเรียนปกติ
                    </span>
                  `}
                </div>

              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section: ตารางรายชื่อคุณครูและกำหนดช่วงชั้น -->
        <div class="border-t border-slate-200/80 pt-6 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span class="p-1.5 rounded-xl bg-indigo-50 text-indigo-700">
                  <i data-lucide="users" class="w-4 h-4"></i>
                </span>
                <span>รายชื่อคุณครูและการกำหนดช่วงชั้น</span>
                <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  ${activeTeachers.length} ท่าน
                </span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                กำหนดช่วงชั้น (ป.1-3, ป.4-6, ม.1-3, ม.4-6) เพื่อเติมแถบสีแยกกลุ่มในหน้า <strong>ตารางสอน</strong> อัตโนมัติ
              </p>
            </div>

            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>บันทึกอัตโนมัติ Real-time</span>
              </span>
              <button type="button" id="btn-add-teacher-periods-tab"
                class="btn-press hover-lift-sm px-3.5 py-2 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                <span>เพิ่มคุณครู</span>
              </button>
            </div>
          </div>

          <!-- Filter & Search Controls (รวมเป็นบรรทัดเดียว กระชับ ไม่เปลืองบรรทัด) -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-bold text-slate-500 pl-1 mr-0.5">กรอง:</span>
              <button type="button" class="teacher-grade-filter-btn px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${teacherFilterGrade === 'ALL' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}" data-grade="ALL">
                ทั้งหมด (${activeTeachers.length})
              </button>
              ${(GRADE_BANDS || []).map(b => {
                const count = activeTeachers.filter(t => (activeTeacherGrades[t] || 'ป.1-3') === b.key).length;
                const isActive = teacherFilterGrade === b.key;
                return `
                  <button type="button" 
                    class="teacher-grade-filter-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${b.badgeClass} ${isActive ? 'ring-2 ring-indigo-500/40 shadow-xs scale-105 font-black' : 'opacity-85 hover:opacity-100 shadow-2xs'}" 
                    data-grade="${b.key}">
                    <span class="w-2 h-2 rounded-full ${b.dotClass}"></span>
                    <span>${b.key}</span>
                    <span class="px-1.5 py-0.2 rounded-full bg-white/90 text-[11px] font-black">${count}</span>
                  </button>
                `;
              }).join('')}
            </div>

            <div class="relative w-full sm:w-64">
              <i data-lucide="search" class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" id="teacher-search-input" value="${teacherSearchQuery}" placeholder="ค้นหาชื่อคุณครู..."
                class="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs">
            </div>
          </div>

          <!-- Teachers Table -->
          <div class="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs sheet-scroll">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200/80">
                <tr>
                  <th class="py-2.5 px-3 text-center w-14">ลำดับ</th>
                  <th class="py-2.5 px-4">ชื่อ-นามสกุลคุณครู</th>
                  <th class="py-2.5 px-4 w-80">ช่วงชั้นที่สอน (คลิกเลือก)</th>
                  <th class="py-2.5 px-4 w-44 text-center">ตัวอย่างสีในตารางสอน</th>
                  <th class="py-2.5 px-3 text-center w-16">ลบ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${visibleTeachers.length === 0 ? `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                      ไม่พบข้อมูลคุณครูที่ตรงกับเงื่อนไขค้นหา
                    </td>
                  </tr>
                ` : visibleTeachers.map((item) => {
                  const { name: teacherName, origIdx } = item;
                  const grade = activeTeacherGrades[teacherName] || 'ป.1-3';
                  const band = (GRADE_BANDS || []).find(b => b.key === grade) || (GRADE_BANDS && GRADE_BANDS[0]) || { 
                    key: 'ป.1-3', label: 'ป.1-3 (เขียวพาสเทล)', badgeClass: 'bg-emerald-200/90 text-emerald-950 border-emerald-300', 
                    dotClass: 'bg-emerald-500', borderClass: 'border-l-emerald-500', cellBg: 'bg-emerald-50', rowHover: 'hover:bg-emerald-100/80', textClass: 'text-emerald-950' 
                  };

                  return `
                    <tr class="${band.cellBg}/70 ${band.rowHover} transition-all ${band.borderClass} border-l-4">
                      <td class="text-center font-bold ${band.textClass} py-2.5 px-3">
                        ${origIdx + 1}
                      </td>
                      <td class="py-2.5 px-4 font-semibold text-slate-800">
                        <div class="flex items-center gap-2">
                          <span class="w-6 h-6 rounded-lg ${band.badgeClass} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            ${origIdx + 1}
                          </span>
                          <input type="text" value="${teacherName}" 
                            class="teacher-name-periods-input w-full max-w-sm bg-transparent hover:bg-white/40 focus:bg-white border border-transparent focus:border-indigo-400 rounded-lg px-2 py-1 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                            data-index="${origIdx}" data-oldname="${teacherName}">
                        </div>
                      </td>
                      <td class="py-2.5 px-4">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          ${(GRADE_BANDS || []).map(b => {
                            const isSelected = grade === b.key;
                            return `
                              <button type="button" 
                                class="btn-select-grade-band px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected ? b.badgeClass + ' shadow-2xs ring-2 ring-indigo-500/30 scale-105 font-black' : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/60'}"
                                data-teacher="${teacherName}" data-grade="${b.key}" data-index="${origIdx}">
                                ${b.key}
                              </button>
                            `;
                          }).join('')}
                        </div>
                      </td>
                      <td class="py-2.5 px-4 text-center">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${band.badgeClass} shadow-2xs">
                          <span class="w-2 h-2 rounded-full ${band.dotClass}"></span>
                          <span>${band.label}</span>
                        </span>
                      </td>
                      <td class="text-center py-2.5 px-3">
                        <button type="button" class="btn-delete-teacher-periods text-slate-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          data-index="${origIdx}" data-name="${teacherName}" title="ลบคุณครูท่านนี้">
                          <i data-lucide="trash" class="w-4 h-4"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    container.querySelectorAll('.period-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (!isNaN(idx) && activePeriods[idx]) {
          activePeriods[idx].name = e.target.value;
        }
      });
    });

    container.querySelectorAll('.period-time-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (!isNaN(idx) && activePeriods[idx]) {
          activePeriods[idx].time = e.target.value;
        }
      });
    });

    container.querySelectorAll('.period-break-check').forEach(check => {
      check.addEventListener('change', (e) => {
        syncInputsToActivePeriods();
        const idx = parseInt(e.target.dataset.index);
        activePeriods[idx].isBreak = e.target.checked;
        renderPeriodsTab(container);
      });
    });

    // Handle Top save button with interactive feedback
    const saveBtn = container.querySelector('.btn-save-periods-action');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        syncInputsToActivePeriods();
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังบันทึก...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
          await savePeriods(activePeriods);
          saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกสำเร็จ!</span>`;
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("บันทึกการตั้งค่าคาบเรียนสำเร็จเรียบร้อย!", "success");
          }

          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>บันทึกการตั้งค่า</span>`;
            if (window.lucide) window.lucide.createIcons();
          }, 2400);
        } catch (e) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>บันทึกการตั้งค่า</span>`;
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("เกิดข้อผิดพลาด: " + e.message, "error");
          }
        }
      });
    }

    // Teacher Grade Band Pill Selector
    container.querySelectorAll('.btn-select-grade-band').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const teacherName = e.currentTarget.dataset.teacher;
        const newGrade = e.currentTarget.dataset.grade;
        activeTeacherGrades[teacherName] = newGrade;
        if (saveTeacherGrades) {
          try {
            await saveTeacherGrades(activeTeacherGrades);
          } catch(err){}
        }
        renderPeriodsTab(container);
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast(`กำหนด ${teacherName} เป็นช่วงชั้น ${newGrade} แล้ว`, "success");
        }
      });
    });

    // Filter teacher grade buttons
    container.querySelectorAll('.teacher-grade-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        teacherFilterGrade = e.currentTarget.dataset.grade;
        renderPeriodsTab(container);
      });
    });

    // Search teacher input
    const searchInput = container.querySelector('#teacher-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        teacherSearchQuery = e.target.value;
        renderPeriodsTab(container);
        const newInput = container.querySelector('#teacher-search-input');
        if (newInput) {
          newInput.focus();
          newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
        }
      });
    }

    // Add Teacher from Periods Tab
    const btnAddTeacher = container.querySelector('#btn-add-teacher-periods-tab');
    if (btnAddTeacher) {
      btnAddTeacher.addEventListener('click', async () => {
        const newName = prompt("กรุณาระบุชื่อ-นามสกุลของคุณครูท่านใหม่:");
        if (newName && newName.trim()) {
          const trimmed = newName.trim();
          activeTeachers.push(trimmed);
          activeTeacherGrades[trimmed] = teacherFilterGrade !== 'ALL' ? teacherFilterGrade : 'ป.1-3';
          const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          daysList.forEach(d => {
            if (!activeTimetables[d]) activeTimetables[d] = [];
            activeTimetables[d].push(["", "", "", "", "", "", ""]);
          });
          await saveTeachers(activeTeachers);
          if (saveTeacherGrades) await saveTeacherGrades(activeTeacherGrades);
          renderPeriodsTab(container);
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast(`เพิ่มคุณครู "${trimmed}" เรียบร้อยแล้ว`, "success");
          }
        }
      });
    }

    // Rename Teacher in Periods Tab
    container.querySelectorAll('.teacher-name-periods-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.dataset.index);
        const oldName = e.target.dataset.oldname || activeTeachers[idx];
        const newName = e.target.value.trim();
        if (newName && newName !== oldName) {
          activeTeacherGrades[newName] = activeTeacherGrades[oldName] || "ป.1-3";
          delete activeTeacherGrades[oldName];
          activeTeachers[idx] = newName;
          await saveTeachers(activeTeachers);
          if (saveTeacherGrades) await saveTeacherGrades(activeTeacherGrades);
          renderPeriodsTab(container);
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast(`เปลี่ยนชื่อเป็น "${newName}" เรียบร้อยแล้ว`, "success");
          }
        }
      });
    });

    // Delete Teacher from Periods Tab
    container.querySelectorAll('.btn-delete-teacher-periods').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const name = e.currentTarget.dataset.name;
        if (confirm(`ต้องการลบคุณครู "${name}" ออกจากระบบใช่หรือไม่?`)) {
          delete activeTeacherGrades[name];
          activeTeachers.splice(idx, 1);
          const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          daysList.forEach(d => {
            if (activeTimetables[d]) activeTimetables[d].splice(idx, 1);
          });
          await saveTeachers(activeTeachers);
          if (saveTeacherGrades) await saveTeacherGrades(activeTeacherGrades);
          renderPeriodsTab(container);
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast(`ลบคุณครู "${name}" เรียบร้อยแล้ว`, "info");
          }
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function applyLogoZoomAndCrop(sourceDataUrl, zoom = 1.0, autoTrim = true) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w === 0 || h === 0) return resolve(sourceDataUrl);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let cropX = 0, cropY = 0, cropW = w, cropH = h;

        if (autoTrim) {
          try {
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;

            // สุ่มสีพื้นหลังรอบนอกขอบภาพ
            let bgR = 0, bgG = 0, bgB = 0, bgSamples = 0;
            for (let x = 0; x < w; x += 4) {
              const idxTop = x * 4;
              const idxBot = ((h - 1) * w + x) * 4;
              if (data[idxTop + 3] >= 30) {
                bgR += data[idxTop]; bgG += data[idxTop + 1]; bgB += data[idxTop + 2]; bgSamples++;
              }
              if (data[idxBot + 3] >= 30) {
                bgR += data[idxBot]; bgG += data[idxBot + 1]; bgB += data[idxBot + 2]; bgSamples++;
              }
            }
            for (let y = 0; y < h; y += 4) {
              const idxLeft = (y * w) * 4;
              const idxRight = (y * w + (w - 1)) * 4;
              if (data[idxLeft + 3] >= 30) {
                bgR += data[idxLeft]; bgG += data[idxLeft + 1]; bgB += data[idxLeft + 2]; bgSamples++;
              }
              if (data[idxRight + 3] >= 30) {
                bgR += data[idxRight]; bgG += data[idxRight + 1]; bgB += data[idxRight + 2]; bgSamples++;
              }
            }

            if (bgSamples > 0) {
              bgR = Math.round(bgR / bgSamples);
              bgG = Math.round(bgG / bgSamples);
              bgB = Math.round(bgB / bgSamples);
            } else {
              bgR = 255; bgG = 255; bgB = 255;
            }

            let minX = w, minY = h, maxX = 0, maxY = 0;
            let found = false;

            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                if (a < 30) continue; // โปร่งใสถือเป็นพื้นหลัง

                // เช็คว่าต่างจากสีพื้นหลังรอบนอก หรือเป็นสีอื่นที่ไม่ใช่ขาวจ้า
                const diffFromBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                const isNearWhite = (r > 238 && g > 238 && b > 238);

                if (diffFromBg > 35 && !isNearWhite) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                  found = true;
                }
              }
            }

            if (found && maxX > minX && maxY > minY) {
              const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
              cropX = Math.max(0, minX - pad);
              cropY = Math.max(0, minY - pad);
              cropW = Math.min(w, maxX + pad) - cropX;
              cropH = Math.min(h, maxY + pad) - cropY;
            }
          } catch (e) {
            console.warn("Auto-trim error:", e);
          }
        }

        // ซูมขยายเข้าสู่กึ่งกลางของตัวตรา
        if (zoom > 1.0) {
          const factor = 1 / zoom;
          const newW = Math.round(cropW * factor);
          const newH = Math.round(cropH * factor);
          cropX += Math.round((cropW - newW) / 2);
          cropY += Math.round((cropH - newH) / 2);
          cropW = newW;
          cropH = newH;
        }

        const maxDim = 320;
        let outW = maxDim;
        let outH = Math.round((cropH * maxDim) / cropW);
        if (outH > maxDim) {
          outH = maxDim;
          outW = Math.round((cropW * maxDim) / cropH);
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

        resolve(outCanvas.toDataURL('image/png', 0.9));
      };
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
      img.src = sourceDataUrl;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น (เช่น PNG, JPG, WebP, SVG)'));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // ย่อภาพต้นฉบับเบื้องต้นให้อยู่ในขนาดไม่เกิน 500px เพื่อไม่ให้เปลือง Quota ของเบราว์เซอร์
          const maxDim = 500;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else { w = Math.round((w * maxDim) / h); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png', 0.9));
        };
        img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
      reader.readAsDataURL(file);
    });
  }

  function updateLogoPreviewUI(container, logoUrl) {
    const previewBox = container.querySelector('#logo-preview-box');
    const statusBadge = container.querySelector('#logo-status-badge');
    const uploadText = container.querySelector('#btn-upload-text');
    const btnRemove = container.querySelector('#btn-remove-logo');

    if (!previewBox) return;

    if (logoUrl) {
      previewBox.className = "w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-emerald-300/80 bg-white p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-xs transition-all cursor-pointer";
      previewBox.innerHTML = `<img src="${logoUrl}" alt="โลโก้โรงเรียน" class="w-full h-full object-contain p-0.5">`;

      if (statusBadge) {
        statusBadge.className = "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200/80";
        statusBadge.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i><span id="logo-status-text">ตัวอย่างพร้อมใช้งาน</span>`;
      }
      if (uploadText) uploadText.innerText = "เปลี่ยนโลโก้";
      if (btnRemove) btnRemove.classList.remove('hidden');
    } else {
      previewBox.className = "w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-2 flex items-center justify-center shrink-0 overflow-hidden transition-all cursor-pointer";
      previewBox.innerHTML = `
        <div class="text-center text-slate-400 flex flex-col items-center justify-center">
          <i data-lucide="image" class="w-8 h-8 mb-1 opacity-50"></i>
          <span class="text-[10px] font-bold">ไม่มีโลโก้</span>
        </div>
      `;

      if (statusBadge) {
        statusBadge.className = "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full text-slate-500 bg-slate-100 border border-slate-200";
        statusBadge.innerHTML = `<i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i><span id="logo-status-text">ยังไม่ได้ตั้งค่า</span>`;
      }
      if (uploadText) uploadText.innerText = "อัปโหลดโลโก้";
      if (btnRemove) btnRemove.classList.add('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function renderSchoolTab(container) {
    const s = activeSettings;

    container.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-6 w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-base sm:text-lg font-bold text-slate-800">ข้อมูลสถานศึกษาและผู้บริหาร</h3>
            <p class="text-xs text-slate-500 mt-0.5">ข้อมูลเหล่านี้จะถูกนำไปพิมพ์ลงในหัวเอกสารและช่องลงนามของแบบฟอร์มสอนแทน</p>
          </div>
          <button type="button" 
            class="btn-save-school-action btn-press hover-lift-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>บันทึกข้อมูล</span>
          </button>
        </div>

        <!-- โลโก้ / ตราสัญลักษณ์ประจำโรงเรียน -->
        <div class="border-b border-slate-100 pb-5">
          <div class="flex items-center justify-between mb-2.5">
            <label class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
              <span class="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <i data-lucide="image" class="w-4 h-4"></i>
              </span>
              <span>ตราสัญลักษณ์ / โลโก้ประจำโรงเรียน</span>
            </label>
            <span class="text-[11px] font-medium text-slate-400">แสดงที่หัวเอกสาร PDF / A4 และเมนูด้านบน</span>
          </div>

          <div class="bg-white/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-2xs hover:border-slate-300 transition-all">
            
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <!-- ด้านซ้าย: กล่องแสดงโลโก้ + รายละเอียด -->
              <div class="flex items-center gap-4 w-full sm:w-auto">
                <!-- กล่องแสดงโลโก้ (ขนาดใหญ่ขึ้น คมชัด) -->
                <div id="logo-preview-box" 
                  class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 ${s.logoUrl ? 'border-emerald-300/80 bg-white shadow-xs' : 'border-dashed border-slate-300 bg-slate-50'} p-2 flex items-center justify-center shrink-0 overflow-hidden transition-all cursor-pointer"
                  title="คลิกเพื่ออัปโหลดหรือเปลี่ยนโลโก้">
                  ${s.logoUrl ? `
                    <img src="${s.logoUrl}" alt="โลโก้โรงเรียน" class="w-full h-full object-contain p-0.5">
                  ` : `
                    <div class="text-center text-slate-400 flex flex-col items-center justify-center">
                      <i data-lucide="image" class="w-8 h-8 mb-1 opacity-50"></i>
                      <span class="text-[10px] font-bold">ไม่มีโลโก้</span>
                    </div>
                  `}
                </div>

                <!-- ข้อความและสถานะโลโก้ -->
                <div class="space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-sm font-bold text-slate-800">
                      ${s.schoolName || 'โรงเรียน'}
                    </h4>
                    <span id="logo-status-badge" class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${s.logoUrl ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80' : 'text-slate-500 bg-slate-100 border border-slate-200'}">
                      <i data-lucide="${s.logoUrl ? 'check-circle' : 'info'}" class="w-3.5 h-3.5 ${s.logoUrl ? 'text-emerald-600' : 'text-slate-400'}"></i>
                      <span id="logo-status-text">${s.logoUrl ? 'ตัวอย่างพร้อมใช้งาน' : 'ยังไม่ได้ตั้งค่า'}</span>
                    </span>
                  </div>
                  <p class="text-xs text-slate-500">
                    รองรับไฟล์ภาพ PNG (พื้นหลังโปร่งใส), JPG, WebP, SVG
                  </p>
                  <p class="text-[11px] text-slate-400">
                    ระบบตัดขอบว่างและขยายให้เต็มกรอบอัตโนมัติ (โหลดเร็วและคมชัด)
                  </p>
                </div>
              </div>

              <!-- ด้านขวา: ปุ่มเปลี่ยนโลโก้ + ปุ่มลบ -->
              <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
                <input type="file" id="cfg-logo-file-input" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" class="hidden">

                <button type="button" id="btn-trigger-upload" 
                  class="btn-press hover-lift-sm px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <i data-lucide="upload" class="w-4 h-4"></i>
                  <span id="btn-upload-text">${s.logoUrl ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}</span>
                </button>

                <button type="button" id="btn-remove-logo" 
                  class="btn-press hover-lift-sm px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${s.logoUrl ? '' : 'hidden'}">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  <span>ลบโลโก้</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-600 mb-1">ชื่อโรงเรียน</label>
            <input type="text" id="cfg-school-name" value="${s.schoolName || ''}" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
          </div>
          <div>
            <label class="block font-semibold text-slate-600 mb-1">ตำบล</label>
            <input type="text" id="cfg-subdistrict" value="${s.subdistrict || ''}" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
          </div>
          <div>
            <label class="block font-semibold text-slate-600 mb-1">อำเภอ</label>
            <input type="text" id="cfg-district" value="${s.district || ''}" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
          </div>
          <div>
            <label class="block font-semibold text-slate-600 mb-1">จังหวัดและรหัสไปรษณีย์</label>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" id="cfg-province" value="${s.province || ''}" 
                placeholder="จังหวัด" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
              <input type="text" id="cfg-postal" value="${s.postalCode || ''}" 
                placeholder="รหัสไปรษณีย์" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <h4 class="font-bold text-slate-700 text-sm mb-3">ข้อมูลผู้ลงนามในแบบฟอร์ม</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">ยศ/คำนำหน้า และชื่อหัวหน้าฝ่ายวิชาการ</label>
              <div class="grid grid-cols-3 gap-2">
                <input type="text" id="cfg-academic-rank" value="${s.academicHeadRank || 'ลงชื่อ'}" placeholder="เช่น ลงชื่อ หรือ ว่าที่ร้อยตรี"
                  class="col-span-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-medium">
                <input type="text" id="cfg-academic-head" value="${s.academicHeadName || ''}" placeholder="ชื่อ-นามสกุล หัวหน้าวิชาการ"
                  class="col-span-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-medium">
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">ตำแหน่งหัวหน้าวิชาการ</label>
              <input type="text" id="cfg-academic-pos" value="${s.academicHeadPosition || ''}" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">ยศ/คำนำหน้า และชื่อผู้อำนวยการ</label>
              <div class="grid grid-cols-3 gap-2">
                <input type="text" id="cfg-director-rank" value="${s.directorRank || ''}" placeholder="เช่น ว่าที่ร้อยตรี"
                  class="col-span-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-medium">
                <input type="text" id="cfg-director-name" value="${s.directorName || ''}" placeholder="ชื่อ-นามสกุล ผอ."
                  class="col-span-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-medium">
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">ตำแหน่งผู้อำนวยการ</label>
              <input type="text" id="cfg-director-pos" value="${s.directorPosition || ''}" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-medium">
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <h4 class="font-bold text-slate-700 text-sm mb-3">หัวข้อและข้อความในหนังสือราชการ</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">เรื่อง</label>
              <input type="text" id="cfg-doc-subject" value="${s.docSubject || ''}" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">เรียน</label>
              <input type="text" id="cfg-doc-dear" value="${s.docDear || ''}" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium">
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <h4 class="font-bold text-slate-700 text-sm mb-3">เปลี่ยนรหัสผ่านแอดมิน (PIN Code)</h4>
          <div class="w-48 text-xs">
            <input type="password" id="cfg-new-pin" maxlength="4" placeholder="รหัสผ่าน 4 หลัก" value="${getStoredPin()}"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white font-mono tracking-widest text-center text-sm font-bold">
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t border-slate-100">
          <button type="button" 
            class="btn-save-school-action btn-press hover-lift-sm px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>บันทึกข้อมูลโรงเรียน</span>
          </button>
        </div>

      </div>
    `;

    // Setup Compact Upload and Remove Handlers
    const btnTriggerUpload = container.querySelector('#btn-trigger-upload');
    const btnRemoveLogo = container.querySelector('#btn-remove-logo');
    const fileInput = container.querySelector('#cfg-logo-file-input');
    const previewBox = container.querySelector('#logo-preview-box');

    const handleSelectedFile = async (file) => {
      if (!file) return;
      try {
        const rawDataUrl = await readFileAsDataUrl(file);
        sessionRawLogoUrl = rawDataUrl;
        delete activeSettings.rawLogoUrl;
        const trimmedDataUrl = await applyLogoZoomAndCrop(rawDataUrl, 1.0, true);
        activeSettings.logoUrl = trimmedDataUrl;
        updateLogoPreviewUI(container, trimmedDataUrl);
        if (global.TeachApp && global.TeachApp.updateSchoolBrandingUI) {
          global.TeachApp.updateSchoolBrandingUI(activeSettings);
        }
        // Auto-save immediately to Cloud & LocalStorage
        await saveSchoolSettings(activeSettings);
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("อัปโหลด ตัดพื้นที่สีขาว และขยายตราสัญลักษณ์เต็มกรอบเรียบร้อยแล้ว!", "success");
        }
      } catch (err) {
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast(err.message || 'เกิดข้อผิดพลาดในการโหลดรูปภาพ', "error");
        }
      }
    };

    if (btnTriggerUpload && fileInput) {
      btnTriggerUpload.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleSelectedFile(e.target.files[0]);
        }
      });
    }

    if (previewBox && fileInput) {
      previewBox.addEventListener('click', () => {
        fileInput.click();
      });

      // Drag and drop onto preview box
      previewBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        previewBox.classList.add('border-indigo-500', 'bg-indigo-50', 'scale-105');
      });
      ['dragleave', 'dragend'].forEach(evt => {
        previewBox.addEventListener(evt, () => {
          previewBox.classList.remove('border-indigo-500', 'bg-indigo-50', 'scale-105');
        });
      });
      previewBox.addEventListener('drop', (e) => {
        e.preventDefault();
        previewBox.classList.remove('border-indigo-500', 'bg-indigo-50', 'scale-105');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleSelectedFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener('click', async () => {
        sessionRawLogoUrl = null;
        delete activeSettings.rawLogoUrl;
        activeSettings.logoUrl = "";
        updateLogoPreviewUI(container, "");
        if (global.TeachApp && global.TeachApp.updateSchoolBrandingUI) {
          global.TeachApp.updateSchoolBrandingUI(activeSettings);
        }
        // Auto-save removal immediately
        await saveSchoolSettings(activeSettings);
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("ลบตราสัญลักษณ์โรงเรียนเรียบร้อยแล้ว", "info");
        }
      });
    }

    // Bind all Save buttons (top and bottom) with reactive state and toast
    container.querySelectorAll('.btn-save-school-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const saveBtns = container.querySelectorAll('.btn-save-school-action');
        saveBtns.forEach(b => {
          b.disabled = true;
          b.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังบันทึก...</span>`;
        });
        if (window.lucide) window.lucide.createIcons();

        activeSettings.schoolName = document.getElementById('cfg-school-name').value;
        activeSettings.subdistrict = document.getElementById('cfg-subdistrict').value;
        activeSettings.district = document.getElementById('cfg-district').value;
        activeSettings.province = document.getElementById('cfg-province').value;
        activeSettings.postalCode = document.getElementById('cfg-postal').value;
        activeSettings.academicHeadRank = document.getElementById('cfg-academic-rank') ? document.getElementById('cfg-academic-rank').value.trim() : 'ลงชื่อ';
        activeSettings.academicHeadName = document.getElementById('cfg-academic-head').value;
        activeSettings.academicHeadPosition = document.getElementById('cfg-academic-pos').value;
        activeSettings.directorRank = document.getElementById('cfg-director-rank').value;
        activeSettings.directorName = document.getElementById('cfg-director-name').value;
        activeSettings.directorPosition = document.getElementById('cfg-director-pos').value;
        activeSettings.docSubject = document.getElementById('cfg-doc-subject').value;
        activeSettings.docDear = document.getElementById('cfg-doc-dear').value;

        const newPin = document.getElementById('cfg-new-pin').value.trim();
        if (newPin && newPin.length === 4) {
          localStorage.setItem(ADMIN_PIN_KEY, newPin);
        }

        delete activeSettings.rawLogoUrl;

        try {
          await saveSchoolSettings(activeSettings);
          if (global.TeachApp && global.TeachApp.updateSchoolBrandingUI) {
            global.TeachApp.updateSchoolBrandingUI(activeSettings);
          }

          saveBtns.forEach(b => {
            b.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกสำเร็จ!</span>`;
          });
          if (window.lucide) window.lucide.createIcons();

          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("บันทึกข้อมูลโรงเรียน ตราสัญลักษณ์ และการตั้งค่าสำเร็จเรียบร้อย!", "success");
          }

          setTimeout(() => {
            saveBtns.forEach((b, idx) => {
              b.disabled = false;
              b.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${idx === 0 ? 'บันทึกข้อมูล' : 'บันทึกข้อมูลโรงเรียน'}</span>`;
            });
            if (window.lucide) window.lucide.createIcons();
          }, 2400);
        } catch (e) {
          saveBtns.forEach((b, idx) => {
            b.disabled = false;
            b.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${idx === 0 ? 'บันทึกข้อมูล' : 'บันทึกข้อมูลโรงเรียน'}</span>`;
          });
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("เกิดข้อผิดพลาด: " + e.message, "error");
          }
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  global.TeachAdmin = {
    initAdminPage
  };
})(typeof window !== 'undefined' ? window : this);
