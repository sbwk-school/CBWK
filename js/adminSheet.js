/**
 * adminSheet.js - หน้าแอดมินสำหรับแก้ไขตารางสอนสไตล์ Spreadsheet และการตั้งค่าระบบ Firebase
 */

(function(global) {
  const { 
    getSchoolSettings, 
    saveSchoolSettings, 
    getPeriods, 
    savePeriods, 
    getAcademicCalendar,
    saveAcademicCalendar,
    getTeachers, 
    saveTeachers, 
    getTeacherGrades,
    saveTeacherGrades,
    getAllTimetables, 
    saveDayTimetable, 
    saveAllTimetables,
    getSubstitutions,
    getFirebaseConfig, 
    parseConfigInput, 
    saveFirebaseConfig, 
    testFirebaseConnection, 
    seedAllDataToFirebase,
    clearSubstitutionHistory
  } = global.TeachDatabase;

  const {
    GRADE_BANDS = [
      { key: "อนุบาล", label: "อนุบาล (ส้มพาสเทล)", colorName: "ส้ม", color: "amber", cellBg: "bg-amber-50", rowHover: "hover:bg-amber-100/80", badgeClass: "bg-amber-200/90 text-amber-950 border-amber-300", borderClass: "border-l-amber-500", dotClass: "bg-amber-500", textClass: "text-amber-950" },
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
    DEFAULT_TEACHER_GRADES = {},
    DEFAULT_ACADEMIC_CALENDAR = {}
  } = global.TeachData || {};

  const ADMIN_PIN_KEY = 'teach_admin_pin';
  const DEFAULT_PIN = '1111';

  let isUnlocked = false;
  let activeAdminTab = 'school';
  let selectedDay = 'จันทร์';
  let isSheetEditMode = false;
  let originalTimetablesSnapshot = null;
  let originalTeachersSnapshot = null;
  let activeTimetables = {};
  let activeTeachers = [];
  let activePeriods = [];
  let activeSettings = {};
  let activeTeacherGrades = {};
  let activeCalendar = null;
  let activeSubstitutions = [];
  let calendarTeacherGradeFilter = 'ALL';
  let calendarTeacherSearch = '';
  let calendarSortOrder = 'default';
  let teacherFilterGrade = 'ALL';
  let teacherSearchQuery = '';
  let sheetFilterGrade = 'ALL';
  let sessionRawLogoUrl = null;

  async function saveTeacherRosterAndTimetables() {
    await saveTeachers(activeTeachers);
    if (saveTeacherGrades) await saveTeacherGrades(activeTeacherGrades);
    if (saveAllTimetables) {
      await saveAllTimetables(activeTimetables, activeTeachers);
      return;
    }

    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    for (const day of days) {
      await saveDayTimetable(day, activeTimetables[day] || [], activeTeachers);
    }
  }

  function showRosterSaveResult(error) {
    if (global.TeachApp && global.TeachApp.showToast) {
      global.TeachApp.showToast(
        error ? `บันทึกรายชื่อครูไม่สำเร็จ: ${error.message}` : "บันทึกรายชื่อครูและตารางสอนแล้ว",
        error ? "error" : "success"
      );
    }
  }

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
    const saved = localStorage.getItem(ADMIN_PIN_KEY);
    if (!saved || saved === '0000') {
      return DEFAULT_PIN;
    }
    return saved;
  }

  function renderPinLockScreen() {
    const container = document.getElementById('view-admin');
    if (!container) return;

    container.innerHTML = `
      <div class="relative max-w-md mx-auto my-8 sm:my-14 px-4">
        <!-- Ambient Backdrop Glow -->
        <div class="absolute -top-10 -left-10 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -right-10 w-52 h-52 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Main Card -->
        <div id="admin-login-card" class="relative bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-900/10 border border-slate-200/80 p-8 sm:p-10 text-center transition-all duration-300">
          
          <!-- Security Icon Badge -->
          <div class="relative inline-flex items-center justify-center mb-5">
            <div class="w-20 h-20 bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/25 ring-8 ring-indigo-50/90 transform hover:scale-105 transition-transform duration-300">
              <i data-lucide="shield-check" class="w-10 h-10 text-white"></i>
            </div>
            <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
              <i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>
            </div>
          </div>

          <!-- Title & Subtitle -->
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">เข้าสู่ระบบผู้ดูแลระบบ</h2>
          <p class="text-xs sm:text-sm text-slate-500 mt-1.5 mb-8 font-medium">กรุณากรอกรหัสผ่าน 4 หลัก เพื่อเข้าจัดการข้อมูลและตารางสอน</p>

          <!-- 4-Digit Segmented PIN Visualizer -->
          <div class="relative flex justify-center items-center gap-3 sm:gap-3.5 mb-6 cursor-pointer select-none" id="pin-box-wrapper" title="คลิกเพื่อกรอกรหัสผ่าน">
            <!-- Hidden Real Input -->
            <input type="password" id="pin-input" maxlength="4" autofocus inputmode="numeric" pattern="[0-9]*" autocomplete="off"
              class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20 text-transparent selection:bg-transparent">

            <!-- 4 Visual Digit Slots -->
            <div class="pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-indigo-600 bg-white flex items-center justify-center transition-all duration-200 shadow-md ring-4 ring-indigo-100" data-index="0">
              <span class="slot-dot w-2 h-2 rounded-full bg-indigo-400 animate-pulse transition-all duration-150"></span>
            </div>
            <div class="pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-slate-200/90 bg-slate-50/70 flex items-center justify-center transition-all duration-200 shadow-2xs" data-index="1">
              <span class="slot-dot w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-150"></span>
            </div>
            <div class="pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-slate-200/90 bg-slate-50/70 flex items-center justify-center transition-all duration-200 shadow-2xs" data-index="2">
              <span class="slot-dot w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-150"></span>
            </div>
            <div class="pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-slate-200/90 bg-slate-50/70 flex items-center justify-center transition-all duration-200 shadow-2xs" data-index="3">
              <span class="slot-dot w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-150"></span>
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div id="pin-error-msg" class="text-xs text-rose-600 bg-rose-50 border border-rose-200/90 py-2.5 px-4 rounded-xl font-bold mb-5 hidden animate-in fade-in flex items-center justify-center gap-2 shadow-2xs">
            <i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 shrink-0"></i>
            <span>รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</span>
          </div>

          <!-- Unlock Button -->
          <button id="btn-unlock-admin" 
            class="btn-press hover-lift-sm w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="lock-open" class="w-4 h-4"></i>
            <span>ปลดล็อคเข้าสู่ระบบ</span>
          </button>

          <!-- Security Footer Note (ไม่มีคำใบ้รหัสผ่าน) -->
          <div class="mt-7 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <i data-lucide="shield" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>ระบบความปลอดภัยข้อมูลโรงเรียนชุมชนบ้านวังพิกุล</span>
          </div>

        </div>
      </div>
    `;

    const pinInput = document.getElementById('pin-input');
    const errorMsg = document.getElementById('pin-error-msg');
    const unlockBtn = document.getElementById('btn-unlock-admin');
    const cardEl = document.getElementById('admin-login-card');
    const wrapperEl = document.getElementById('pin-box-wrapper');

    function updatePinSlotsUI() {
      if (!pinInput) return;
      const val = pinInput.value;
      const slots = container.querySelectorAll('.pin-slot');
      slots.forEach((slot, idx) => {
        const dot = slot.querySelector('.slot-dot');
        if (idx < val.length) {
          // Filled slot
          slot.className = "pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-indigo-500 bg-indigo-50/40 flex items-center justify-center transition-all duration-150 shadow-xs ring-2 ring-indigo-200/60";
          if (dot) dot.className = "slot-dot w-3.5 h-3.5 rounded-full bg-indigo-600 shadow-xs shadow-indigo-500/40 scale-125 transition-all duration-150";
        } else if (idx === val.length) {
          // Current active typing slot
          slot.className = "pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-indigo-600 bg-white flex items-center justify-center transition-all duration-150 shadow-md ring-4 ring-indigo-100";
          if (dot) dot.className = "slot-dot w-2 h-2 rounded-full bg-indigo-400 animate-pulse transition-all duration-150";
        } else {
          // Empty slot
          slot.className = "pin-slot w-13 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 border-slate-200/90 bg-slate-50/70 flex items-center justify-center transition-all duration-150 shadow-2xs";
          if (dot) dot.className = "slot-dot w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-150";
        }
      });
    }

    const checkPin = async () => {
      if (!pinInput) return;
      const entered = pinInput.value.trim();
      if (entered === getStoredPin()) {
        isUnlocked = true;
        sessionStorage.setItem('teach_admin_unlocked', 'true');
        await loadAdminData();
        renderAdminDashboard();
      } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        if (cardEl) {
          cardEl.classList.remove('animate-shake');
          void cardEl.offsetWidth; // Trigger reflow for animation restart
          cardEl.classList.add('animate-shake');
        }
        pinInput.value = '';
        updatePinSlotsUI();
        pinInput.focus();
      }
    };

    if (pinInput) {
      pinInput.addEventListener('input', () => {
        if (errorMsg) errorMsg.classList.add('hidden');
        updatePinSlotsUI();
        if (pinInput.value.length === 4) {
          setTimeout(checkPin, 90);
        }
      });

      pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkPin();
      });

      // Auto focus smoothly
      setTimeout(() => {
        if (pinInput) pinInput.focus();
      }, 100);
    }

    if (wrapperEl) {
      wrapperEl.addEventListener('click', () => {
        if (pinInput) pinInput.focus();
      });
    }

    if (unlockBtn) {
      unlockBtn.addEventListener('click', checkPin);
    }

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
    if (getAcademicCalendar) {
      activeCalendar = (await getAcademicCalendar()) || { ...DEFAULT_ACADEMIC_CALENDAR };
    } else {
      activeCalendar = { ...DEFAULT_ACADEMIC_CALENDAR };
    }
    if (!activeCalendar.holidays) activeCalendar.holidays = [];
    if (getSubstitutions) {
      try {
        activeSubstitutions = (await getSubstitutions()) || [];
      } catch (e) {
        console.warn("Failed to load substitutions in admin:", e);
        activeSubstitutions = [];
      }
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
              จัดการระบบแอดมิน <span class="admin-title-en hidden sm:inline">(Admin Panel)</span>
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              <span class="admin-description-full hidden sm:inline">จัดการตารางสอนสไตล์ Sheet, ตั้งค่าคาบเรียน, ข้อมูลโรงเรียน และเชื่อมต่อฐานข้อมูล Firebase</span>
              <span class="admin-description-compact sm:hidden">ตั้งค่าระบบและตารางสอน</span>
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-2xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="admin-cloud-label-full hidden sm:inline">เชื่อมต่อคลาวด์ Firebase แล้ว (arrange-c24b2)</span>
              <span class="admin-cloud-label-compact sm:hidden">เชื่อมต่อแล้ว</span>
            </span>

            <button id="btn-open-reset-confirm" type="button"
              class="btn-press hover-lift-sm inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200/80 transition-colors cursor-pointer shadow-2xs"
              title="ล้างประวัติการลาและการสอนแทน">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
              ล้างประวัติ
            </button>

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
            <span class="admin-tab-label-wide hidden sm:inline">ข้อมูลโรงเรียน & ผู้บริหาร</span>
            <span class="admin-tab-label-mobile sm:hidden">โรงเรียน</span>
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'periods' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="periods">
            <i data-lucide="clock" class="w-4 h-4 inline mr-1.5 text-blue-500"></i>
            <span class="admin-tab-label-wide hidden sm:inline">คาบเรียน & รายชื่อครู</span>
            <span class="admin-tab-label-mobile sm:hidden">คาบ & ครู</span>
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'sheet' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="sheet">
            <i data-lucide="sheet" class="w-4 h-4 inline mr-1.5 text-indigo-500"></i>
            <span>ตารางสอน</span>
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'calendar' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="calendar">
            <i data-lucide="calendar-days" class="w-4 h-4 inline mr-1.5 text-emerald-500"></i>
            <span class="admin-tab-label-wide hidden sm:inline">ปฏิทินภาคเรียน & วันหยุด</span>
            <span class="admin-tab-label-mobile sm:hidden">ปฏิทินเทอม</span>
          </button>
          <button class="admin-tab-btn btn-press px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${activeAdminTab === 'teaching-load' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}"
            data-tab="teaching-load">
            <i data-lucide="calculator" class="w-4 h-4 inline mr-1.5 text-indigo-500"></i>
            <span class="admin-tab-label-wide hidden sm:inline">คำนวณคาบสอนจริง</span>
            <span class="admin-tab-label-mobile sm:hidden">ภาระงานสอน</span>
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
    renderResetDialog(container);
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
    } else if (activeAdminTab === 'calendar') {
      renderCalendarTab(contentArea);
    } else if (activeAdminTab === 'teaching-load') {
      renderTeachingLoadTab(contentArea);
    } else {
      renderSchoolTab(contentArea);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function renderResetDialog(container) {
    const dialogHost = document.createElement('div');
    dialogHost.innerHTML = `
        <div id="reset-data-modal" class="fixed inset-0 z-[70] hidden items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <div class="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div class="flex items-start gap-3">
              <span class="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0"><i data-lucide="triangle-alert" class="w-5 h-5"></i></span>
              <div>
                <h3 id="reset-modal-title" class="text-base font-bold text-slate-900">ยืนยันการล้างประวัติ</h3>
                <p class="text-sm text-slate-600 mt-1">จะลบประวัติการลาและการสอนแทนทั้งหมดที่บันทึกไว้ และย้อนคืนไม่ได้</p>
              </div>
            </div>

            <div id="reset-confirm-step" class="mt-5">
              <p class="text-sm text-slate-700">รายชื่อครู ตารางสอน คาบเรียน และการตั้งค่าโรงเรียนจะยังคงอยู่ กดดำเนินการต่อเพื่อกรอกรหัสแอดมินยืนยันอีกครั้ง</p>
              <div class="flex justify-end gap-2 mt-5">
                <button type="button" id="btn-cancel-reset" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold">ยกเลิก</button>
                <button type="button" id="btn-continue-reset" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold">ดำเนินการต่อ</button>
              </div>
            </div>

            <form id="reset-pin-step" class="hidden mt-5">
              <label for="reset-admin-pin" class="block text-sm font-semibold text-slate-700 mb-2">กรอกรหัสแอดมินเพื่อยืนยัน</label>
              <input id="reset-admin-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" pattern="[0-9]{4}" required
                class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center text-lg tracking-[0.5em] focus:ring-2 focus:ring-rose-500 outline-none" aria-describedby="reset-pin-error">
              <p id="reset-pin-error" class="hidden mt-2 text-sm text-rose-700" role="alert">รหัสไม่ถูกต้อง กรุณาลองอีกครั้ง</p>
              <div class="flex justify-end gap-2 mt-5">
                <button type="button" id="btn-back-reset" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold">ย้อนกลับ</button>
                <button type="submit" id="btn-confirm-reset" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold">ยืนยันและล้างประวัติ</button>
              </div>
            </form>
          </div>
        </div>
    `;
    const dialogElement = dialogHost.firstElementChild;
    if (!dialogElement) return;
    container.appendChild(dialogElement);

    const modal = container.querySelector('#reset-data-modal');
    const confirmStep = container.querySelector('#reset-confirm-step');
    const pinStep = container.querySelector('#reset-pin-step');
    const pinInput = container.querySelector('#reset-admin-pin');
    const pinError = container.querySelector('#reset-pin-error');
    const confirmButton = container.querySelector('#btn-confirm-reset');

    const closeModal = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      confirmStep.classList.remove('hidden');
      pinStep.classList.add('hidden');
      pinInput.value = '';
      pinError.classList.add('hidden');
      openButton.focus();
    };

    const openButton = container.querySelector('#btn-open-reset-confirm');
    openButton.addEventListener('click', () => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      container.querySelector('#btn-continue-reset').focus();
    });
    const closeButton = container.querySelector('#btn-cancel-reset');
    closeButton.addEventListener('click', closeModal);
    container.querySelector('#btn-continue-reset').addEventListener('click', () => {
      confirmStep.classList.add('hidden');
      pinStep.classList.remove('hidden');
      pinInput.focus();
    });
    container.querySelector('#btn-back-reset').addEventListener('click', () => {
      pinStep.classList.add('hidden');
      confirmStep.classList.remove('hidden');
      pinError.classList.add('hidden');
      pinInput.value = '';
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !confirmButton.disabled) closeModal();
    });
    pinStep.addEventListener('submit', async (event) => {
      event.preventDefault();
      pinError.classList.add('hidden');
      if (pinInput.value !== getStoredPin()) {
        pinError.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
      }

      confirmButton.disabled = true;
      confirmButton.textContent = 'กำลังล้างประวัติ...';
      try {
        if (typeof clearSubstitutionHistory !== 'function') {
          throw new Error('ไม่พบฟังก์ชันล้างประวัติ กรุณารีโหลดหน้าเว็บแล้วลองใหม่');
        }
        const deletedCount = await clearSubstitutionHistory();
        pinStep.innerHTML = `
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-900">
            <p class="font-bold">ล้างประวัติเรียบร้อยแล้ว</p>
            <p class="text-sm mt-1">ลบรายการ ${deletedCount} รายการ ระบบกำลังโหลดข้อมูลใหม่</p>
          </div>
        `;
        setTimeout(() => window.location.reload(), 900);
      } catch (error) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'ยืนยันและล้างประวัติ';
        pinError.textContent = error.message || 'ล้างประวัติไม่สำเร็จ กรุณาลองใหม่';
        pinError.classList.remove('hidden');
        console.error('Clear substitution history error:', error);
      }
    });
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
    let scoreK = 0;
    let scoreP13 = 0;
    let scoreP46 = 0;
    let scoreM13 = 0;
    let scoreM46 = 0;

    (subs || []).forEach(s => {
      if (!s) return;
      if (/อ\s*[.\-]?\s*[1-3]|อนุบาล|ปฐมวัย/i.test(s)) scoreK += 2;
      if (/ป\s*[.\-]?\s*[1-3]/i.test(s)) scoreP13 += 2;
      if (/ป\s*[.\-]?\s*[4-6]/i.test(s)) scoreP46 += 2;
      if (/ม\s*[.\-]?\s*[1-3]/i.test(s)) scoreM13 += 2;
      if (/ม\s*[.\-]?\s*[4-6]/i.test(s)) scoreM46 += 2;
    });

    const max = Math.max(scoreK, scoreP13, scoreP46, scoreM13, scoreM46);
    if (max > 0) {
      if (max === scoreK) return "อนุบาล";
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
    const gradeCounts = { "อนุบาล": 0, "ป.1-3": 0, "ป.4-6": 0, "ม.1-3": 0, "ม.4-6": 0 };

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
                <span class="text-amber-700 font-bold">อนุบาล (${analysisResult.gradeCounts['อนุบาล'] || 0})</span> • 
                <span class="text-emerald-700 font-bold">ป.1-3 (${analysisResult.gradeCounts['ป.1-3'] || 0})</span> • 
                <span class="text-rose-700 font-bold">ป.4-6 (${analysisResult.gradeCounts['ป.4-6'] || 0})</span><br/>
                <span class="text-sky-700 font-bold">ม.1-3 (${analysisResult.gradeCounts['ม.1-3'] || 0})</span> • 
                <span class="text-purple-700 font-bold">ม.4-6 (${analysisResult.gradeCounts['ม.4-6'] || 0})</span>
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
            ${isSheetEditMode ? `
              <!-- ปุ่มบันทึกข้อมูล (โหมดแก้ไข: เด่นชัด สีเขียวมรกต) -->
              <button id="btn-save-all-data" 
                class="btn-press hover-lift-sm px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer ring-2 ring-emerald-400"
                title="บันทึกข้อมูลตารางสอน รายชื่อครู และช่วงชั้นทั้งหมดลงระบบและคลาวด์ Firebase">
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>บันทึกข้อมูล</span>
              </button>

              <!-- ปุ่มยกเลิกการแก้ไข -->
              <button id="btn-cancel-edit-sheet" 
                class="btn-press hover-lift-sm px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="ยกเลิกการแก้ไขและคืนค่าเดิมก่อนหน้า">
                <i data-lucide="x" class="w-4 h-4"></i>
                <span>ยกเลิก</span>
              </button>
            ` : `
              <!-- ปุ่มเข้าสู่โหมดแก้ไขตารางสอน -->
              <button id="btn-toggle-edit-sheet" 
                class="btn-press hover-lift-sm px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="เปิดโหมดแก้ไขตารางสอน เพื่อคลิกพิมพ์แก้ข้อมูลในช่องได้เหมือน Excel">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
                <span>แก้ไขตารางสอน</span>
              </button>
            `}

            <button id="btn-add-teacher-row" 
              class="btn-press hover-lift-sm px-3 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
              <span>เพิ่มคุณครู</span>
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

        ${isSheetEditMode ? `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950 bg-amber-50/90 p-3 rounded-xl border-2 border-amber-300 shadow-2xs animate-in fade-in">
            <div class="flex items-center gap-2">
              <span class="p-1.5 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </span>
              <span><strong>โหมดแก้ไขตารางสอนเปิดอยู่:</strong> คลิกพิมพ์แก้ไขวิชา/ห้องในแต่ละช่องได้เหมือน Excel เมื่อแก้ไขเสร็จแล้วกด <strong>"บันทึกข้อมูล"</strong></span>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-200 text-amber-950 border border-amber-400 self-start sm:self-auto shadow-2xs">
              <span class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
              <span>กำลังแก้ไขวัน${selectedDay}</span>
            </span>
          </div>
        ` : `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-800 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
            <div class="flex items-center gap-2">
              <i data-lucide="info" class="w-4 h-4 text-indigo-600 shrink-0"></i>
              <span>กำลังแสดงตารางสอน<strong>วัน${selectedDay}</strong> — กดปุ่ม <strong>"แก้ไขตารางสอน"</strong> หรือคลิกที่ช่องตารางเพื่อแก้ไขข้อมูลเหมือน Excel</span>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${currentDayConfig.badgeClass} self-start sm:self-auto shadow-2xs">
              <span class="w-2 h-2 rounded-full ${currentDayConfig.dotClass}"></span>
              <span>วัน${selectedDay} (${currentDayConfig.colorName})</span>
            </span>
          </div>
        `}

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
                        ${isSheetEditMode ? `
                          <input type="text" value="${teacherName}" 
                            class="teacher-name-input sheet-cell-edit-input flex-1 py-1 px-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-2xs focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            data-index="${tIdx}" data-oldname="${teacherName}">
                        ` : `
                          <span class="view-mode-cell font-bold text-slate-800 py-1 px-1.5 cursor-pointer hover:text-indigo-600 transition-colors"
                            data-tindex="${tIdx}" data-type="teacher" title="คลิกเพื่อแก้ไขตารางสอน">
                            ${teacherName}
                          </span>
                        `}
                      </div>
                    </td>
                    ${activePeriods.map((period, pIdx) => {
                      const val = teacherRow[pIdx] || "";
                      return `
                        <td class="p-1 ${period.isBreak ? 'bg-amber-100/50' : band.cellBg}">
                          ${isSheetEditMode ? `
                            <input type="text" value="${val}" 
                              placeholder="${period.isBreak ? 'พักกลางวัน' : '-'}" 
                              class="grid-cell-input sheet-cell-edit-input w-full py-1.5 px-2 text-center text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-2xs hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                              data-tindex="${tIdx}" data-pindex="${pIdx}">
                          ` : `
                            <div class="view-mode-cell py-1.5 px-2 text-center text-xs font-semibold text-slate-800 cursor-pointer hover:bg-white/80 hover:text-indigo-700 transition-all select-none rounded-lg"
                              data-tindex="${tIdx}" data-pindex="${pIdx}" title="คลิกเพื่อแก้ไขตารางสอน">
                              ${val ? val : (period.isBreak ? '<span class="text-amber-800/60 font-medium">พักกลางวัน</span>' : '<span class="text-slate-400 font-normal">-</span>')}
                            </div>
                          `}
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

    // Toggle Edit Mode Button
    const btnToggleEdit = document.getElementById('btn-toggle-edit-sheet');
    if (btnToggleEdit) {
      btnToggleEdit.addEventListener('click', () => {
        isSheetEditMode = true;
        originalTimetablesSnapshot = JSON.parse(JSON.stringify(activeTimetables));
        originalTeachersSnapshot = [...activeTeachers];
        renderSpreadsheetTab(container);
      });
    }

    // Cancel Edit Mode Button
    const btnCancelEdit = document.getElementById('btn-cancel-edit-sheet');
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', () => {
        if (originalTimetablesSnapshot) {
          activeTimetables = JSON.parse(JSON.stringify(originalTimetablesSnapshot));
        }
        if (originalTeachersSnapshot) {
          activeTeachers = [...originalTeachersSnapshot];
        }
        isSheetEditMode = false;
        renderSpreadsheetTab(container);
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("ยกเลิกการแก้ไขตารางสอนแล้ว", "info");
        }
      });
    }

    // Click cell in View Mode to quickly enter Edit Mode and focus that cell
    if (!isSheetEditMode) {
      container.querySelectorAll('.view-mode-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const tIdx = cell.dataset.tindex;
          const pIdx = cell.dataset.pindex;
          const isTeacher = cell.dataset.type === 'teacher';
          isSheetEditMode = true;
          originalTimetablesSnapshot = JSON.parse(JSON.stringify(activeTimetables));
          originalTeachersSnapshot = [...activeTeachers];
          renderSpreadsheetTab(container);
          setTimeout(() => {
            const input = isTeacher
              ? container.querySelector(`.teacher-name-input[data-index="${tIdx}"]`)
              : container.querySelector(`.grid-cell-input[data-tindex="${tIdx}"][data-pindex="${pIdx}"]`);
            if (input) {
              input.focus();
              input.select();
            }
          }, 60);
        });
      });
    }

    container.querySelectorAll('.sheet-day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (isSheetEditMode) {
          // Collect latest values before switching days
          container.querySelectorAll('.grid-cell-input').forEach(input => {
            const tIdx = parseInt(input.dataset.tindex);
            const pIdx = parseInt(input.dataset.pindex);
            if (!isNaN(tIdx) && !isNaN(pIdx)) {
              if (!activeTimetables[selectedDay]) activeTimetables[selectedDay] = [];
              if (!activeTimetables[selectedDay][tIdx]) activeTimetables[selectedDay][tIdx] = ["", "", "", "", "", "", ""];
              activeTimetables[selectedDay][tIdx][pIdx] = input.value;
            }
          });
        }
        selectedDay = e.currentTarget.dataset.day;
        renderSpreadsheetTab(container);
      });
    });

    container.querySelectorAll('.sheet-grade-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (isSheetEditMode) {
          container.querySelectorAll('.grid-cell-input').forEach(input => {
            const tIdx = parseInt(input.dataset.tindex);
            const pIdx = parseInt(input.dataset.pindex);
            if (!isNaN(tIdx) && !isNaN(pIdx)) {
              if (!activeTimetables[selectedDay]) activeTimetables[selectedDay] = [];
              if (!activeTimetables[selectedDay][tIdx]) activeTimetables[selectedDay][tIdx] = ["", "", "", "", "", "", ""];
              activeTimetables[selectedDay][tIdx][pIdx] = input.value;
            }
          });
        }
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
      input.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.dataset.index);
        const oldName = e.target.dataset.oldname || activeTeachers[idx];
        const newName = e.target.value.trim();
        if (newName && newName !== oldName) {
          activeTeacherGrades[newName] = activeTeacherGrades[oldName] || "ป.1-3";
          delete activeTeacherGrades[oldName];
          activeTeachers[idx] = newName;
          e.target.dataset.oldname = newName;
          try {
            await saveTeacherRosterAndTimetables();
            showRosterSaveResult();
          } catch (error) {
            showRosterSaveResult(error);
          }
        }
      });
    });

    document.getElementById('btn-add-teacher-row').addEventListener('click', async () => {
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
        try {
          await saveTeacherRosterAndTimetables();
          showRosterSaveResult();
        } catch (error) {
          showRosterSaveResult(error);
        }
      }
    });

    container.querySelectorAll('.btn-delete-teacher-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const name = activeTeachers[idx];

        const doDelete = async () => {
          delete activeTeacherGrades[name];
          activeTeachers.splice(idx, 1);
          const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          daysList.forEach(d => {
            if (activeTimetables[d]) activeTimetables[d].splice(idx, 1);
          });
          renderSpreadsheetTab(container);
          try {
            await saveTeacherRosterAndTimetables();
            showRosterSaveResult();
          } catch (error) {
            showRosterSaveResult(error);
          }
        };

        const confirmFn = (global.TeachApp && global.TeachApp.requestAdminPinConfirm) || global.requestAdminPinConfirm;
        if (confirmFn) {
          confirmFn({
            title: `ยืนยันลบคุณครูออกจากระบบ`,
            subtitle: "กรุณากรอกรหัสแอดมิน 4 หลัก เพื่อยืนยันการลบคุณครูและตารางสอน",
            detailHtml: `
              <div class="flex items-center gap-2 mb-2 font-bold text-slate-800 text-sm">
                <i data-lucide="user-minus" class="w-4 h-4 text-rose-500"></i>
                <span>ต้องการลบคุณครู: <span class="text-rose-600 font-black">${name}</span></span>
              </div>
              <div class="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200/80 leading-relaxed">
                ⚠️ การลบจะนำชื่อคุณครู ข้อมูลช่วงชั้น และตารางสอนทั้งหมดของคุณครูท่านนี้ออกจากระบบทันที
              </div>
            `,
            confirmButtonText: "ยืนยันลบคุณครู",
            onConfirm: doDelete
          });
        } else {
          if (confirm(`ต้องการลบคุณครู "${name}" ออกจากระบบใช่หรือไม่?`)) {
            await doDelete();
          }
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
        // Collect latest teacher names from table
        container.querySelectorAll('.teacher-name-input').forEach(input => {
          const idx = parseInt(input.dataset.index);
          const oldName = input.dataset.oldname;
          const newName = input.value.trim();
          if (!isNaN(idx) && newName && newName !== oldName) {
            activeTeacherGrades[newName] = activeTeacherGrades[oldName] || "ป.1-3";
            delete activeTeacherGrades[oldName];
            activeTeachers[idx] = newName;
            input.dataset.oldname = newName;
          }
        });

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
          
          isSheetEditMode = false;
          originalTimetablesSnapshot = null;
          originalTeachersSnapshot = null;
          renderSpreadsheetTab(container);

          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("บันทึกข้อมูลตารางสอนเรียบร้อยแล้ว", "success");
          }
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
                กำหนดช่วงชั้น (อนุบาล, ป.1-3, ป.4-6, ม.1-3, ม.4-6) เพื่อเติมแถบสีแยกกลุ่มในหน้า <strong>ตารางสอน</strong> อัตโนมัติ
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
          if (saveAllTimetables) await saveAllTimetables(activeTimetables, activeTeachers);
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
          if (saveAllTimetables) await saveAllTimetables(activeTimetables, activeTeachers);
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

        const doDelete = async () => {
          delete activeTeacherGrades[name];
          activeTeachers.splice(idx, 1);
          const daysList = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          daysList.forEach(d => {
            if (activeTimetables[d]) activeTimetables[d].splice(idx, 1);
          });
          await saveTeachers(activeTeachers);
          if (saveTeacherGrades) await saveTeacherGrades(activeTeacherGrades);
          if (saveAllTimetables) await saveAllTimetables(activeTimetables, activeTeachers);
          renderPeriodsTab(container);
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast(`ลบคุณครู "${name}" เรียบร้อยแล้ว`, "info");
          }
        };

        const confirmFn = (global.TeachApp && global.TeachApp.requestAdminPinConfirm) || global.requestAdminPinConfirm;
        if (confirmFn) {
          confirmFn({
            title: `ยืนยันลบคุณครูจากตารางสอน`,
            subtitle: "กรุณากรอกรหัสแอดมิน 4 หลัก เพื่อยืนยันการลบคุณครูและตารางสอน",
            detailHtml: `
              <div class="flex items-center gap-2 mb-2 font-bold text-slate-800 text-sm">
                <i data-lucide="user-minus" class="w-4 h-4 text-rose-500"></i>
                <span>ต้องการลบคุณครู: <span class="text-rose-600 font-black">${name}</span></span>
              </div>
              <div class="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200/80 leading-relaxed">
                ⚠️ การลบจะนำชื่อคุณครู ข้อมูลช่วงชั้น และตารางสอนทั้งหมดของคุณครูท่านนี้ออกจากระบบทันที
              </div>
            `,
            confirmButtonText: "ยืนยันลบคุณครู",
            onConfirm: doDelete
          });
        } else {
          if (confirm(`ต้องการลบคุณครู "${name}" ออกจากระบบใช่หรือไม่?`)) {
            await doDelete();
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

            <!-- แถบปรับขนาดโลโก้ในใบเอกสาร -->
            <div class="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2">
                <i data-lucide="maximize-2" class="w-4 h-4 text-indigo-500"></i>
                <span class="font-bold text-slate-700">ขนาดความสูงของโลโก้ในเอกสารราชการ:</span>
                <span id="cfg-logo-height-val" class="px-2.5 py-0.5 rounded-lg font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-xs">
                  ${(s.logoHeight && s.logoHeight >= 80 && s.logoHeight !== 150) ? s.logoHeight : 120} px
                </span>
              </div>
              <div class="flex items-center gap-2.5 w-full sm:w-auto">
                <span class="text-[11px] text-slate-400 font-semibold">80px (เล็ก)</span>
                <input type="range" id="cfg-logo-height-slider" min="80" max="180" step="5"
                  value="${(s.logoHeight && s.logoHeight >= 80 && s.logoHeight !== 150) ? s.logoHeight : 120}"
                  class="flex-1 sm:w-44 accent-indigo-600 cursor-pointer">
                <span class="text-[11px] text-slate-400 font-semibold">180px (ใหญ่)</span>
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

    const logoSlider = container.querySelector('#cfg-logo-height-slider');
    const logoHeightVal = container.querySelector('#cfg-logo-height-val');
    if (logoSlider && logoHeightVal) {
      logoSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 120;
        logoHeightVal.innerText = `${val} px`;
        activeSettings.logoHeight = val;
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

        if (logoSlider) {
          activeSettings.logoHeight = parseInt(logoSlider.value) || 120;
        }

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
              b.className = "btn-save-school-action btn-press hover-lift-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0";
              b.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${idx === 0 ? 'บันทึกข้อมูล' : 'บันทึกข้อมูลโรงเรียน'}</span>`;
            });
            if (window.lucide) window.lucide.createIcons();
          }, 2400);
        } catch (e) {
          saveBtns.forEach((b, idx) => {
            b.disabled = false;
            b.className = "btn-save-school-action btn-press hover-lift-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0";
            b.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${idx === 0 ? 'บันทึกข้อมูล' : 'บันทึกข้อมูลโรงเรียน'}</span>`;
          });
          if (window.lucide) window.lucide.createIcons();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("เกิดข้อผิดพลาด: " + e.message, "error");
          }
        }
      });
    });

    // Dirty state tracker for School Settings
    const schoolInputs = [
      'cfg-school-name', 'cfg-subdistrict', 'cfg-district', 'cfg-province', 'cfg-postal',
      'cfg-academic-rank', 'cfg-academic-head', 'cfg-academic-pos',
      'cfg-director-rank', 'cfg-director-name', 'cfg-director-pos',
      'cfg-doc-subject', 'cfg-doc-dear', 'cfg-new-pin'
    ];

    const updateSchoolDirtyUI = () => {
      const s = activeSettings || {};
      let isDirty = false;

      const checkField = (id, origVal) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const cur = el.value.trim();
        const orig = String(origVal || '').trim();
        const changed = cur !== orig;
        if (changed) {
          el.classList.add('border-amber-400', 'ring-2', 'ring-amber-200/70', 'bg-amber-50/20');
          el.classList.remove('border-slate-200');
        } else {
          el.classList.remove('border-amber-400', 'ring-2', 'ring-amber-200/70', 'bg-amber-50/20');
          el.classList.add('border-slate-200');
        }
        return changed;
      };

      if (checkField('cfg-school-name', s.schoolName)) isDirty = true;
      if (checkField('cfg-subdistrict', s.subdistrict)) isDirty = true;
      if (checkField('cfg-district', s.district)) isDirty = true;
      if (checkField('cfg-province', s.province)) isDirty = true;
      if (checkField('cfg-postal', s.postalCode)) isDirty = true;
      if (checkField('cfg-academic-rank', s.academicHeadRank || 'ลงชื่อ')) isDirty = true;
      if (checkField('cfg-academic-head', s.academicHeadName)) isDirty = true;
      if (checkField('cfg-academic-pos', s.academicHeadPosition)) isDirty = true;
      if (checkField('cfg-director-rank', s.directorRank)) isDirty = true;
      if (checkField('cfg-director-name', s.directorName)) isDirty = true;
      if (checkField('cfg-director-pos', s.directorPosition)) isDirty = true;
      if (checkField('cfg-doc-subject', s.docSubject)) isDirty = true;
      if (checkField('cfg-doc-dear', s.docDear)) isDirty = true;
      const pinEl = document.getElementById('cfg-new-pin');
      if (pinEl && pinEl.value.trim()) isDirty = true;

      const saveBtns = container.querySelectorAll('.btn-save-school-action');
      saveBtns.forEach((b, idx) => {
        if (isDirty) {
          b.className = "btn-save-school-action btn-press px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-md shadow-orange-500/30 ring-2 ring-amber-300 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse shrink-0";
          b.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-white"></i><span>⚠️ ยังไม่ได้บันทึก — กดบันทึกข้อมูล</span>`;
        } else {
          b.className = "btn-save-school-action btn-press hover-lift-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0";
          b.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${idx === 0 ? 'บันทึกข้อมูล' : 'บันทึกข้อมูลโรงเรียน'}</span>`;
        }
      });

      if (window.lucide) window.lucide.createIcons();
    };

    schoolInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateSchoolDirtyUI);
        el.addEventListener('change', updateSchoolDirtyUI);
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // =============================================================
  // Academic Calendar & Semester Teaching Load Calculator
  // =============================================================

  function formatHolidayDateDisplay(dateStr) {
    if (!dateStr) return { text: "-", dayName: "-", isWeekday: false };
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return { text: dateStr, dayName: "-", isWeekday: false };
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return { text: dateStr, dayName: "-", isWeekday: false };

    const thaiShortMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
    const dayOfWeek = thaiDays[d.getDay()];
    const isWeekday = d.getDay() >= 1 && d.getDay() <= 5;
    const text = `${d.getDate()} ${thaiShortMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
    return { text, dayName: dayOfWeek, isWeekday };
  }

  function computeCalendarStats(calData) {
    const cal = calData || activeCalendar || DEFAULT_ACADEMIC_CALENDAR;
    const startDateStr = cal.startDate || '2026-05-16';
    const endDateStr = cal.endDate || '2026-10-10';

    const dayNameMap = {
      1: "จันทร์",
      2: "อังคาร",
      3: "พุธ",
      4: "พฤหัสบดี",
      5: "ศุกร์"
    };

    const dayCounts = {
      "จันทร์": 0,
      "อังคาร": 0,
      "พุธ": 0,
      "พฤหัสบดี": 0,
      "ศุกร์": 0
    };

    const holidays = Array.isArray(cal.holidays) ? cal.holidays : [];
    const holidayDateMap = new Map();
    holidays.forEach(h => {
      if (h && h.date) holidayDateMap.set(h.date, h);
    });

    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    let totalDays = 0;
    let teachingDays = 0;
    let weekdayHolidaysCount = 0;
    let totalHolidaysInRange = 0;

    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const cur = new Date(start.getTime());
      while (cur <= end) {
        totalDays++;
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        const dayOfWeek = cur.getDay();

        const isHoliday = holidayDateMap.has(dateKey);

        if (isHoliday) {
          totalHolidaysInRange++;
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            weekdayHolidaysCount++;
          }
        } else {
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            teachingDays++;
            const dayName = dayNameMap[dayOfWeek];
            if (dayName) {
              dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
            }
          }
        }

        cur.setDate(cur.getDate() + 1);
      }
    }

    const weeks = Math.floor(totalDays / 7);
    const remDays = totalDays % 7;
    const weeksDisplay = remDays > 0 ? `${weeks} สัปดาห์ ${remDays} วัน` : `${weeks} สัปดาห์`;

    return {
      startDateStr,
      endDateStr,
      totalDays,
      weeksDisplay,
      teachingDays,
      weekdayHolidaysCount,
      totalHolidaysInRange,
      dayCounts
    };
  }

  function computeTeacherSemesterLoads(dayCounts) {
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const teachers = Array.isArray(activeTeachers) ? activeTeachers : [];
    const timetables = activeTimetables || {};
    const periods = Array.isArray(activePeriods) ? activePeriods : [];
    const teacherGrades = activeTeacherGrades || {};

    return teachers.map((teacherName, tIdx) => {
      const grade = teacherGrades[teacherName] || 'ป.1-3';
      const dayPeriods = {
        "จันทร์": 0,
        "อังคาร": 0,
        "พุธ": 0,
        "พฤหัสบดี": 0,
        "ศุกร์": 0
      };

      days.forEach(day => {
        const daySchedule = (timetables[day] && timetables[day][tIdx]) || [];
        let count = 0;
        periods.forEach((period, pIdx) => {
          if (period && !period.isBreak) {
            const raw = String(daySchedule[pIdx] || '').trim();
            if (raw && raw !== '-' && raw !== 'พัก' && raw !== 'พักกลางวัน') {
              count++;
            }
          }
        });
        dayPeriods[day] = count;
      });

      const weeklyTotal = days.reduce((sum, d) => sum + dayPeriods[d], 0);

      const semesterTotal = days.reduce((sum, d) => {
        const dCount = dayCounts[d] || 0;
        return sum + (dayPeriods[d] * dCount);
      }, 0);

      // คำนวณคาบลา (-) และคาบสอนแทน (+) ในภาคเรียนนี้
      const subs = Array.isArray(activeSubstitutions) ? activeSubstitutions : [];
      const cal = activeCalendar || DEFAULT_ACADEMIC_CALENDAR;
      const start = cal.startDate;
      const end = cal.endDate;

      let leavePeriods = 0;
      let subPeriods = 0;
      const cleanName = String(teacherName || '').trim();

      subs.forEach(r => {
        if (!r) return;
        if (r.date) {
          if (start && r.date < start) return;
          if (end && r.date > end) return;
        }

        const pId = Number(r.periodId || 0);
        if (pId <= 0) return;

        // 1. คาบที่ครูท่านนี้ลา (ขาดการสอนตามตาราง)
        const absent = String(r.absentTeacher || '').trim();
        if (absent === cleanName) {
          leavePeriods++;
        }

        // 2. คาบที่ครูท่านนี้ไปสอนแทนครูท่านอื่น
        const sub = String(r.substituteTeacher || '').trim();
        if (sub === cleanName && !sub.includes('--') && sub !== 'ไม่มีผู้สอนแทน' && sub !== 'ติดสอน') {
          subPeriods++;
        }
      });

      // 3. รวมคาบสอนจริงสุทธิ (เอาคาบทั้งหมดมาบวกลบ)
      const actualPeriods = semesterTotal - leavePeriods + subPeriods;

      // 4. คิดเปอร์เซ็นต์คาบที่สอนจริงเทียบกับคาบรวมตั้งต้น
      const actualPercent = semesterTotal > 0
        ? (actualPeriods / semesterTotal) * 100
        : (actualPeriods > 0 ? 100 : 0);

      return {
        teacherName,
        teacherIndex: tIdx,
        grade,
        dayPeriods,
        weeklyTotal,
        semesterTotal,
        leavePeriods,
        subPeriods,
        actualPeriods,
        actualPercent
      };
    });
  }

  function renderCalendarTab(container) {
    if (!activeCalendar) {
      activeCalendar = { ...DEFAULT_ACADEMIC_CALENDAR };
    }
    if (!activeCalendar.holidays) {
      activeCalendar.holidays = [];
    }

    const cal = activeCalendar;
    const stats = computeCalendarStats(cal);

    // Sorted holidays
    const holidaysSorted = [...cal.holidays].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Date displays in Thai
    const startFormatted = formatHolidayDateDisplay(cal.startDate);
    const endFormatted = formatHolidayDateDisplay(cal.endDate);

    container.innerHTML = `
      <div class="space-y-6 w-full">

        <!-- Section 1: ปฏิทินภาคเรียน & กำหนดวันเปิด-ปิดภาคเรียน (Semester Settings & Header) -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 class="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span class="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <i data-lucide="calendar-days" class="w-5 h-5"></i>
                </span>
                ปฏิทินภาคเรียน & ตารางวันหยุด
              </h3>
              <p class="text-xs text-slate-500 mt-1">
                กำหนดวันเปิด-ปิดภาคเรียน จัดการวันหยุดนักขัตฤกษ์ วันหยุดสถานศึกษา และกิจกรรมงดการเรียนการสอน
              </p>
            </div>
            <span id="cal-date-range-badge" class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/70 inline-flex items-center gap-1.5 transition-all self-start sm:self-center shrink-0">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i>
              ${startFormatted.text} – ${endFormatted.text}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label for="cal-academic-year" class="block text-xs font-bold text-slate-700 mb-1.5">ปีการศึกษา</label>
              <input type="text" id="cal-academic-year" value="${cal.academicYear || '2569'}" placeholder="เช่น 2569"
                class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs">
            </div>

            <div>
              <label for="cal-term" class="block text-xs font-bold text-slate-700 mb-1.5">ภาคเรียน</label>
              <select id="cal-term"
                class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs">
                <option value="1" ${cal.term === '1' ? 'selected' : ''}>ภาคเรียนที่ 1</option>
                <option value="2" ${cal.term === '2' ? 'selected' : ''}>ภาคเรียนที่ 2</option>
                <option value="ฤดูร้อน" ${cal.term === 'ฤดูร้อน' ? 'selected' : ''}>ภาคเรียนฤดูร้อน (Summer)</option>
              </select>
            </div>

            <div>
              <label for="cal-start-date" class="block text-xs font-bold text-slate-700 mb-1.5">วันเปิดภาคเรียน</label>
              <input type="date" id="cal-start-date" value="${cal.startDate || '2026-05-16'}"
                class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs">
            </div>

            <div>
              <label for="cal-end-date" class="block text-xs font-bold text-slate-700 mb-1.5">วันปิดภาคเรียน</label>
              <input type="date" id="cal-end-date" value="${cal.endDate || '2026-10-10'}"
                class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs">
            </div>
          </div>

          <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
            <span class="flex items-center gap-1.5">
              <i data-lucide="info" class="w-4 h-4 text-emerald-600 shrink-0"></i>
              ระบบจะนำช่วงวันเปิด-ปิดภาคเรียน ไปคำนวณวันเรียนจริง (จันทร์-ศุกร์) โดยหักวันหยุดนักขัตฤกษ์และวันหยุดสถานศึกษาออกโดยอัตโนมัติ
            </span>
            <button type="button" id="btn-save-calendar-sub"
              class="btn-press px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>
        </div>

        <!-- Section 2: ภาพรวมและสถิติจำนวนวันเรียนในภาคเรียน (Semester Statistics) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <!-- Metric 1: ระยะเวลาภาคเรียน -->
          <div class="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ระยะเวลาภาคเรียน</div>
              <div class="text-base sm:text-lg font-black text-slate-800 leading-tight">${stats.totalDays} วัน</div>
              <div class="text-[11px] text-indigo-600 font-bold mt-0.5">${stats.weeksDisplay}</div>
            </div>
          </div>

          <!-- Metric 2: วันเปิดเรียนจริง (หักวันหยุด) -->
          <div class="glass-card rounded-2xl p-4 sm:p-5 border border-emerald-200/80 bg-emerald-50/20 shadow-2xs flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="check-circle-2" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">วันเปิดเรียนจริง (จ.-ศ.)</div>
              <div class="text-base sm:text-lg font-black text-emerald-800 leading-tight">${stats.teachingDays} วันเรียน</div>
              <div class="text-[11px] text-emerald-600 font-bold mt-0.5">หักวันหยุดแล้ว</div>
            </div>
          </div>

          <!-- Metric 3: วันหยุดในภาคเรียน (ตรง จ.-ศ.) -->
          <div class="glass-card rounded-2xl p-4 sm:p-5 border border-rose-200/80 bg-rose-50/20 shadow-2xs flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="sun" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">วันหยุดในภาคเรียน</div>
              <div class="text-base sm:text-lg font-black text-rose-800 leading-tight">${stats.weekdayHolidaysCount} วัน</div>
              <div class="text-[11px] text-rose-600 font-bold mt-0.5">กระทบวันเรียน จ.-ศ.</div>
            </div>
          </div>
        </div>

        <!-- Section 3: ตารางวันหยุดและงดการเรียนการสอน (Holidays Table) -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 class="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <span class="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <i data-lucide="calendar-off" class="w-4 h-4"></i>
                </span>
                วันหยุดนักขัตฤกษ์ วันหยุดสถานศึกษา และกิจกรรมงดการเรียนการสอน
              </h4>
              <p class="text-xs text-slate-500 mt-0.5">
                วันหยุดที่ตรงกับวันจันทร์-ศุกร์ จะถูกหักออกจากจำนวนวันเรียนจริงเพื่อคำนวณคาบสอนอย่างแม่นยำ
              </p>
            </div>
            <span class="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
              ทั้งหมด ${holidaysSorted.length} รายการ
            </span>
          </div>

          <!-- แบบฟอร์มเพิ่มวันหยุดใหม่ -->
          <form id="form-add-holiday" class="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600"></i>
              <span>เพิ่มวันหยุดใหม่ในภาคเรียน</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div class="sm:col-span-3">
                <label for="new-hol-date" class="block text-[11px] font-bold text-slate-600 mb-1">วันที่</label>
                <input type="date" id="new-hol-date" required
                  class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs">
              </div>

              <div class="sm:col-span-5">
                <label for="new-hol-name" class="block text-[11px] font-bold text-slate-600 mb-1">ชื่อวันหยุด / กิจกรรม</label>
                <input type="text" id="new-hol-name" required placeholder="เช่น วันเฉลิมพระชนมพรรษาฯ หรือ วันไหว้ครู (งดเรียน)"
                  class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs">
              </div>

              <div class="sm:col-span-2">
                <label for="new-hol-type" class="block text-[11px] font-bold text-slate-600 mb-1">ประเภท</label>
                <select id="new-hol-type"
                  class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs">
                  <option value="วันหยุดราชการ">วันหยุดราชการ</option>
                  <option value="วันหยุดสถานศึกษา">วันหยุดสถานศึกษา</option>
                  <option value="วันกิจกรรมงดสอน">วันกิจกรรมงดสอน</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <button type="submit" id="btn-add-holiday"
                  class="w-full btn-press px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <i data-lucide="plus" class="w-4 h-4"></i>
                  <span>เพิ่มวันหยุด</span>
                </button>
              </div>
            </div>
          </form>

          <!-- ตารางแสดงรายการวันหยุด -->
          <div class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div class="overflow-x-auto max-h-80 overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-10">
                  <tr>
                    <th class="py-3 px-3 text-center w-12">ลำดับ</th>
                    <th class="py-3 px-3 w-36">วันที่</th>
                    <th class="py-3 px-3 w-32">วันในสัปดาห์</th>
                    <th class="py-3 px-3">ชื่อวันหยุด / กิจกรรม</th>
                    <th class="py-3 px-3 w-36">ประเภท</th>
                    <th class="py-3 px-3 w-44">ผลกระทบตารางสอน</th>
                    <th class="py-3 px-3 text-center w-16">ลบ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${holidaysSorted.length === 0 ? `
                    <tr>
                      <td colspan="7" class="py-8 text-center text-slate-400">
                        <i data-lucide="calendar-check-2" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                        ยังไม่มีรายการวันหยุดในภาคเรียนนี้ — สามารถเพิ่มวันหยุดได้ที่ช่องด้านบน
                      </td>
                    </tr>
                  ` : holidaysSorted.map((hol, idx) => {
                    const dInfo = formatHolidayDateDisplay(hol.date);
                    const dayCfg = THAI_DAY_CONFIG[dInfo.dayName] || { badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', dotClass: 'bg-slate-400' };

                    let typeBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (hol.type === 'วันหยุดราชการ') typeBadge = 'bg-rose-100 text-rose-800 border-rose-200';
                    else if (hol.type === 'วันหยุดสถานศึกษา') typeBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                    else if (hol.type === 'วันกิจกรรมงดสอน') typeBadge = 'bg-indigo-100 text-indigo-800 border-indigo-200';

                    return `
                      <tr class="hover:bg-slate-50/80 transition-colors">
                        <td class="py-2.5 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800 font-mono text-[12px]">${dInfo.text}</td>
                        <td class="py-2.5 px-3">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${dayCfg.badgeClass}">
                            <span class="w-1.5 h-1.5 rounded-full ${dayCfg.dotClass}"></span>
                            วัน${dInfo.dayName}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800">${hol.name || '-'}</td>
                        <td class="py-2.5 px-3">
                          <span class="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeBadge}">
                            ${hol.type || 'วันหยุดราชการ'}
                          </span>
                        </td>
                        <td class="py-2.5 px-3">
                          ${dInfo.isWeekday ? `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <i data-lucide="bell" class="w-3 h-3 text-amber-600"></i> กระทบวันเรียน (จ.-ศ.)
                            </span>
                          ` : `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <i data-lucide="moon" class="w-3 h-3 text-slate-400"></i> เสาร์-อาทิตย์
                            </span>
                          `}
                        </td>
                        <td class="py-2.5 px-3 text-center">
                          <button type="button" data-id="${hol.id}"
                            class="btn-delete-holiday p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="ลบวันหยุดนี้">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
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

      </div>
    `;

    // -----------------------------------------------------------
    // Wire Events in Calendar Tab
    // -----------------------------------------------------------

    const handleSaveCalendarSettings = async () => {
      const year = document.getElementById('cal-academic-year').value.trim();
      const term = document.getElementById('cal-term').value.trim();
      const startDate = document.getElementById('cal-start-date').value;
      const endDate = document.getElementById('cal-end-date').value;

      if (!year || !startDate || !endDate) {
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("กรุณากรอกข้อมูลปีการศึกษา วันเปิดและปิดภาคเรียนให้ครบถ้วน", "error");
        }
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("วันเปิดภาคเรียนต้องอยู่ก่อนวันปิดภาคเรียน", "error");
        }
        return;
      }

      activeCalendar.academicYear = year;
      activeCalendar.term = term;
      activeCalendar.startDate = startDate;
      activeCalendar.endDate = endDate;

      try {
        if (btnSubSave) {
          btnSubSave.disabled = true;
          btnSubSave.className = "btn-press px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5";
          btnSubSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังบันทึก...</span>`;
        }
        if (btnMainSave) {
          btnMainSave.disabled = true;
          btnMainSave.className = "btn-press px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5";
          btnMainSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>กำลังบันทึก...</span>`;
        }
        if (window.lucide) window.lucide.createIcons();

        if (saveAcademicCalendar) {
          await saveAcademicCalendar(activeCalendar);
        }
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("บันทึกการตั้งค่าปฏิทินภาคเรียนเรียบร้อยแล้ว", "success");
        }

        if (btnSubSave) {
          btnSubSave.className = "btn-press px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5";
          btnSubSave.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกสำเร็จ!</span>`;
        }
        if (btnMainSave) {
          btnMainSave.className = "btn-press px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5";
          btnMainSave.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>บันทึกสำเร็จ!</span>`;
        }
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
          renderCalendarTab(container);
        }, 600);
      } catch (err) {
        if (btnSubSave) btnSubSave.disabled = false;
        if (btnMainSave) btnMainSave.disabled = false;
        updateCalendarDirtyUI();
        if (global.TeachApp && global.TeachApp.showToast) {
          global.TeachApp.showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
        }
      }
    };

    const btnMainSave = document.getElementById('btn-save-calendar-main');
    if (btnMainSave) btnMainSave.addEventListener('click', handleSaveCalendarSettings);

    const btnSubSave = document.getElementById('btn-save-calendar-sub');
    if (btnSubSave) btnSubSave.addEventListener('click', handleSaveCalendarSettings);

    // Dirty state tracker for Calendar form inputs
    const yearEl = document.getElementById('cal-academic-year');
    const termEl = document.getElementById('cal-term');
    const startEl = document.getElementById('cal-start-date');
    const endEl = document.getElementById('cal-end-date');
    const dateRangeBadge = document.getElementById('cal-date-range-badge');

    const updateCalendarDirtyUI = () => {
      if (!yearEl || !termEl || !startEl || !endEl) return;

      const currentYear = yearEl.value.trim();
      const currentTerm = termEl.value.trim();
      const currentStart = startEl.value;
      const currentEnd = endEl.value;

      const origYear = String(activeCalendar.academicYear || '2569').trim();
      const origTerm = String(activeCalendar.term || '1').trim();
      const origStart = String(activeCalendar.startDate || '2026-05-16').trim();
      const origEnd = String(activeCalendar.endDate || '2026-10-10').trim();

      const yearChanged = currentYear !== origYear;
      const termChanged = currentTerm !== origTerm;
      const startChanged = currentStart !== origStart;
      const endChanged = currentEnd !== origEnd;
      const isDirty = yearChanged || termChanged || startChanged || endChanged;

      const toggleInputDirty = (el, changed) => {
        if (!el) return;
        if (changed) {
          el.classList.add('border-amber-400', 'ring-2', 'ring-amber-200/70', 'bg-amber-50/30');
          el.classList.remove('border-slate-200');
        } else {
          el.classList.remove('border-amber-400', 'ring-2', 'ring-amber-200/70', 'bg-amber-50/30');
          el.classList.add('border-slate-200');
        }
      };

      toggleInputDirty(yearEl, yearChanged);
      toggleInputDirty(termEl, termChanged);
      toggleInputDirty(startEl, startChanged);
      toggleInputDirty(endEl, endChanged);

      // Sub save button (inside card)
      if (btnSubSave) {
        if (isDirty) {
          btnSubSave.className = "btn-press px-4 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-orange-500/30 ring-2 ring-amber-300 animate-pulse flex items-center gap-1.5 cursor-pointer";
          btnSubSave.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-white"></i><span>⚠️ ยังไม่ได้บันทึก — กดบันทึกการตั้งค่า</span>`;
        } else {
          btnSubSave.className = "btn-press px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer";
          btnSubSave.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>บันทึกการตั้งค่า</span>`;
        }
      }

      // Main save button (top header)
      if (btnMainSave) {
        if (isDirty) {
          btnMainSave.className = "btn-press hover-lift-sm px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-md shadow-orange-500/30 ring-2 ring-amber-300 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse";
          btnMainSave.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-white"></i><span>⚠️ ยังไม่ได้บันทึก — กดบันทึกข้อมูลปฏิทิน</span>`;
        } else {
          btnMainSave.className = "btn-press hover-lift-sm px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer";
          btnMainSave.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>บันทึกข้อมูลปฏิทิน</span>`;
        }
      }

      // Date range pill in card header
      if (dateRangeBadge) {
        const curStartInfo = formatHolidayDateDisplay(currentStart);
        const curEndInfo = formatHolidayDateDisplay(currentEnd);
        if (isDirty) {
          dateRangeBadge.className = "text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 inline-flex items-center gap-1.5 shadow-2xs";
          dateRangeBadge.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-600"></i> ${curStartInfo.text} – ${curEndInfo.text} <span class="text-[10px] text-amber-700 font-semibold">(ยังไม่บันทึก)</span>`;
        } else {
          dateRangeBadge.className = "text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/70 inline-flex items-center gap-1";
          dateRangeBadge.innerHTML = `<i data-lucide="clock" class="w-3.5 h-3.5"></i> ${curStartInfo.text} – ${curEndInfo.text}`;
        }
      }

      if (window.lucide) window.lucide.createIcons();
    };

    [yearEl, termEl, startEl, endEl].forEach(el => {
      if (el) {
        el.addEventListener('input', updateCalendarDirtyUI);
        el.addEventListener('change', updateCalendarDirtyUI);
      }
    });

    // Form Add Holiday
    const formAddHoliday = document.getElementById('form-add-holiday');
    if (formAddHoliday) {
      formAddHoliday.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('new-hol-date').value;
        const name = document.getElementById('new-hol-name').value.trim();
        const type = document.getElementById('new-hol-type').value;

        if (!date || !name) {
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("กรุณากรอกวันที่และชื่อวันหยุด", "error");
          }
          return;
        }

        const newHol = {
          id: 'hol_' + Date.now(),
          date,
          name,
          type
        };

        if (!activeCalendar.holidays) activeCalendar.holidays = [];
        activeCalendar.holidays.push(newHol);

        try {
          if (saveAcademicCalendar) {
            await saveAcademicCalendar(activeCalendar);
          }
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast(`เพิ่มวันหยุด "${name}" เรียบร้อยแล้ว`, "success");
          }
          renderCalendarTab(container);
        } catch (err) {
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("เกิดข้อผิดพลาด: " + err.message, "error");
          }
        }
      });
    }

    // Delete Holiday buttons
    container.querySelectorAll('.btn-delete-holiday').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        const hol = (activeCalendar.holidays || []).find(h => h.id === id);
        const name = hol ? hol.name : 'วันหยุด';

        const doDelete = async () => {
          activeCalendar.holidays = (activeCalendar.holidays || []).filter(h => h.id !== id);
          try {
            if (saveAcademicCalendar) {
              await saveAcademicCalendar(activeCalendar);
            }
            if (global.TeachApp && global.TeachApp.showToast) {
              global.TeachApp.showToast(`ลบ "${name}" แล้ว`, "success");
            }
            renderCalendarTab(container);
          } catch (err) {
            if (global.TeachApp && global.TeachApp.showToast) {
              global.TeachApp.showToast("เกิดข้อผิดพลาด: " + err.message, "error");
            }
          }
        };

        const confirmFn = (global.TeachApp && global.TeachApp.requestAdminPinConfirm) || global.requestAdminPinConfirm;
        if (confirmFn) {
          confirmFn({
            title: `ยืนยันลบวันหยุด`,
            subtitle: "กรุณากรอกรหัสแอดมิน 4 หลัก เพื่อยืนยันการลบวันหยุด",
            detailHtml: `
              <div class="flex items-center gap-2 mb-2 font-bold text-slate-800 text-sm">
                <i data-lucide="calendar-x" class="w-4 h-4 text-rose-500"></i>
                <span>ต้องการลบวันหยุด: <span class="text-rose-600 font-black">${name}</span></span>
              </div>
              <div class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-relaxed">
                <div>• <b>วันที่:</b> <span class="font-bold text-slate-800">${hol ? hol.date : '-'}</span></div>
                <div>• <b>ประเภท:</b> <span class="font-bold text-indigo-700">${hol ? hol.type : '-'}</span></div>
              </div>
            `,
            confirmButtonText: "ยืนยันลบวันหยุด",
            onConfirm: doDelete
          });
        } else {
          if (confirm(`ต้องการลบ "${name}" ใช่หรือไม่?`)) {
            await doDelete();
          }
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // TAB 5: TEACHING LOAD CALCULATION TAB (คำนวณคาบสอนจริง)
  // -------------------------------------------------------------

  function renderTeachingLoadTab(container) {
    const cal = activeCalendar || DEFAULT_ACADEMIC_CALENDAR;
    const stats = computeCalendarStats(cal);
    const allTeacherLoads = computeTeacherSemesterLoads(stats.dayCounts);

    // Thai date formats
    const startFormatted = formatHolidayDateDisplay(cal.startDate);
    const endFormatted = formatHolidayDateDisplay(cal.endDate);

    container.innerHTML = `
      <div class="space-y-6 w-full">

        <!-- Header Actions Card -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 class="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <i data-lucide="calculator" class="w-5 h-5"></i>
              </span>
              คำนวณคาบสอนจริงของข้าราชการครูรายภาคเรียน
            </h3>
            <p class="text-xs text-slate-500 mt-1">
              คำนวณจากตารางสอนและจำนวนวันเปิดเรียนจริงตามปฏิทินภาคเรียน (หักวันหยุดนักขัตฤกษ์และวันหยุดสถานศึกษาแล้ว)
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button type="button" id="btn-goto-calendar-from-load"
              class="btn-press hover-lift-sm px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="calendar-days" class="w-4 h-4 text-emerald-600"></i>
              <span>จัดการปฏิทิน & วันหยุด</span>
            </button>
            <button type="button" id="btn-print-load-report"
              class="btn-press hover-lift-sm px-4 sm:px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>พิมพ์รายงานภาระการสอน</span>
            </button>
          </div>
        </div>

        <!-- Semester Summary Info Ribbon -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/30 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
            <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <span class="font-bold text-slate-800">
                ภาคเรียนที่ ${cal.term || '1'} ปีการศึกษา ${cal.academicYear || '2569'}
              </span>
              <span class="text-slate-400">•</span>
              <span class="text-slate-600">
                ${startFormatted.text} – ${endFormatted.text}
              </span>
              <span class="text-slate-400">•</span>
              <span class="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                วันเปิดเรียนจริง ${stats.teachingDays} วัน
              </span>
            </div>
            <div class="text-[11px] text-slate-500">
              สูตร: คาบสอนจริงสุทธิ = คาบตั้งต้น - ลา (-) + สอนแทน (+)
            </div>
          </div>

          <!-- Day Counts Pills -->
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-[11px] font-bold text-slate-500 mr-1">จำนวนวันเรียนจริง:</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 font-bold">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span> วันจันทร์: ${stats.dayCounts['จันทร์']} วัน
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200/70 text-pink-900 font-bold">
              <span class="w-2 h-2 rounded-full bg-pink-500"></span> วันอังคาร: ${stats.dayCounts['อังคาร']} วัน
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-900 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> วันพุธ: ${stats.dayCounts['พุธ']} วัน
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200/70 text-orange-900 font-bold">
              <span class="w-2 h-2 rounded-full bg-orange-500"></span> วันพฤหัสบดี: ${stats.dayCounts['พฤหัสบดี']} วัน
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/70 text-sky-900 font-bold">
              <span class="w-2 h-2 rounded-full bg-sky-500"></span> วันศุกร์: ${stats.dayCounts['ศุกร์']} วัน
            </span>
          </div>
        </div>

        <!-- Teacher Semester Teaching Load Table -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 class="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <span class="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <i data-lucide="users" class="w-4 h-4"></i>
                </span>
                ตารางสรุปคาบสอนจริงของครูรายบุคคล
              </h4>
              <p class="text-xs text-slate-500 mt-0.5">
                เลือกกรองตามช่วงชั้น หรือพิมพ์ค้นหาชื่อคุณครูเพื่อตรวจสอบภาระงาน
              </p>
            </div>

            <!-- Toolbar: กรองช่วงชั้น & จัดเรียง & ค้นหา -->
            <div class="flex flex-wrap items-center gap-2">
              <!-- Filter ช่วงชั้น -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-slate-500 hidden sm:inline">ช่วงชั้น:</span>
                <select id="load-filter-grade"
                  class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs">
                  <option value="ALL" ${calendarTeacherGradeFilter === 'ALL' ? 'selected' : ''}>ช่วงชั้นทั้งหมด</option>
                  ${GRADE_BANDS.map(b => `<option value="${b.key}" ${calendarTeacherGradeFilter === b.key ? 'selected' : ''}>${b.key}</option>`).join('')}
                </select>
              </div>

              <!-- เรียงลำดับ -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-slate-500 hidden sm:inline">เรียงตาม:</span>
                <select id="load-sort-load"
                  class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs">
                  <option value="default" ${calendarSortOrder === 'default' ? 'selected' : ''}>ตามลำดับรายชื่อ</option>
                  <option value="desc" ${calendarSortOrder === 'desc' ? 'selected' : ''}>คาบสอนจริงมาก ➔ น้อย</option>
                  <option value="asc" ${calendarSortOrder === 'asc' ? 'selected' : ''}>คาบสอนจริงน้อย ➔ มาก</option>
                </select>
              </div>

              <!-- ค้นหาชื่อครู -->
              <div class="relative">
                <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <input type="text" id="load-search-teacher" value="${calendarTeacherSearch}" placeholder="ค้นหาชื่อคุณครู..."
                  class="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs w-36 sm:w-44">
              </div>
            </div>
          </div>

          <!-- Table Container -->
          <div id="teaching-load-table-wrap" class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th class="py-3 px-3 text-center w-12">ลำดับ</th>
                    <th class="py-3 px-3 min-w-[170px]">ชื่อ-สกุล ข้าราชการครู</th>
                    <th class="py-3 px-3 text-center w-24">ช่วงชั้น</th>
                    <th class="py-3 px-2 text-center w-12 bg-amber-50/50 text-amber-900" title="วันจันทร์ (${stats.dayCounts['จันทร์']} วัน)">จ</th>
                    <th class="py-3 px-2 text-center w-12 bg-pink-50/50 text-pink-900" title="วันอังคาร (${stats.dayCounts['อังคาร']} วัน)">อ</th>
                    <th class="py-3 px-2 text-center w-12 bg-emerald-50/50 text-emerald-900" title="วันพุธ (${stats.dayCounts['พุธ']} วัน)">พ</th>
                    <th class="py-3 px-2 text-center w-12 bg-orange-50/50 text-orange-900" title="วันพฤหัสบดี (${stats.dayCounts['พฤหัสบดี']} วัน)">พฤ</th>
                    <th class="py-3 px-2 text-center w-12 bg-sky-50/50 text-sky-900" title="วันศุกร์ (${stats.dayCounts['ศุกร์']} วัน)">ศ</th>
                    <th class="py-3 px-2.5 text-center w-24 bg-indigo-50/40 text-indigo-900">รวม/สัปดาห์</th>
                    <th class="py-3 px-3 text-center w-36 bg-emerald-50 text-emerald-950 font-black" title="คาบสอนทั้งเทอมตามตาราง (ตั้งต้น)">คาบตั้งต้น</th>
                    <th class="py-3 px-2 text-center w-20 bg-rose-50/80 text-rose-800 font-bold" title="คาบที่ครูลา (หักออก)">ลา (-)</th>
                    <th class="py-3 px-2 text-center w-20 bg-indigo-50/80 text-indigo-800 font-bold" title="คาบที่ครูไปสอนแทน (บวกเพิ่ม)">สอนแทน (+)</th>
                    <th class="py-3 px-3 text-center w-36 bg-slate-100/70 text-slate-800 font-black" title="คาบสอนจริงสุทธิ (เทียบกับตั้งต้น เหมือนหุ้นขึ้น/ลง)">สอนจริงสุทธิ</th>
                    <th class="py-3 px-2 text-center w-24 bg-purple-50 text-purple-950 font-bold" title="คิดเป็นร้อยละเทียบกับคาบตั้งต้น">% สอนจริง</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                </tbody>
                <tfoot class="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-800">
                </tfoot>
              </table>
            </div>
          </div>
        </div>

      </div>
    `;

    // Render table body & foot
    renderTeachingLoadTableBody(container, stats);

    // Live refresh substitutions from database
    if (getSubstitutions) {
      getSubstitutions().then(subs => {
        if (subs && Array.isArray(subs)) {
          activeSubstitutions = subs;
          renderTeachingLoadTableBody(container, stats);
        }
      }).catch(err => console.warn(err));
    }

    // Wire Events in Teaching Load Tab
    const btnGotoCal = document.getElementById('btn-goto-calendar-from-load');
    if (btnGotoCal) {
      btnGotoCal.addEventListener('click', () => {
        activeAdminTab = 'calendar';
        renderAdminDashboard();
      });
    }

    const btnPrint = document.getElementById('btn-print-load-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        printSemesterLoadReport(stats, allTeacherLoads);
      });
    }

    const filterGradeEl = document.getElementById('load-filter-grade');
    if (filterGradeEl) {
      filterGradeEl.addEventListener('change', (e) => {
        calendarTeacherGradeFilter = e.target.value;
        renderTeachingLoadTableBody(container, stats);
      });
    }

    const sortLoadEl = document.getElementById('load-sort-load');
    if (sortLoadEl) {
      sortLoadEl.addEventListener('change', (e) => {
        calendarSortOrder = e.target.value;
        renderTeachingLoadTableBody(container, stats);
      });
    }

    const searchTeacherEl = document.getElementById('load-search-teacher');
    if (searchTeacherEl) {
      searchTeacherEl.addEventListener('input', (e) => {
        calendarTeacherSearch = e.target.value;
        renderTeachingLoadTableBody(container, stats);
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function renderTeachingLoadTableBody(container, stats) {
    const allTeacherLoads = computeTeacherSemesterLoads(stats.dayCounts);
    let filtered = [...allTeacherLoads];

    if (calendarTeacherGradeFilter !== 'ALL') {
      filtered = filtered.filter(t => t.grade === calendarTeacherGradeFilter);
    }
    if (calendarTeacherSearch.trim()) {
      const q = calendarTeacherSearch.trim().toLowerCase();
      filtered = filtered.filter(t => t.teacherName.toLowerCase().includes(q));
    }
    if (calendarSortOrder === 'desc') {
      filtered.sort((a, b) => (b.actualPeriods - a.actualPeriods) || (b.semesterTotal - a.semesterTotal));
    } else if (calendarSortOrder === 'asc') {
      filtered.sort((a, b) => (a.actualPeriods - b.actualPeriods) || (a.semesterTotal - b.semesterTotal));
    }

    const tbody = container.querySelector('tbody');
    const tfoot = container.querySelector('tfoot');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" class="py-8 text-center text-slate-400">
            <i data-lucide="user-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
            ไม่พบข้อมูลครูที่ตรงกับเงื่อนไขการค้นหา
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map((t, idx) => {
      const band = GRADE_BANDS.find(b => b.key === t.grade) || {
        key: t.grade,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        cellBg: "bg-white",
        dotClass: "bg-slate-400"
      };

      const leaveDisplay = t.leavePeriods > 0 
        ? `<span class="inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">-${t.leavePeriods}</span>`
        : `<span class="text-xs text-slate-300 font-medium">0</span>`;

      const subDisplay = t.subPeriods > 0
        ? `<span class="inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs">+${t.subPeriods}</span>`
        : `<span class="text-xs text-slate-300 font-medium">0</span>`;

      const netDiff = t.actualPeriods - t.semesterTotal;
      let actualStockHtml = '';
      if (netDiff > 0) {
        actualStockHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-black text-xs sm:text-sm text-emerald-600">
            <i data-lucide="trending-up" class="w-4 h-4 text-emerald-600 shrink-0"></i>
            <span>${t.actualPeriods.toLocaleString()}</span>
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">(+${netDiff})</span>
          </div>
        `;
      } else if (netDiff < 0) {
        actualStockHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-black text-xs sm:text-sm text-rose-600">
            <i data-lucide="trending-down" class="w-4 h-4 text-rose-600 shrink-0"></i>
            <span>${t.actualPeriods.toLocaleString()}</span>
            <span class="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">(${netDiff})</span>
          </div>
        `;
      } else {
        actualStockHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-bold text-xs sm:text-sm text-slate-700">
            <span class="text-xs text-slate-400 font-bold">▪</span>
            <span>${t.actualPeriods.toLocaleString()}</span>
            <span class="text-[10px] font-normal text-slate-400">คาบ</span>
          </div>
        `;
      }

      let pctStockHtml = '';
      if (t.actualPercent > 100) {
        pctStockHtml = `
          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80">
            <i data-lucide="arrow-up" class="w-3 h-3 text-emerald-600"></i> ${t.actualPercent.toFixed(1)}%
          </span>
        `;
      } else if (t.actualPercent < 100) {
        pctStockHtml = `
          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80">
            <i data-lucide="arrow-down" class="w-3 h-3 text-rose-600"></i> ${t.actualPercent.toFixed(1)}%
          </span>
        `;
      } else {
        pctStockHtml = `
          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200/80">
            100.0%
          </span>
        `;
      }

      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-2.5 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
          <td class="py-2.5 px-3">
            <div class="font-bold text-slate-800">${t.teacherName}</div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${band.badgeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${band.dotClass}"></span>
              ${band.key}
            </span>
          </td>
          <td class="py-2.5 px-2 text-center font-semibold text-slate-700 bg-amber-50/20">${t.dayPeriods['จันทร์']}</td>
          <td class="py-2.5 px-2 text-center font-semibold text-slate-700 bg-pink-50/20">${t.dayPeriods['อังคาร']}</td>
          <td class="py-2.5 px-2 text-center font-semibold text-slate-700 bg-emerald-50/20">${t.dayPeriods['พุธ']}</td>
          <td class="py-2.5 px-2 text-center font-semibold text-slate-700 bg-orange-50/20">${t.dayPeriods['พฤหัสบดี']}</td>
          <td class="py-2.5 px-2 text-center font-semibold text-slate-700 bg-sky-50/20">${t.dayPeriods['ศุกร์']}</td>
          <td class="py-2.5 px-2.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
            ${t.weeklyTotal} <span class="text-[10px] font-normal text-indigo-500">คาบ</span>
          </td>
          <td class="py-2.5 px-3 text-center bg-emerald-50/30">
            <span class="inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xs">
              ${t.semesterTotal.toLocaleString()} <span class="text-[10px] font-normal ml-1">คาบ</span>
            </span>
          </td>
          <td class="py-2.5 px-2 text-center bg-rose-50/20">
            ${leaveDisplay}
          </td>
          <td class="py-2.5 px-2 text-center bg-indigo-50/20">
            ${subDisplay}
          </td>
          <td class="py-2.5 px-3 text-center">
            ${actualStockHtml}
          </td>
          <td class="py-2.5 px-2 text-center">
            ${pctStockHtml}
          </td>
        </tr>
      `;
    }).join('');

    if (tfoot) {
      const totWeekly = filtered.reduce((s, t) => s + t.weeklyTotal, 0);
      const totInitial = filtered.reduce((s, t) => s + t.semesterTotal, 0);
      const totLeave = filtered.reduce((s, t) => s + t.leavePeriods, 0);
      const totSub = filtered.reduce((s, t) => s + t.subPeriods, 0);
      const totActual = filtered.reduce((s, t) => s + t.actualPeriods, 0);
      const totPct = totInitial > 0 ? ((totActual / totInitial) * 100).toFixed(1) : '100.0';
      const netTotalDiff = totActual - totInitial;

      let netTotalHtml = '';
      if (netTotalDiff > 0) {
        netTotalHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-black text-sm text-emerald-700">
            <i data-lucide="trending-up" class="w-4 h-4 text-emerald-600"></i>
            <span>${totActual.toLocaleString()}</span>
            <span class="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300">(+${netTotalDiff})</span>
          </div>
        `;
      } else if (netTotalDiff < 0) {
        netTotalHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-black text-sm text-rose-700">
            <i data-lucide="trending-down" class="w-4 h-4 text-rose-600"></i>
            <span>${totActual.toLocaleString()}</span>
            <span class="text-xs font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-300">(${netTotalDiff})</span>
          </div>
        `;
      } else {
        netTotalHtml = `
          <div class="inline-flex items-center justify-center gap-1 font-black text-sm text-slate-800">
            <span>${totActual.toLocaleString()}</span>
            <span class="text-xs font-normal text-slate-500">คาบ</span>
          </div>
        `;
      }

      let totPctHtml = '';
      if (totActual > totInitial) {
        totPctHtml = `
          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-black text-emerald-800 bg-emerald-100/80 border border-emerald-300">
            <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i> ${totPct}%
          </span>
        `;
      } else if (totActual < totInitial) {
        totPctHtml = `
          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-black text-rose-800 bg-rose-100/80 border border-rose-300">
            <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i> ${totPct}%
          </span>
        `;
      } else {
        totPctHtml = `
          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black text-slate-700 bg-slate-100 border border-slate-300">
            100.0%
          </span>
        `;
      }

      tfoot.innerHTML = `
        <tr>
          <td colspan="3" class="py-3 px-3 text-right">รวมครูที่แสดง (${filtered.length} ท่าน):</td>
          <td class="py-3 px-2 text-center bg-amber-50/30">${filtered.reduce((s, t) => s + t.dayPeriods['จันทร์'], 0)}</td>
          <td class="py-3 px-2 text-center bg-pink-50/30">${filtered.reduce((s, t) => s + t.dayPeriods['อังคาร'], 0)}</td>
          <td class="py-3 px-2 text-center bg-emerald-50/30">${filtered.reduce((s, t) => s + t.dayPeriods['พุธ'], 0)}</td>
          <td class="py-3 px-2 text-center bg-orange-50/30">${filtered.reduce((s, t) => s + t.dayPeriods['พฤหัสบดี'], 0)}</td>
          <td class="py-3 px-2 text-center bg-sky-50/30">${filtered.reduce((s, t) => s + t.dayPeriods['ศุกร์'], 0)}</td>
          <td class="py-3 px-2.5 text-center text-indigo-800 bg-indigo-50/40 font-bold">
            ${totWeekly} คาบ
          </td>
          <td class="py-3 px-3 text-center bg-emerald-50/40">
            <span class="inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xs">
              ${totInitial.toLocaleString()} คาบ
            </span>
          </td>
          <td class="py-3 px-2 text-center text-rose-700 bg-rose-50/50 font-bold">
            ${totLeave > 0 ? '-' + totLeave : '0'}
          </td>
          <td class="py-3 px-2 text-center text-indigo-700 bg-indigo-50/50 font-bold">
            ${totSub > 0 ? '+' + totSub : '0'}
          </td>
          <td class="py-3 px-3 text-center">
            ${netTotalHtml}
          </td>
          <td class="py-3 px-2 text-center">
            ${totPctHtml}
          </td>
        </tr>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  const renderCalendarTeacherLoadTableBody = renderTeachingLoadTableBody;

  function printSemesterLoadReport(stats, allLoads) {
    const s = activeSettings || {};
    const cal = activeCalendar || {};
    const startThai = formatHolidayDateDisplay(cal.startDate);
    const endThai = formatHolidayDateDisplay(cal.endDate);

    const printArea = document.getElementById('print-section');
    if (!printArea) return;

    const totalSemester = allLoads.reduce((sum, t) => sum + t.semesterTotal, 0);

    printArea.innerHTML = `
      <div style="font-family: 'Sarabun', sans-serif; color: #000; padding: 20px 24px; font-size: 13px; line-height: 1.5;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 4px 0;">${s.schoolName || 'โรงเรียนชุมชนบ้านวังพิกุล'}</h2>
          <h3 style="font-size: 15px; font-weight: bold; margin: 0 0 4px 0;">รายงานสรุปภาระงานสอนและคาบสอนจริงของข้าราชการครู รายภาคเรียน</h3>
          <p style="font-size: 13px; margin: 0;">
            ภาคเรียนที่ ${cal.term || '1'} ปีการศึกษา ${cal.academicYear || '2569'}
            (ระหว่างวันที่ ${startThai.text} ถึง ${endThai.text})
          </p>
        </div>

        <!-- Academic Calendar Stats Summary -->
        <div style="border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; background: #fafafa; font-size: 12px;">
          <div style="font-weight: bold; margin-bottom: 4px;">สรุปวันทำการเรียนการสอน:</div>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>วันเปิดเรียนจริง: <strong>${stats.teachingDays} วัน</strong></span>
            <span>วันจันทร์: <strong>${stats.dayCounts['จันทร์']} วัน</strong></span>
            <span>วันอังคาร: <strong>${stats.dayCounts['อังคาร']} วัน</strong></span>
            <span>วันพุธ: <strong>${stats.dayCounts['พุธ']} วัน</strong></span>
            <span>วันพฤหัสบดี: <strong>${stats.dayCounts['พฤหัสบดี']} วัน</strong></span>
            <span>วันศุกร์: <strong>${stats.dayCounts['ศุกร์']} วัน</strong></span>
            <span>รวมภาระงานสอนทั้งโรงเรียน: <strong>${totalSemester.toLocaleString()} คาบ</strong></span>
          </div>
        </div>

        <!-- Teacher Load Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f0f0f0;">
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">ลำดับ</th>
              <th style="border: 1px solid #333; padding: 6px 6px; text-align: left;">ชื่อ-สกุล คุณครู</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 60px;">ช่วงชั้น</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">จ</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">อ</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">พ</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">พฤ</th>
              <th style="border: 1px solid #333; padding: 6px 4px; text-align: center; width: 36px;">ศ</th>
              <th style="border: 1px solid #333; padding: 6px 6px; text-align: center; width: 75px;">คาบ/สัปดาห์</th>
              <th style="border: 1px solid #333; padding: 6px 6px; text-align: center; width: 95px; font-weight: bold;">คาบสอนทั้งเทอม</th>
            </tr>
          </thead>
          <tbody>
            ${allLoads.map((t, idx) => `
              <tr>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #ccc; padding: 4px 6px;">${t.teacherName}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.grade}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.dayPeriods['จันทร์']}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.dayPeriods['อังคาร']}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.dayPeriods['พุธ']}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.dayPeriods['พฤหัสบดี']}</td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${t.dayPeriods['ศุกร์']}</td>
                <td style="border: 1px solid #ccc; padding: 4px 6px; text-align: center; font-weight: bold;">${t.weeklyTotal}</td>
                <td style="border: 1px solid #ccc; padding: 4px 6px; text-align: center; font-weight: bold; background: #f9fdfa;">${t.semesterTotal.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #333; padding: 6px; text-align: right;">รวมทั้งสิ้น (${allLoads.length} ท่าน):</td>
              <td style="border: 1px solid #333; padding: 6px 4px; text-align: center;">${allLoads.reduce((s, t) => s + t.dayPeriods['จันทร์'], 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 4px; text-align: center;">${allLoads.reduce((s, t) => s + t.dayPeriods['อังคาร'], 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 4px; text-align: center;">${allLoads.reduce((s, t) => s + t.dayPeriods['พุธ'], 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 4px; text-align: center;">${allLoads.reduce((s, t) => s + t.dayPeriods['พฤหัสบดี'], 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 4px; text-align: center;">${allLoads.reduce((s, t) => s + t.dayPeriods['ศุกร์'], 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 6px; text-align: center;">${allLoads.reduce((s, t) => s + t.weeklyTotal, 0)}</td>
              <td style="border: 1px solid #333; padding: 6px 6px; text-align: center; background: #eaf7ed;">${totalSemester.toLocaleString()} คาบ</td>
            </tr>
          </tfoot>
        </table>

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid;">
          <div style="text-align: center; width: 45%;">
            <p style="margin-bottom: 45px;">ลงชื่อ..............................................................</p>
            <p style="font-weight: bold; margin: 0 0 2px 0;">(${s.academicHeadName || 'นางประชารักษ์ ศรีบรรเทา'})</p>
            <p style="margin: 0;">${s.academicHeadPosition || 'ตำแหน่งหัวหน้ากลุ่มบริหารงานวิชาการ'}</p>
          </div>
          <div style="text-align: center; width: 45%;">
            <p style="margin-bottom: 45px;">ลงชื่อ..............................................................</p>
            <p style="font-weight: bold; margin: 0 0 2px 0;">(${s.directorRank ? s.directorRank + ' ' : ''}${s.directorName || 'ภาคภูมิ บัวทอง'})</p>
            <p style="margin: 0;">${s.directorPosition || 'ตำแหน่งผู้อำนวยการโรงเรียนชุมชนบ้านวังพิกุล'}</p>
          </div>
        </div>
      </div>
    `;

    window.print();
  }

  global.TeachAdmin = {
    initAdminPage
  };
})(typeof window !== 'undefined' ? window : this);
