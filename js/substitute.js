/**
 * substitute.js - ตรรกะหน้าจัดสอนแทนและสร้างแบบฟอร์มเอกสาร PDF
 */

(function(global) {
  const { 
    formatThaiDate, 
    parseSubjectAndRoom,
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
    }
  } = (global.TeachData || {});
  const { 
    getSchoolSettings, 
    getPeriods, 
    getTeachers, 
    getTeacherGrades,
    getAllTimetables, 
    getSubstitutions, 
    recordSubstitutions 
  } = (global.TeachDatabase || global.TeachSupabase);

  let currentDate = new Date();
  let absentTeachersList = []; 
  let cachedTimetables = {};
  let cachedTeachers = [];
  let cachedTeacherGrades = {};
  let cachedPeriods = [];
  let cachedSettings = {};
  let cachedSubstitutions = [];
  let modalActiveDay = null;
  let modalGradeFilter = 'ALL';
  let modalSearchQuery = '';
  let selectedPrintTeacherNames = new Set();
  let pdfModalListenersBound = false;

  async function initSubstitutePage() {
    const container = document.getElementById('view-substitute');
    if (!container) return;

    cachedSettings = await getSchoolSettings();
    cachedPeriods = await getPeriods();
    cachedTeachers = await getTeachers();
    if (getTeacherGrades) {
      cachedTeacherGrades = await getTeacherGrades();
    } else {
      cachedTeacherGrades = {};
    }
    cachedTimetables = await getAllTimetables();
    cachedSubstitutions = await getSubstitutions();

    loadSavedSubstitutionsForCurrentDate();
    renderSubstituteUI();
  }

  function showToast(message, type = 'success') {
    if (global.TeachApp && global.TeachApp.showToast) {
      global.TeachApp.showToast(message, type);
      return;
    }
    let toast = document.getElementById('teach-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'teach-toast';
      document.body.appendChild(toast);
    }
    toast.style.display = 'flex';
    toast.style.pointerEvents = 'auto';
    toast.className = 'fixed bottom-6 right-6 z-50 bg-white/95 text-slate-800 border border-slate-200 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-0 opacity-100 backdrop-blur-xs';
    toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i><span>${message}</span>`;
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.pointerEvents = 'none';
      toast.classList.add('hidden');
    }, 2800);
  }

  function loadSavedSubstitutionsForCurrentDate() {
    const dateStr = currentDate.toISOString().split('T')[0];
    const recordsToday = cachedSubstitutions.filter(r => r.date === dateStr);

    if (recordsToday.length > 0) {
      const map = {};
      recordsToday.forEach(r => {
        if (!map[r.absentTeacher]) {
          map[r.absentTeacher] = {
            teacherName: r.absentTeacher,
            leaveType: r.leaveType || 'ไปราชการ',
            periods: {},
            isSaved: true
          };
          populateTeacherPeriods(map[r.absentTeacher]);
        }
        const item = map[r.absentTeacher];
        item.leaveType = r.leaveType || item.leaveType;
        if (r.periodId && r.periodId > 0 && item.periods[r.periodId]) {
          if (r.substituteTeacher) item.periods[r.periodId].substituteTeacher = r.substituteTeacher;
          if (r.subject) item.periods[r.periodId].subject = r.subject;
          if (r.room) item.periods[r.periodId].room = r.room;
        }
      });
      absentTeachersList = Object.values(map);
    } else {
      absentTeachersList = [];
    }
  }

  function syncSavedStateForTeacher(item) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const records = cachedSubstitutions.filter(r => r.date === dateStr && r.absentTeacher === item.teacherName);
    if (records.length > 0) {
      item.leaveType = records[0].leaveType || item.leaveType;
      records.forEach(r => {
        if (r.periodId && r.periodId > 0 && item.periods[r.periodId]) {
          if (r.substituteTeacher) item.periods[r.periodId].substituteTeacher = r.substituteTeacher;
          if (r.subject) item.periods[r.periodId].subject = r.subject;
          if (r.room) item.periods[r.periodId].room = r.room;
        }
      });
      item.isSaved = true;
    } else {
      item.isSaved = false;
    }
  }

  function updateTeacherSaveButtonStatus(index) {
    const item = absentTeachersList[index];
    if (!item) return;
    item.isSaved = false;
    const btn = document.querySelector(`.btn-save-single[data-index="${index}"]`);
    if (btn) {
      btn.className = "btn-save-single btn-press inline-flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs shadow-amber-500/25 cursor-pointer animate-subtle-pulse";
      btn.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>บันทึก</span>`;
      btn.title = "ยังไม่ได้บันทึก คลิกเพื่อบันทึกข้อมูลครูท่านนี้";
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async function saveSingleTeacherSubstitutions(idx) {
    const item = absentTeachersList[idx];
    if (!item) return;

    const dateInfo = formatThaiDate(currentDate);
    const dateStr = currentDate.toISOString().split('T')[0];
    const records = [];

    const periodsList = Object.values(item.periods || {});
    const assignedPeriods = periodsList.filter(p => p.substituteTeacher && p.substituteTeacher.trim());

    if (assignedPeriods.length > 0) {
      assignedPeriods.forEach(p => {
        records.push({
          date: dateStr,
          dayOfWeek: dateInfo.dayOfWeek,
          absentTeacher: item.teacherName,
          leaveType: item.leaveType || 'ไปราชการ',
          periodId: p.periodId,
          periodTime: p.periodTime || '',
          subject: p.subject || '',
          room: p.room || '',
          substituteTeacher: p.substituteTeacher
        });
      });
    } else {
      records.push({
        date: dateStr,
        dayOfWeek: dateInfo.dayOfWeek,
        absentTeacher: item.teacherName,
        leaveType: item.leaveType || 'ไปราชการ',
        periodId: 0,
        periodTime: '-',
        subject: periodsList.length === 0 ? 'ไม่มีคาบสอนในวันดังกล่าว' : 'ไม่ได้ระบุผู้สอนแทน',
        room: '-',
        substituteTeacher: ''
      });
    }

    try {
      cachedSubstitutions = await recordSubstitutions(records);
      item.isSaved = true;
      renderAbsentTeachersCards();

      const subCount = records.filter(r => r.substituteTeacher && r.substituteTeacher.trim()).length;
      if (subCount > 0) {
        showToast(`บันทึกข้อมูลของ ${item.teacherName} สำเร็จ (${subCount} คาบ)`);
      } else {
        showToast(`บันทึกประวัติการลาของ ${item.teacherName} สำเร็จ`);
      }
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
    }
  }

  function renderSubstituteUI() {
    const container = document.getElementById('view-substitute');
    const dateInfo = formatThaiDate(currentDate);
    const dayConfig = (global.TeachData && global.TeachData.THAI_DAY_CONFIG && global.TeachData.THAI_DAY_CONFIG[dateInfo.dayOfWeek]) || {
      dotClass: "bg-indigo-500",
      badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-200"
    };

    container.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6 pb-16">
        
        <!-- Card ส่วนหัวและเลือกวัน (Glass Card) -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                <span class="p-2.5 bg-gradient-to-tr from-indigo-500 to-blue-600 text-white rounded-2xl shadow-sm shadow-indigo-500/20">
                  <i data-lucide="calendar-check" class="w-5 h-5 sm:w-6 sm:h-6"></i>
                </span>
                ระบบจัดสอนแทนประจำวัน
              </h2>
              <p class="text-xs sm:text-sm text-slate-500 mt-1">${cachedSettings.schoolName} • เลือกครูที่ลาเพื่อจัดครูที่มีคาบว่างเข้าสอนแทน</p>
            </div>
            
            <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div class="flex items-center gap-2 bg-white/90 border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-2xs hover:border-indigo-300 transition-colors">
                <span class="text-xs font-semibold text-slate-500">เลือกวันที่:</span>
                <input type="date" id="sub-date-input" 
                  value="${currentDate.toISOString().split('T')[0]}" 
                  class="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              </div>

              <button type="button" id="btn-view-day-timetable" 
                class="btn-press hover-lift-sm px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border shadow-2xs cursor-pointer transition-all ${dayConfig.badgeClass}"
                title="คลิกเพื่อเรียกดูตารางสอนวัน${dateInfo.dayOfWeek} (สำหรับพิจารณาจัดสอนแทน)">
                <span class="w-2.5 h-2.5 rounded-full ${dayConfig.dotClass}"></span>
                <span>วัน${dateInfo.dayOfWeek}</span>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold opacity-85 pl-1.5 border-l border-current/25">
                  <i data-lucide="sheet" class="w-3.5 h-3.5"></i>
                  <span>ดูตารางสอน</span>
                </span>
              </button>
            </div>
          </div>

          <!-- รายการครูที่ลา -->
          <div class="mt-5">
            <div class="flex items-center justify-between mb-3.5">
              <h3 class="text-sm sm:text-base font-bold text-slate-700 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>รายชื่อครูที่ลาในวันนี้</span>
                <span id="absent-count-badge" class="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80">${absentTeachersList.length} ท่าน</span>
              </h3>
              <button id="btn-add-absent-teacher" 
                class="btn-press hover-lift-sm inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/60 transition-all cursor-pointer">
                <i data-lucide="plus" class="w-4 h-4"></i>
                เพิ่มครู
              </button>
            </div>

            <div id="absent-teachers-container" class="space-y-4">
              <!-- Render การ์ดของครูที่ลาแต่ละท่านที่นี่ -->
            </div>
          </div>
        </div>

        <!-- Floating Action Button (FAB): ดูตัวอย่าง & พิมพ์ PDF (Hover Lift + Glass Glow) -->
        <div class="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 no-print animate-in fade-in slide-in-from-bottom-3 duration-300">
          <button id="btn-preview-pdf" 
            class="btn-press hover-lift group inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all cursor-pointer border border-white/20 ring-4 ring-indigo-500/20 backdrop-blur-md"
            title="ดูตัวอย่างเอกสารขนาด A4 และสั่งพิมพ์ PDF">
            <i data-lucide="file-text" class="w-5 h-5 text-indigo-100 group-hover:text-white transition-colors"></i>
            <span>ดูตัวอย่าง & พิมพ์ PDF</span>
          </button>
        </div>

      </div>
    `;

    const dateInput = document.getElementById('sub-date-input');
    dateInput.addEventListener('change', async (e) => {
      currentDate = new Date(e.target.value);
      loadSavedSubstitutionsForCurrentDate();
      renderSubstituteUI();
    });

    const btnViewTimetable = document.getElementById('btn-view-day-timetable');
    if (btnViewTimetable) {
      btnViewTimetable.addEventListener('click', () => {
        openDayTimetableModal(dateInfo.dayOfWeek);
      });
    }

    document.getElementById('btn-add-absent-teacher').addEventListener('click', () => {
      addAbsentTeacher();
    });

    const btnPreviewPdf = document.getElementById('btn-preview-pdf');
    if (btnPreviewPdf) {
      btnPreviewPdf.addEventListener('click', () => {
        openPdfPreviewModal();
      });
    }

    const btnSaveSub = document.getElementById('btn-save-substitutions');
    if (btnSaveSub) {
      btnSaveSub.addEventListener('click', () => {
        saveCurrentSubstitutions();
      });
    }

    renderAbsentTeachersCards();
    if (window.lucide) window.lucide.createIcons();
  }

  function addAbsentTeacher() {
    const availableTeachers = cachedTeachers.filter(t => !absentTeachersList.some(item => item.teacherName === t));
    const defaultTeacher = availableTeachers.length > 0 ? availableTeachers[0] : cachedTeachers[0];

    const newAbsentItem = {
      teacherName: defaultTeacher,
      leaveType: "ไปราชการ",
      periods: {},
      isSaved: false
    };

    populateTeacherPeriods(newAbsentItem);
    syncSavedStateForTeacher(newAbsentItem);
    absentTeachersList.push(newAbsentItem);
    renderAbsentTeachersCards();

    // เลื่อนหน้าจอลงไปยังการ์ดของครูคนใหม่ที่เพิ่งเพิ่มโดยอัตโนมัติ
    setTimeout(() => {
      const cards = document.querySelectorAll('.absent-teacher-card');
      if (cards.length > 0) {
        cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }

  function updateAbsentTeachersTimetables() {
    absentTeachersList.forEach(item => {
      populateTeacherPeriods(item);
    });
  }

  function populateTeacherPeriods(item) {
    const dateInfo = formatThaiDate(currentDate);
    const dayName = dateInfo.dayOfWeek;
    const dayTimetable = cachedTimetables[dayName] || [];
    const teacherIndex = cachedTeachers.indexOf(item.teacherName);

    item.periods = {};
    if (teacherIndex >= 0 && dayTimetable[teacherIndex]) {
      const teacherSchedule = dayTimetable[teacherIndex];
      cachedPeriods.forEach((period, pIdx) => {
        if (!period.isBreak) {
          const rawClass = teacherSchedule[pIdx] || "";
          if (rawClass.trim()) {
            const parsed = parseSubjectAndRoom(rawClass);
            item.periods[period.id] = {
              periodId: period.id,
              periodName: period.name,
              periodTime: period.time,
              subject: parsed.subject,
              room: parsed.room,
              substituteTeacher: ""
            };
          }
        }
      });
    }
  }

  function renderAbsentTeachersCards() {
    const container = document.getElementById('absent-teachers-container');
    if (!container) return;

    if (absentTeachersList.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
          <i data-lucide="user-check" class="w-10 h-10 text-slate-400 mx-auto mb-2"></i>
          <p class="text-slate-600 font-medium">ยังไม่มีข้อมูลครูที่ลาในวันนี้</p>
          <p class="text-xs text-slate-400 mt-1">กดปุ่ม "เพิ่มครูที่ลา" ด้านบน เพื่อเริ่มจัดตารางสอนแทน</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const dateInfo = formatThaiDate(currentDate);
    const dayName = dateInfo.dayOfWeek;

    const cardsHtml = absentTeachersList.map((item, index) => {
      const hasPeriods = Object.keys(item.periods).length > 0;

      return `
        <div class="absent-teacher-card glass-card hover-lift border ${item.isSaved ? 'border-emerald-300/80 ring-1 ring-emerald-400/20' : 'border-slate-200/80'} rounded-2xl shadow-xs overflow-hidden transition-all">
          
          <!-- Compact Top Bar -->
          <div class="${item.isSaved ? 'bg-emerald-50/50' : 'bg-slate-50/90'} px-3.5 py-2.5 border-b ${item.isSaved ? 'border-emerald-200/80' : 'border-slate-200/80'} flex flex-wrap items-center justify-between gap-2.5">
            
            <!-- Left: ครูที่ลา & ปุ่มบันทึกสถานะ -->
            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span class="w-6 h-6 flex items-center justify-center ${item.isSaved ? 'bg-gradient-to-tr from-emerald-500 to-emerald-600 shadow-xs shadow-emerald-500/25' : 'bg-gradient-to-tr from-indigo-500 to-blue-600 shadow-xs shadow-indigo-500/25'} text-white rounded-lg text-xs font-bold shrink-0">
                ${index + 1}
              </span>
              <span class="text-xs font-bold text-slate-600 whitespace-nowrap">ครูที่ลา:</span>
              <select class="absent-teacher-select bg-white border border-slate-300/90 rounded-xl px-2.5 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs w-48 sm:w-56 cursor-pointer"
                data-index="${index}">
                ${cachedTeachers.map(t => {
                  const g = cachedTeacherGrades[t] ? ` [${cachedTeacherGrades[t]}]` : '';
                  return `<option value="${t}" ${t === item.teacherName ? 'selected' : ''}>${t}${g}</option>`;
                }).join('')}
              </select>

              <!-- ปุ่มบันทึกหลังชื่อครู (สีเขียวเมื่อบันทึกแล้ว / สีส้มเมื่อยังไม่บันทึก) -->
              ${item.isSaved ? `
                <button class="btn-save-single btn-press inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300/90 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  data-index="${index}" title="บันทึกข้อมูลเรียบร้อยแล้ว (คลิกเพื่อบันทึกซ้ำ)">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i>
                  <span>บันทึกแล้ว</span>
                </button>
              ` : `
                <button class="btn-save-single btn-press inline-flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-amber-500/25 cursor-pointer animate-subtle-pulse"
                  data-index="${index}" title="ยังไม่ได้บันทึก คลิกเพื่อบันทึกข้อมูลครูท่านนี้">
                  <i data-lucide="save" class="w-3.5 h-3.5"></i>
                  <span>บันทึก</span>
                </button>
              `}
            </div>

            <!-- Right: ประเภทการลา & สรุปคาบ & ปุ่มลบ -->
            <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
              <!-- Leave Type Segmented Control -->
              <div class="inline-flex bg-slate-200/60 p-0.5 rounded-xl text-xs font-semibold">
                ${['ไปราชการ', 'ลากิจ', 'ลาป่วย'].map(type => `
                  <label class="px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all ${item.leaveType === type ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}">
                    <input type="radio" name="leave-type-${index}" value="${type}" 
                      ${item.leaveType === type ? 'checked' : ''} 
                      class="leave-type-radio hidden" data-index="${index}">
                    <span>${type === 'ไปราชการ' ? '🏛️ ราชการ' : type === 'ลากิจ' ? '📝 ลากิจ' : '🏥 ลาป่วย'}</span>
                  </label>
                `).join('')}
              </div>

              <span class="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 ${hasPeriods ? (item.isSaved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80') : 'bg-slate-100 text-slate-500 border border-slate-200/80'}">
                ${hasPeriods ? `มีสอน ${Object.keys(item.periods).length} คาบ` : 'ไม่มีคาบสอน'}
              </span>

              <button class="btn-print-single btn-press text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                data-teacher="${item.teacherName}" title="ดูตัวอย่าง & สั่งพิมพ์เฉพาะคุณครู ${item.teacherName}">
                <i data-lucide="printer" class="w-4 h-4"></i>
              </button>

              <button class="btn-remove-absent btn-press text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                data-index="${index}" title="ลบรายการครูท่านนี้">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Periods List: Compact Horizontal Grid Cards -->
          <div class="p-2.5 sm:p-3">
            ${!hasPeriods ? `
              <div class="text-center py-5 text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                คุณครูท่านนี้ไม่มีคาบสอนในวัน${dayName} (ระบบจะบันทึกสถิติการลาให้ตามปกติ)
              </div>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                ${Object.values(item.periods).map(period => {
                  const availableTeachers = getAvailableTeachersForPeriod(dayName, period.periodId, item.teacherName);
                  const isAssigned = Boolean(period.substituteTeacher && period.substituteTeacher.trim());
                  const freeCount = availableTeachers.filter(t => t.isFree).length;

                  return `
                    <div class="bg-white/80 border ${isAssigned ? 'border-emerald-400/90 bg-emerald-50/30 ring-1 ring-emerald-300/40 shadow-xs' : 'border-slate-200/80'} rounded-xl p-2.5 flex flex-col justify-between gap-1.5 transition-all hover-lift-sm hover:border-slate-300">
                      
                      <!-- Row 1: คาบ & เวลา + จำนวนครูว่าง -->
                      <div class="flex items-center justify-between text-xs pb-1 border-b ${isAssigned ? 'border-emerald-200/70' : 'border-slate-200/70'}">
                        <div class="flex items-center gap-1.5">
                          <span class="px-1.5 py-0.5 rounded-md text-[11px] font-bold ${isAssigned ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' : 'bg-slate-800 text-white'} shadow-2xs">
                            ${period.periodName}
                          </span>
                          <span class="text-[10px] text-slate-400 font-medium">${period.periodTime}</span>
                        </div>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isAssigned ? 'text-emerald-700 bg-emerald-100/70 border border-emerald-300/50' : 'text-emerald-600 bg-emerald-50 border border-emerald-200/50'}">
                          ว่าง ${freeCount}
                        </span>
                      </div>

                      <!-- Row 2: วิชา และ ห้องเรียน (compact inline inputs) -->
                      <div class="flex items-center gap-1.5 text-xs">
                        <input type="text" value="${period.subject}" placeholder="วิชา..." 
                          class="period-subject-input flex-1 min-w-0 font-bold text-slate-800 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-0.5 outline-none transition-all text-xs"
                          data-index="${index}" data-period="${period.periodId}" title="${period.subject}">
                        <input type="text" value="${period.room}" placeholder="ห้อง..." 
                          class="period-room-input w-20 text-slate-600 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg px-1.5 py-0.5 outline-none transition-all text-[11px] text-center"
                          data-index="${index}" data-period="${period.periodId}" title="${period.room || 'ห้องเรียน'}">
                      </div>

                      <!-- Row 3: เลือกครูสอนแทน -->
                      <div>
                        <select class="substitute-select w-full ${isAssigned ? 'bg-emerald-100/70 border-emerald-400 text-emerald-900 font-bold' : 'bg-slate-50/70 hover:bg-white border-slate-300/90 text-slate-800 font-medium'} border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs transition-all"
                          data-index="${index}" data-period="${period.periodId}">
                          <option value="">-- เลือกครูสอนแทน --</option>
                          <optgroup label="ครูที่ว่างในคาบนี้ (ว่าง ${freeCount} ท่าน)">
                            ${availableTeachers.filter(t => t.isFree).map(t => {
                              const g = cachedTeacherGrades[t.name] ? ` [${cachedTeacherGrades[t.name]}]` : '';
                              return `
                                <option value="${t.name}" ${period.substituteTeacher === t.name ? 'selected' : ''}>
                                  ${t.name}${g} (ว่าง ${t.freePeriodsCount} คาบ)
                                </option>
                              `;
                            }).join('')}
                          </optgroup>
                          <optgroup label="ครูที่มีคาบสอนอื่น">
                            ${availableTeachers.filter(t => !t.isFree).map(t => {
                              const g = cachedTeacherGrades[t.name] ? ` [${cachedTeacherGrades[t.name]}]` : '';
                              return `
                                <option value="${t.name}" ${period.substituteTeacher === t.name ? 'selected' : ''}>
                                  ⚠️ ${t.name}${g} (${t.busyWith})
                                </option>
                              `;
                            }).join('')}
                          </optgroup>
                        </select>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

        </div>
      `;
    }).join('');

    const inlineAddHtml = `
      <div class="pt-1">
        <button id="btn-add-teacher-inline"
          class="btn-press hover-lift-sm w-full py-3.5 px-4 bg-white/70 hover:bg-indigo-50/70 border-2 border-dashed border-slate-300/80 hover:border-indigo-400 text-slate-600 hover:text-indigo-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs">
          <i data-lucide="plus-circle" class="w-4 h-4 text-indigo-500"></i>
          <span>เพิ่มครู</span>
        </button>
      </div>
    `;

    container.innerHTML = cardsHtml + inlineAddHtml;

    const countBadge = document.getElementById('absent-count-badge');
    if (countBadge) countBadge.innerText = absentTeachersList.length;

    const btnAddInline = document.getElementById('btn-add-teacher-inline');
    if (btnAddInline) {
      btnAddInline.addEventListener('click', () => {
        addAbsentTeacher();
      });
    }

    container.querySelectorAll('.btn-save-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        saveSingleTeacherSubstitutions(idx);
      });
    });

    container.querySelectorAll('.absent-teacher-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        absentTeachersList[idx].teacherName = e.target.value;
        populateTeacherPeriods(absentTeachersList[idx]);
        syncSavedStateForTeacher(absentTeachersList[idx]);
        renderAbsentTeachersCards();
      });
    });

    container.querySelectorAll('.leave-type-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        absentTeachersList[idx].leaveType = e.target.value;
        absentTeachersList[idx].isSaved = false;
        renderAbsentTeachersCards();
      });
    });

    container.querySelectorAll('.btn-remove-absent').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const item = absentTeachersList[idx];
        if (item && item.isSaved) {
          if (confirm(`คุณครู ${item.teacherName} บันทึกข้อมูลแล้ว ต้องการลบออกจากฐานข้อมูลด้วยหรือไม่?`)) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (global.TeachDatabase && global.TeachDatabase.deleteSubstitutionsForTeacher) {
              cachedSubstitutions = await global.TeachDatabase.deleteSubstitutionsForTeacher(dateStr, item.teacherName);
            } else {
              const toDelete = cachedSubstitutions.filter(r => r.date === dateStr && r.absentTeacher === item.teacherName);
              if (toDelete.length > 0) {
                const ids = toDelete.map(r => r.id).filter(Boolean);
                if (global.TeachDatabase && global.TeachDatabase.deleteSubstitutionsBatch) {
                  cachedSubstitutions = await global.TeachDatabase.deleteSubstitutionsBatch(ids);
                }
              }
            }
          }
        }
        absentTeachersList.splice(idx, 1);
        renderAbsentTeachersCards();
      });
    });

    container.querySelectorAll('.btn-print-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const teacherName = e.currentTarget.dataset.teacher;
        if (teacherName) {
          openPdfPreviewModal([teacherName]);
        }
      });
    });

    container.querySelectorAll('.period-subject-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const pid = parseInt(e.target.dataset.period);
        if (absentTeachersList[idx].periods[pid]) {
          absentTeachersList[idx].periods[pid].subject = e.target.value;
          updateTeacherSaveButtonStatus(idx);
        }
      });
    });

    container.querySelectorAll('.period-room-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const pid = parseInt(e.target.dataset.period);
        if (absentTeachersList[idx].periods[pid]) {
          absentTeachersList[idx].periods[pid].room = e.target.value;
          updateTeacherSaveButtonStatus(idx);
        }
      });
    });

    container.querySelectorAll('.substitute-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const pid = parseInt(e.target.dataset.period);
        if (absentTeachersList[idx].periods[pid]) {
          absentTeachersList[idx].periods[pid].substituteTeacher = e.target.value;
          absentTeachersList[idx].isSaved = false;
          renderAbsentTeachersCards();
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function getAvailableTeachersForPeriod(dayName, periodId, absentTeacherName) {
    const dayTimetable = cachedTimetables[dayName] || [];
    const pIndex = periodId - 1;

    return cachedTeachers
      .filter(name => name !== absentTeacherName && !absentTeachersList.some(item => item.teacherName === name))
      .map(name => {
        const teacherIdx = cachedTeachers.indexOf(name);
        const assignedClass = (teacherIdx >= 0 && dayTimetable[teacherIdx]) ? (dayTimetable[teacherIdx][pIndex] || "") : "";
        
        // ตรวจสอบว่าถูกเลือกสอนแทนในคาบนี้ไปแล้วหรือยัง
        const isAlreadySubbingInThisPeriod = absentTeachersList.some(item => 
          item.periods && item.periods[periodId] && item.periods[periodId].substituteTeacher === name
        );

        const isFree = !assignedClass.trim() && !isAlreadySubbingInThisPeriod;

        let busyWith = "ว่าง";
        if (assignedClass.trim()) {
          busyWith = `มีสอน: ${assignedClass.trim()}`;
        } else if (isAlreadySubbingInThisPeriod) {
          busyWith = `ติดสอนแทนคาบนี้แล้ว`;
        }

        // คำนวณจำนวนคาบที่ว่างในวันนั้น (ไม่รวมคาบพักกลางวัน)
        let freePeriodsCount = 0;
        cachedPeriods.forEach((period, idx) => {
          if (!period.isBreak) {
            const raw = (teacherIdx >= 0 && dayTimetable[teacherIdx]) ? (dayTimetable[teacherIdx][idx] || "") : "";
            const isSub = absentTeachersList.some(item => 
              item.periods && item.periods[period.id] && item.periods[period.id].substituteTeacher === name
            );
            if (!raw.trim() && !isSub) {
              freePeriodsCount++;
            }
          }
        });

        return {
          name,
          isFree,
          busyWith,
          freePeriodsCount
        };
      })
      .sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        // เรียงคนที่ว่างหลายคาบที่สุดขึ้นก่อน
        if (b.freePeriodsCount !== a.freePeriodsCount) {
          return b.freePeriodsCount - a.freePeriodsCount;
        }
        return a.name.localeCompare(b.name, 'th');
      });
  }

  async function saveCurrentSubstitutions() {
    if (absentTeachersList.length === 0) {
      showToast("กรุณาเพิ่มครูที่ลาอย่างน้อย 1 ท่านก่อนทำการบันทึกครับ", "error");
      return;
    }

    const dateInfo = formatThaiDate(currentDate);
    const dateStr = currentDate.toISOString().split('T')[0];
    const records = [];

    absentTeachersList.forEach(item => {
      const periodsList = Object.values(item.periods || {});
      const assignedPeriods = periodsList.filter(p => p.substituteTeacher && p.substituteTeacher.trim());

      if (assignedPeriods.length > 0) {
        assignedPeriods.forEach(p => {
          records.push({
            date: dateStr,
            dayOfWeek: dateInfo.dayOfWeek,
            absentTeacher: item.teacherName,
            leaveType: item.leaveType || 'ไปราชการ',
            periodId: p.periodId,
            periodTime: p.periodTime || '',
            subject: p.subject || '',
            room: p.room || '',
            substituteTeacher: p.substituteTeacher
          });
        });
      } else {
        // ครูที่ลาแต่ไม่มีคาบสอนในวันนั้น หรือไม่ได้ระบุผู้สอนแทน
        // บันทึกเพื่อให้ระบบนับสถิติการลาได้ถูกต้อง
        records.push({
          date: dateStr,
          dayOfWeek: dateInfo.dayOfWeek,
          absentTeacher: item.teacherName,
          leaveType: item.leaveType || 'ไปราชการ',
          periodId: 0,
          periodTime: '-',
          subject: periodsList.length === 0 ? 'ไม่มีคาบสอนในวันดังกล่าว' : 'ไม่ได้ระบุผู้สอนแทน',
          room: '-',
          substituteTeacher: ''
        });
      }
    });

    try {
      cachedSubstitutions = await recordSubstitutions(records);
      absentTeachersList.forEach(item => { item.isSaved = true; });
      const subCount = records.filter(r => r.substituteTeacher && r.substituteTeacher.trim()).length;
      if (subCount > 0) {
        showToast(`บันทึกการจัดสอนแทน (${subCount} คาบ) สำเร็จเรียบร้อย`);
      } else {
        showToast(`บันทึกประวัติการลาของคุณครูสำเร็จเรียบร้อย`);
      }
      renderAbsentTeachersCards();
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
    }
  }

  function formatTeacherNameForTable(fullName) {
    if (!fullName || !fullName.trim()) return '';
    let raw = fullName.trim();

    if (raw.includes("...")) return raw;

    // 1. แปลงคำนำหน้าเป็นตัวย่อ เช่น น.ส., ว่าที่ ร.ต., ด.ช., ด.ญ. (นาย, นาง คงเดิมตามแบบมาตรฐาน)
    if (raw.startsWith("นางสาว")) {
      raw = "น.ส." + raw.substring(6).trim();
    } else if (raw.startsWith("ว่าที่ร้อยตรี")) {
      raw = "ว่าที่ ร.ต. " + raw.substring(13).trim();
    } else if (raw.startsWith("ว่าที่ ร้อยตรี")) {
      raw = "ว่าที่ ร.ต. " + raw.substring(14).trim();
    } else if (raw.startsWith("เด็กชาย")) {
      raw = "ด.ช." + raw.substring(7).trim();
    } else if (raw.startsWith("เด็กหญิง")) {
      raw = "ด.ญ." + raw.substring(8).trim();
    }

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return `<div>${parts[0]}</div>`;

    // นามสกุลคือคำสุดท้าย, คำข้างหน้าทั้งหมดคือ คำนำหน้า + ชื่อ
    const surname = parts[parts.length - 1];
    let firstNameWithTitle = parts.slice(0, parts.length - 1).join('');
    if (firstNameWithTitle.startsWith("ว่าที่ร.ต.") || firstNameWithTitle.startsWith("ว่าที่ ร.ต.")) {
      firstNameWithTitle = "ว่าที่ ร.ต. " + firstNameWithTitle.replace(/^ว่าที่\s*ร\.ต\.\s*/, '');
    }

    return `
      <div class="leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${firstNameWithTitle}</div>
      <div class="leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${surname}</div>
    `;
  }

  function generateOfficialDocumentPagesHtml(customItems) {
    const dateInfo = formatThaiDate(currentDate);
    const settings = cachedSettings;

    let items;
    if (customItems !== undefined) {
      if (customItems.length === 0) {
        return `
          <div class="a4-page-preview flex flex-col items-center justify-center text-slate-400 p-12 bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[380px]">
            <i data-lucide="file-x" class="w-16 h-16 text-slate-300 mb-3"></i>
            <h4 class="text-base font-bold text-slate-700 mb-1">ยังไม่ได้เลือกคุณครูที่ต้องการสั่งพิมพ์</h4>
            <p class="text-xs text-slate-500">กรุณาคลิกเลือกติ๊กถูก ✓ หน้ารายชื่อครูที่ต้องการพิมพ์จากแถบตัวเลือกด้านบน</p>
          </div>
        `;
      }
      items = customItems;
    } else {
      items = absentTeachersList.length > 0 ? absentTeachersList : [
        {
          teacherName: ".......................................................",
          leaveType: "ไปราชการ",
          periods: {}
        }
      ];
    }

    const pages = [];
    for (let i = 0; i < items.length; i += 2) {
      pages.push(items.slice(i, i + 2));
    }

    return pages.map((pageTeachers, pageIdx) => {
      return `
        <div class="a4-page-preview flex flex-col justify-between" id="doc-page-${pageIdx + 1}">
          
          <div>
            ${settings.logoUrl ? `
              <div class="text-center mb-1.5">
                <img src="${settings.logoUrl}" alt="ตราสัญลักษณ์โรงเรียน" style="height: ${settings.logoHeight || 80}px; max-width: 180px;" class="object-contain mx-auto">
              </div>
            ` : ''}
            <div class="text-center">
              <h1 class="text-[17px] font-bold tracking-tight">${settings.docTitle}</h1>
            </div>

            <div class="flex justify-end mt-2 text-[14.5px] leading-[1.5]">
              <div class="text-left">
                <div>${settings.schoolName} ${settings.subdistrict}</div>
                <div>${settings.district} ${settings.province} ${settings.postalCode}</div>
              </div>
            </div>

            <div class="text-[14.5px] mt-2.5 leading-[1.5] font-normal" style="margin-left: 50%;">
              <span>วันที่ ${dateInfo.day} เดือน ${dateInfo.month} พ.ศ. ${dateInfo.year}</span>
            </div>

            <div class="text-[14.5px] mt-2.5 leading-[1.5] space-y-1">
              <div class="flex">
                <span class="w-16 font-bold">เรื่อง</span>
                <span>${settings.docSubject}</span>
              </div>
              <div class="flex">
                <span class="w-16 font-bold">เรียน</span>
                <span>${settings.docDear}</span>
              </div>
            </div>

            <div class="text-[14.5px] mt-2.5 leading-[1.5] text-justify" style="text-indent: 15mm;">
              ด้วย ในวันที่ ${dateInfo.day} เดือน ${dateInfo.month} พ.ศ. ${dateInfo.year} ${settings.schoolName} มีคุณครู รายชื่อต่อไปนี้
            </div>

            <div class="mt-2.5 space-y-2.5">
              ${pageTeachers.map((t, idx) => {
                const globalIdx = (pageIdx * 2) + idx + 1;
                return `
                  <div>
                    <div class="text-[14.5px] font-bold leading-[1.5]" style="padding-left: 20mm;">${globalIdx}. ${t.teacherName}</div>
                    <div class="text-[14px] leading-[1.5] mt-0.5 space-x-4" style="padding-left: 25mm;">
                      <span>ได้ขออนุญาต</span>
                      <span>(${t.leaveType === 'ไปราชการ' ? ' ✓ ' : '&nbsp;&nbsp;&nbsp;&nbsp;'}) ไปราชการ</span>
                      <span>(${t.leaveType === 'ลากิจ' ? ' ✓ ' : '&nbsp;&nbsp;&nbsp;&nbsp;'}) ลากิจ</span>
                      <span>(${t.leaveType === 'ลาป่วย' ? ' ✓ ' : '&nbsp;&nbsp;&nbsp;&nbsp;'}) ลาป่วย</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="text-[14.5px] mt-2.5 leading-[1.5] text-justify" style="text-indent: 15mm;">
              ฉะนั้น เพื่อไม่ให้เกิดผลเสียต่อการจัดกิจกรรมการเรียนการสอน จึงมอบหมายให้ดำเนินการจัดกิจกรรมการเรียนการสอนแทน ดังต่อไปนี้
            </div>

            <div class="mt-2.5 space-y-3">
              ${pageTeachers.map((t) => {
                return `
                  <table class="gov-table" style="table-layout: fixed; width: 100%;">
                    <tbody>
                      <tr>
                        <th style="width: 15%;">ชื่อครู<br>ประจำวิชา</th>
                        <th style="width: 13%;">รายละเอียด</th>
                        <th style="width: 11.5%;">08.30 - 09.30</th>
                        <th style="width: 11.5%;">09.30 - 10.30</th>
                        <th style="width: 11.5%;">10.30 - 11.30</th>
                        <th style="width: 3.5%; font-size: 11px;" rowspan="5" class="vertical-text">พักกลางวัน</th>
                        <th style="width: 11.5%;">12.30 - 13.30</th>
                        <th style="width: 11.5%;">13.30 - 14.30</th>
                        <th style="width: 11.5%;">14.30 - 15.30</th>
                      </tr>
                      <tr>
                        <td rowspan="4" class="font-bold text-[11.5px] p-1 bg-white text-center">
                          ${formatTeacherNameForTable(t.teacherName)}
                        </td>
                        <td class="font-semibold text-left pl-2">วิชา</td>
                        <td>${(t.periods && t.periods[1]) ? t.periods[1].subject : ''}</td>
                        <td>${(t.periods && t.periods[2]) ? t.periods[2].subject : ''}</td>
                        <td>${(t.periods && t.periods[3]) ? t.periods[3].subject : ''}</td>
                        <td>${(t.periods && t.periods[5]) ? t.periods[5].subject : ''}</td>
                        <td>${(t.periods && t.periods[6]) ? t.periods[6].subject : ''}</td>
                        <td>${(t.periods && t.periods[7]) ? t.periods[7].subject : ''}</td>
                      </tr>
                      <tr>
                        <td class="font-semibold text-left pl-2">ห้อง</td>
                        <td>${(t.periods && t.periods[1]) ? t.periods[1].room : ''}</td>
                        <td>${(t.periods && t.periods[2]) ? t.periods[2].room : ''}</td>
                        <td>${(t.periods && t.periods[3]) ? t.periods[3].room : ''}</td>
                        <td>${(t.periods && t.periods[5]) ? t.periods[5].room : ''}</td>
                        <td>${(t.periods && t.periods[6]) ? t.periods[6].room : ''}</td>
                        <td>${(t.periods && t.periods[7]) ? t.periods[7].room : ''}</td>
                      </tr>
                      <tr style="height: 38px;">
                        <td class="font-semibold text-left pl-2 text-[11px] leading-tight">ชื่อครูที่เข้า<br>สอนแทน</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[1]) ? t.periods[1].substituteTeacher : '')}</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[2]) ? t.periods[2].substituteTeacher : '')}</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[3]) ? t.periods[3].substituteTeacher : '')}</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[5]) ? t.periods[5].substituteTeacher : '')}</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[6]) ? t.periods[6].substituteTeacher : '')}</td>
                        <td class="text-[10px] font-bold text-blue-900 p-0.5 text-center leading-tight">${formatTeacherNameForTable((t.periods && t.periods[7]) ? t.periods[7].substituteTeacher : '')}</td>
                      </tr>
                      <tr style="height: 32px;">
                        <td class="font-semibold text-left pl-2">รับทราบ</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                `;
              }).join('')}
            </div>
          </div>

          <div class="mt-4 pt-2 text-[14px]">
            <div class="text-center w-72 mx-auto leading-relaxed">
              <div>${settings.academicHeadRank ? settings.academicHeadRank : 'ลงชื่อ'}.......................................................</div>
              <div class="font-bold">(${settings.academicHeadName})</div>
              <div>${settings.academicHeadPosition}</div>
            </div>

            <div class="text-center w-80 mx-auto mt-4 leading-relaxed">
              <div class="space-x-8 text-[14.5px]">
                <span>☐ อนุญาต</span>
                <span>☐ ไม่อนุญาต</span>
              </div>
              <div class="mt-3">
                ${settings.directorRank}.......................................................
              </div>
              <div class="font-bold">(${settings.directorName})</div>
              <div>${settings.directorPosition}</div>
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  let isDrawerPinned = false;
  let drawerCloseTimeout = null;

  function openTeacherDrawer() {
    clearTimeout(drawerCloseTimeout);
    const drawer = document.getElementById('pdf-teacher-drawer');
    if (drawer) {
      drawer.classList.remove('-translate-x-full');
      drawer.classList.add('translate-x-0');
    }
  }

  function closeTeacherDrawer(force = false) {
    if (isDrawerPinned && !force) return;
    clearTimeout(drawerCloseTimeout);
    const drawer = document.getElementById('pdf-teacher-drawer');
    if (drawer) {
      drawer.classList.remove('translate-x-0');
      drawer.classList.add('-translate-x-full');
    }
  }

  function updatePinIconState() {
    const btn = document.getElementById('btn-pin-drawer');
    if (!btn) return;
    if (isDrawerPinned) {
      btn.className = 'p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs';
      btn.title = 'ยกเลิกการตรึงแถบ (คลิกเพื่อปลดตรึง)';
      btn.innerHTML = `<i data-lucide="pin-off" class="w-4 h-4"></i>`;
    } else {
      btn.className = 'p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer';
      btn.title = 'ตรึงแถบนี้ไว้ไม่ให้ยุบ';
      btn.innerHTML = `<i data-lucide="pin" class="w-4 h-4"></i>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function updatePdfPreviewDocument() {
    const previewBody = document.getElementById('pdf-preview-content');
    const printSection = document.getElementById('print-section');
    const badge = document.getElementById('pdf-selected-count-badge');
    const drawerCountBadge = document.getElementById('pdf-drawer-count-badge');
    const btnPrintNow = document.getElementById('btn-print-now');

    if (!previewBody) return;

    if (absentTeachersList.length === 0) {
      const html = generateOfficialDocumentPagesHtml();
      previewBody.innerHTML = html;
      if (printSection) printSection.innerHTML = html;
      if (badge) badge.textContent = 'แสดงแบบฟอร์มเปล่า (ยังไม่มีครูลา)';
      if (drawerCountBadge) drawerCountBadge.textContent = '0 ท่าน';
      if (btnPrintNow) {
        btnPrintNow.disabled = false;
        btnPrintNow.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const selectedItems = absentTeachersList.filter(t => selectedPrintTeacherNames.has(t.teacherName));
    const pageCount = selectedItems.length > 0 ? Math.ceil(selectedItems.length / 2) : 0;

    if (drawerCountBadge) {
      drawerCountBadge.textContent = `${selectedItems.length}/${absentTeachersList.length} ท่าน`;
    }

    if (badge) {
      badge.textContent = `เลือก ${selectedItems.length} จาก ${absentTeachersList.length} ท่าน (${pageCount} หน้า A4)`;
      if (selectedItems.length > 0) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200';
      } else {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200';
      }
    }

    if (btnPrintNow) {
      const isDisabled = selectedItems.length === 0;
      btnPrintNow.disabled = isDisabled;
      btnPrintNow.classList.toggle('opacity-50', isDisabled);
      btnPrintNow.classList.toggle('cursor-not-allowed', isDisabled);
    }

    const html = generateOfficialDocumentPagesHtml(selectedItems);
    previewBody.innerHTML = html;
    if (printSection) printSection.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderPdfTeacherSelectorUI() {
    const container = document.getElementById('pdf-teacher-chips-container');
    const handle = document.getElementById('pdf-drawer-handle');
    const drawer = document.getElementById('pdf-teacher-drawer');
    if (!container) return;

    if (absentTeachersList.length === 0) {
      if (handle) handle.classList.add('hidden');
      if (drawer) drawer.classList.add('hidden');
      updatePdfPreviewDocument();
      return;
    }

    if (handle) handle.classList.remove('hidden');
    if (drawer) drawer.classList.remove('hidden');

    container.innerHTML = absentTeachersList.map(item => {
      const isSelected = selectedPrintTeacherNames.has(item.teacherName);
      const grade = (cachedTeacherGrades && cachedTeacherGrades[item.teacherName]) || 'ป.1-3';
      const band = (GRADE_BANDS || []).find(b => b.key === grade) || (GRADE_BANDS && GRADE_BANDS[0]) || {
        key: 'ป.1-3', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
      };
      const hasPeriods = Object.keys(item.periods || {}).length > 0;

      return `
        <label class="pdf-teacher-chip btn-press flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${isSelected ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-400/30' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 opacity-70 hover:opacity-100'}">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="checkbox" class="pdf-teacher-checkbox accent-indigo-600 cursor-pointer w-4 h-4 rounded shrink-0" 
              value="${item.teacherName}" ${isSelected ? 'checked' : ''}>
            <div class="truncate">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black border ${band.badgeClass} shrink-0">
                  ${band.key}
                </span>
                <span class="font-bold text-slate-900 truncate">${item.teacherName}</span>
              </div>
              <div class="text-[11px] font-normal text-slate-500 mt-0.5">
                สถานะ: <span class="font-medium text-slate-700">${item.leaveType}</span>
              </div>
            </div>
          </div>
          ${hasPeriods ? `
            <span class="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-black shrink-0">
              ${Object.keys(item.periods).length} คาบ
            </span>
          ` : `
            <span class="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-500 text-[10px] font-bold shrink-0">
              ไม่มีสอน
            </span>
          `}
        </label>
      `;
    }).join('');

    container.querySelectorAll('.pdf-teacher-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const name = e.target.value;
        if (e.target.checked) {
          selectedPrintTeacherNames.add(name);
        } else {
          selectedPrintTeacherNames.delete(name);
        }
        renderPdfTeacherSelectorUI();
      });
    });

    updatePdfPreviewDocument();
  }

  function setupPdfModalListeners() {
    if (pdfModalListenersBound) return;
    pdfModalListenersBound = true;

    const handle = document.getElementById('pdf-drawer-handle');
    const drawer = document.getElementById('pdf-teacher-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnPinDrawer = document.getElementById('btn-pin-drawer');

    if (handle) {
      handle.addEventListener('mouseenter', openTeacherDrawer);
      handle.addEventListener('click', () => {
        if (drawer && drawer.classList.contains('translate-x-0')) {
          closeTeacherDrawer(true);
        } else {
          openTeacherDrawer();
        }
      });
    }

    if (drawer) {
      drawer.addEventListener('mouseenter', () => {
        clearTimeout(drawerCloseTimeout);
      });
      drawer.addEventListener('mouseleave', () => {
        if (!isDrawerPinned) {
          drawerCloseTimeout = setTimeout(() => {
            closeTeacherDrawer();
          }, 250);
        }
      });
    }

    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => {
        isDrawerPinned = false;
        updatePinIconState();
        closeTeacherDrawer(true);
      });
    }

    if (btnPinDrawer) {
      btnPinDrawer.addEventListener('click', () => {
        isDrawerPinned = !isDrawerPinned;
        updatePinIconState();
      });
    }

    const btnSelectAll = document.getElementById('btn-pdf-select-all');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        selectedPrintTeacherNames = new Set(absentTeachersList.map(t => t.teacherName));
        renderPdfTeacherSelectorUI();
      });
    }

    const btnClearAll = document.getElementById('btn-pdf-clear-all');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        selectedPrintTeacherNames.clear();
        renderPdfTeacherSelectorUI();
      });
    }

    document.querySelectorAll('.btn-pdf-filter-grade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetGrade = e.currentTarget.dataset.grade;
        selectedPrintTeacherNames = new Set(
          absentTeachersList
            .filter(t => ((cachedTeacherGrades && cachedTeacherGrades[t.teacherName]) || 'ป.1-3') === targetGrade)
            .map(t => t.teacherName)
        );
        renderPdfTeacherSelectorUI();
      });
    });
  }

  function openPdfPreviewModal(initialSelectedNames) {
    const modal = document.getElementById('pdf-preview-modal');
    if (!modal) return;

    isDrawerPinned = false;
    updatePinIconState();

    if (Array.isArray(initialSelectedNames) && initialSelectedNames.length > 0) {
      selectedPrintTeacherNames = new Set(initialSelectedNames);
      closeTeacherDrawer(true);
    } else {
      selectedPrintTeacherNames = new Set(absentTeachersList.map(t => t.teacherName));
      closeTeacherDrawer(true);
    }

    setupPdfModalListeners();
    renderPdfTeacherSelectorUI();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // Day Timetable Modal (ดูตารางสอนของวันนั้นๆ เพื่อพิจารณาจัดสอนแทน)
  // -------------------------------------------------------------
  function openDayTimetableModal(initialDay) {
    let day = initialDay;
    if (day === "เสาร์" || day === "อาทิตย์") {
      day = "จันทร์";
    }
    modalActiveDay = day || "จันทร์";
    modalGradeFilter = 'ALL';
    modalSearchQuery = '';

    let modal = document.getElementById('day-timetable-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'day-timetable-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 no-print animate-in fade-in duration-150';
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeDayTimetableModal();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const m = document.getElementById('day-timetable-modal');
          if (m && !m.classList.contains('hidden')) {
            closeDayTimetableModal();
          }
        }
      });
    }

    renderDayTimetableModalContent();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeDayTimetableModal() {
    const modal = document.getElementById('day-timetable-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function filterModalTeachers(currentDayGrid) {
    const searchLower = (modalSearchQuery || '').trim().toLowerCase();
    return (cachedTeachers || []).filter(name => {
      if (searchLower) {
        const matchesName = name.toLowerCase().includes(searchLower);
        const tIdx = cachedTeachers.indexOf(name);
        const row = currentDayGrid[tIdx] || [];
        const matchesSubject = row.some(cell => cell && cell.toLowerCase().includes(searchLower));
        if (!matchesName && !matchesSubject) return false;
      }
      if (modalGradeFilter !== 'ALL') {
        const g = (cachedTeacherGrades && cachedTeacherGrades[name]) || 'ป.1-3';
        if (g !== modalGradeFilter) return false;
      }
      return true;
    });
  }

  function renderDayTimetableRowsHtml(filteredTeachers, currentDayGrid) {
    if (filteredTeachers.length === 0) {
      return `
        <tr>
          <td colspan="${2 + cachedPeriods.length}" class="py-12 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <span>ไม่พบข้อมูลคุณครูตามเงื่อนไขที่ค้นหา</span>
          </td>
        </tr>
      `;
    }

    return filteredTeachers.map((teacherName) => {
      const tIdx = cachedTeachers.indexOf(teacherName);
      const grade = (cachedTeacherGrades && cachedTeacherGrades[teacherName]) || 'ป.1-3';
      const band = (GRADE_BANDS || []).find(b => b.key === grade) || (GRADE_BANDS && GRADE_BANDS[0]) || {
        key: 'ป.1-3', label: 'ป.1-3 (เขียวพาสเทล)', badgeClass: 'bg-emerald-200/90 text-emerald-950 border-emerald-300',
        dotClass: 'bg-emerald-500', borderClass: 'border-l-emerald-500', cellBg: 'bg-emerald-50', rowHover: 'hover:bg-emerald-100/80', textClass: 'text-emerald-950'
      };
      const teacherRow = currentDayGrid[tIdx] || ["", "", "", "", "", "", ""];
      const isAbsent = absentTeachersList.some(item => item.teacherName === teacherName);

      return `
        <tr class="${isAbsent ? 'bg-rose-50/50 hover:bg-rose-100/60' : `${band.cellBg} ${band.rowHover}`} transition-colors border-l-4 ${isAbsent ? 'border-l-rose-500' : band.borderClass} divide-x divide-slate-200/50">
          <td class="text-center font-bold py-2.5 px-2 text-slate-600">
            ${tIdx + 1}
          </td>
          <td class="px-3 py-2 font-semibold text-slate-800">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border ${band.badgeClass} shrink-0 select-none shadow-2xs">
                ${band.key}
              </span>
              <span class="font-bold text-slate-900">${teacherName}</span>
              ${isAbsent ? `
                <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                  <i data-lucide="user-x" class="w-3 h-3"></i> ลาในวันนี้
                </span>
              ` : ''}
            </div>
          </td>
          ${cachedPeriods.map((period, pIdx) => {
            const val = (teacherRow[pIdx] || "").trim();
            if (period.isBreak) {
              return `
                <td class="p-2 text-center text-amber-900 bg-amber-50/60 font-medium text-[11px]">
                  พักกลางวัน
                </td>
              `;
            }

            if (val && !val.includes("พัก")) {
              const parsed = parseSubjectAndRoom ? parseSubjectAndRoom(val) : { subject: val, room: '' };
              return `
                <td class="p-2 text-center bg-white/70">
                  <div class="font-bold text-slate-800 text-[11px] leading-tight">${parsed.subject}</div>
                  ${parsed.room ? `<div class="text-[10px] text-slate-500 font-medium mt-0.5">ห้อง ${parsed.room}</div>` : ''}
                </td>
              `;
            }

            // คาบว่าง (Free period)
            if (isAbsent) {
              return `
                <td class="p-2 text-center text-slate-300 text-xs">
                  -
                </td>
              `;
            }

            return `
              <td class="p-2 text-center bg-emerald-50/40">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 shadow-2xs select-none">
                  <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>
                  <span>ว่าง</span>
                </span>
              </td>
            `;
          }).join('')}
        </tr>
      `;
    }).join('');
  }

  function updateModalTableBodyOnly() {
    const tbody = document.getElementById('modal-timetable-tbody');
    if (!tbody) return;
    const currentDay = modalActiveDay || "จันทร์";
    const currentDayGrid = (cachedTimetables && cachedTimetables[currentDay]) || [];
    const filteredTeachers = filterModalTeachers(currentDayGrid);
    tbody.innerHTML = renderDayTimetableRowsHtml(filteredTeachers, currentDayGrid);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderDayTimetableModalContent() {
    const modal = document.getElementById('day-timetable-modal');
    if (!modal) return;

    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const currentDay = modalActiveDay || "จันทร์";
    const currentDayConfig = (THAI_DAY_CONFIG && THAI_DAY_CONFIG[currentDay]) || {
      name: `วัน${currentDay}`,
      colorName: "",
      dotClass: "bg-indigo-500",
      badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300"
    };

    const currentDayGrid = (cachedTimetables && cachedTimetables[currentDay]) || [];
    const filteredTeachers = filterModalTeachers(currentDayGrid);

    modal.innerHTML = `
      <div class="bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Modal Top Bar -->
        <div class="px-5 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <span class="p-2.5 rounded-2xl shadow-sm ${currentDayConfig.badgeClass} flex items-center justify-center shrink-0">
              <i data-lucide="sheet" class="w-5 h-5"></i>
            </span>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-bold text-slate-800">
                  ตารางสอนวัน${currentDay}
                </h3>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentDayConfig.badgeClass}">
                  <span class="w-2 h-2 rounded-full ${currentDayConfig.dotClass}"></span>
                  <span>สี${currentDayConfig.colorName}</span>
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">ตรวจสอบคาบสอนและคาบว่างของคุณครู เพื่อพิจารณาเลือกครูที่ว่างมาสอนแทน</p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            <!-- ปุ่มสลับวันด่วน -->
            <div class="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              ${days.map(d => {
                const isCur = d === currentDay;
                return `
                  <button type="button" class="btn-modal-day-switch btn-press px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${isCur ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900'}"
                    data-day="${d}">
                    ${d}
                  </button>
                `;
              }).join('')}
            </div>

            <button type="button" id="btn-close-timetable-modal" 
              class="btn-press p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Toolbar: กรองช่วงชั้น + ค้นหา + คำอธิบายสถานะ -->
        <div class="px-5 py-3 bg-white/70 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <i data-lucide="filter" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>ช่วงชั้น:</span>
            </span>

            <button type="button" 
              class="btn-modal-grade-filter btn-press px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${modalGradeFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}" 
              data-grade="ALL">
              ทั้งหมด (${(cachedTeachers || []).length})
            </button>

            ${(GRADE_BANDS || []).map(b => {
              const count = (cachedTeachers || []).filter(t => (cachedTeacherGrades[t] || 'ป.1-3') === b.key).length;
              const isSelected = modalGradeFilter === b.key;
              return `
                <button type="button" 
                  class="btn-modal-grade-filter btn-press inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${b.badgeClass} ${isSelected ? 'ring-2 ring-indigo-500/40 shadow-xs scale-105 font-black' : 'opacity-85 hover:opacity-100 shadow-2xs'}" 
                  data-grade="${b.key}">
                  <span class="w-2 h-2 rounded-full ${b.dotClass}"></span>
                  <span>${b.key}</span>
                  <span class="px-1.5 py-0.2 rounded-full bg-white/90 text-[10px] font-black">${count}</span>
                </button>
              `;
            }).join('')}
          </div>

          <div class="flex items-center gap-3">
            <!-- สถานะสี (Legend) -->
            <div class="hidden xl:flex items-center gap-2 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[11px]">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ว่าง (จัดสอนได้)
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold border border-rose-200 text-[11px]">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span> ครูที่ลา
              </span>
            </div>

            <!-- ค้นหา -->
            <div class="relative w-full sm:w-60">
              <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
              <input type="text" id="modal-timetable-search" value="${modalSearchQuery}"
                placeholder="ค้นหาชื่อครู หรือวิชา..."
                class="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs">
            </div>
          </div>
        </div>

        <!-- Table Body -->
        <div class="flex-1 overflow-auto p-4 sm:p-5 sheet-scroll">
          <div class="border border-slate-200/80 rounded-2xl bg-white shadow-2xs overflow-hidden">
            <table class="w-full text-xs text-left border-collapse">
              <thead class="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-10 shadow-xs backdrop-blur-md">
                <tr class="divide-x divide-slate-200/70 border-b border-slate-200">
                  <th class="py-2.5 px-2 text-center w-12 bg-slate-100">ลำดับ</th>
                  <th class="py-2.5 px-4 text-left w-56 bg-slate-100">รายชื่อคุณครู</th>
                  ${cachedPeriods.map(p => `
                    <th class="py-2.5 px-2 text-center min-w-[110px] ${p.isBreak ? 'bg-amber-100/80 text-amber-950' : 'bg-slate-100'}">
                      <div class="font-extrabold">${p.name}</div>
                      <div class="text-[10px] font-normal text-slate-500">${p.time}</div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody id="modal-timetable-tbody" class="divide-y divide-slate-200/60">
                ${renderDayTimetableRowsHtml(filteredTeachers, currentDayGrid)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 text-xs">
          <div class="flex items-center gap-2 text-slate-600">
            <i data-lucide="info" class="w-4 h-4 text-indigo-500 shrink-0"></i>
            <span>คุณครูที่มีป้าย <strong>"ว่าง" สีเขียว</strong> คือครูที่ไม่มีตารางสอนในคาบนั้น สามารถจัดให้สอนแทนได้</span>
          </div>

          <button type="button" id="btn-close-timetable-modal-footer" 
            class="btn-press px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer self-end sm:self-auto">
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    `;

    // Handlers
    document.getElementById('btn-close-timetable-modal').addEventListener('click', closeDayTimetableModal);
    document.getElementById('btn-close-timetable-modal-footer').addEventListener('click', closeDayTimetableModal);

    modal.querySelectorAll('.btn-modal-day-switch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modalActiveDay = e.currentTarget.dataset.day;
        renderDayTimetableModalContent();
      });
    });

    modal.querySelectorAll('.btn-modal-grade-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modalGradeFilter = e.currentTarget.dataset.grade;
        renderDayTimetableModalContent();
      });
    });

    const searchInput = document.getElementById('modal-timetable-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        modalSearchQuery = e.target.value;
        updateModalTableBodyOnly();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  global.TeachSubstitute = {
    initSubstitutePage,
    generateOfficialDocumentPagesHtml
  };
})(typeof window !== 'undefined' ? window : this);
