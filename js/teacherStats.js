/**
 * teacherStats.js - หน้ารายชื่อครูทุกคน นับสถิติการสอนแทน และสถิติการลา (ไปราชการ, ลากิจ, ลาป่วย)
 */

(function(global) {
  const getDB = () => global.TeachDatabase || {};
  const getTeachers = () => getDB().getTeachers();
  const getSubstitutions = () => getDB().getSubstitutions();
  const recordSubstitutions = (...args) => getDB().recordSubstitutions(...args);
  const deleteSubstitution = (...args) => getDB().deleteSubstitution(...args);
  const deleteSubstitutionsBatch = (...args) => getDB().deleteSubstitutionsBatch(...args);
  const { formatThaiDate, getAdminPin, verifyAdminPin, GRADE_BANDS = [], DEFAULT_TEACHER_GRADES = {} } = global.TeachData || {};

  let cachedTeachers = [];
  let cachedSubstitutions = [];
  let cachedTeacherGrades = {};
  let searchQuery = "";
  let sortBy = "subCountDesc";
  let selectedGradeFilter = "ALL";
  let currentModalTab = "sub"; // 'sub' | 'leave'

  async function initTeacherStatsPage() {
    const container = document.getElementById('view-teacher-stats');
    if (!container) return;

    cachedTeachers = await getTeachers();
    cachedSubstitutions = await getSubstitutions();
    if (getDB().getTeacherGrades) {
      try {
        const grades = await getDB().getTeacherGrades();
        if (grades && typeof grades === 'object') {
          cachedTeacherGrades = grades;
        }
      } catch (e) {
        console.warn("Load teacher grades in stats error:", e);
      }
    }

    renderTeacherStatsUI();
  }

  function createEmptyTeacherStat(name) {
    return {
      name,
      subCount: 0,
      subHistory: [],
      leaveCounts: {
        officialDuty: 0, // ไปราชการ
        personal: 0,     // ลากิจ
        sick: 0,         // ลาป่วย
        other: 0,        // อื่นๆ
        total: 0
      },
      leaveEvents: [],
      leaveEventsMap: {}
    };
  }

  function calculateTeacherStats() {
    const teacherMap = {};

    cachedTeachers.forEach(name => {
      teacherMap[name] = createEmptyTeacherStat(name);
    });

    cachedSubstitutions.forEach(item => {
      // 1. สถิติการสอนแทน (ครูที่เป็นผู้สอนแทน)
      const subName = item.substituteTeacher && item.substituteTeacher.trim();
      if (subName) {
        if (!teacherMap[subName]) {
          teacherMap[subName] = createEmptyTeacherStat(subName);
        }
        teacherMap[subName].subCount++;
        teacherMap[subName].subHistory.push(item);
      }

      // 2. สถิติการลา (ครูที่เป็นผู้ลา)
      const absentName = item.absentTeacher && item.absentTeacher.trim();
      if (absentName) {
        if (!teacherMap[absentName]) {
          teacherMap[absentName] = createEmptyTeacherStat(absentName);
        }
        const t = teacherMap[absentName];
        const dateKey = `${item.date || 'unknown'}_${absentName}`;
        const leaveType = (item.leaveType || 'ไปราชการ').trim();

        if (!t.leaveEventsMap[dateKey]) {
          const newEvent = {
            key: dateKey,
            date: item.date || '',
            dayOfWeek: item.dayOfWeek || '',
            leaveType: leaveType,
            periods: [],
            recordIds: []
          };
          t.leaveEventsMap[dateKey] = newEvent;
          t.leaveEvents.push(newEvent);

          // นับจำนวนครั้งการลา (1 วัน / 1 เหตุการณ์ นับเป็น 1 ครั้ง)
          if (leaveType === 'ไปราชการ') {
            t.leaveCounts.officialDuty++;
          } else if (leaveType === 'ลากิจ') {
            t.leaveCounts.personal++;
          } else if (leaveType === 'ลาป่วย') {
            t.leaveCounts.sick++;
          } else {
            t.leaveCounts.other++;
          }
          t.leaveCounts.total++;
        }

        const ev = t.leaveEventsMap[dateKey];
        if (item.id && !ev.recordIds.includes(item.id)) {
          ev.recordIds.push(item.id);
        }

        if (item.periodId && item.periodId > 0) {
          ev.periods.push({
            id: item.id,
            periodId: item.periodId,
            periodTime: item.periodTime || '',
            subject: item.subject || '',
            room: item.room || '',
            substituteTeacher: item.substituteTeacher || 'ไม่มีผู้สอนแทน'
          });
        }
      }
    });

    // เรียงประวัติการสอนแทนและประวัติการลาจากวันที่ล่าสุดไปหาเก่าสุด
    Object.values(teacherMap).forEach(t => {
      t.subHistory.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      t.leaveEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });

    return teacherMap;
  }

  function getLeaveTypeBadge(type) {
    if (type === 'ไปราชการ') {
      return {
        icon: '🏛️',
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    } else if (type === 'ลากิจ') {
      return {
        icon: '📝',
        className: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    } else if (type === 'ลาป่วย') {
      return {
        icon: '🏥',
        className: 'bg-rose-100 text-rose-800 border-rose-200'
      };
    }
    return {
      icon: '📋',
      className: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }

  function renderTeacherStatsUI() {
    const container = document.getElementById('view-teacher-stats');
    if (!container) return;

    const teacherStatsMap = calculateTeacherStats();

    let list = cachedTeachers.map((name, index) => {
      const stats = teacherStatsMap[name] || createEmptyTeacherStat(name);
      const grade = (cachedTeacherGrades && cachedTeacherGrades[name]) || (DEFAULT_TEACHER_GRADES && DEFAULT_TEACHER_GRADES[name]) || 'ป.1-3';
      return {
        originalIndex: index + 1,
        name,
        grade,
        subCount: stats.subCount,
        subHistory: stats.subHistory,
        leaveCounts: stats.leaveCounts,
        leaveEvents: stats.leaveEvents
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(q));
    }

    if (selectedGradeFilter && selectedGradeFilter !== 'ALL') {
      list = list.filter(item => item.grade === selectedGradeFilter);
    }

    // เรียงลำดับ: มากไปน้อย / น้อยไปมาก / ตามลำดับ
    if (sortBy === 'subCountDesc') {
      list.sort((a, b) => b.subCount - a.subCount || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'subCountAsc') {
      list.sort((a, b) => a.subCount - b.subCount || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'orderAsc') {
      list.sort((a, b) => a.originalIndex - b.originalIndex);
    }

    container.innerHTML = `
      <div class="max-w-6xl mx-auto space-y-6">

        <!-- Modern Header Card -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                <span class="p-2.5 bg-gradient-to-tr from-indigo-500 to-violet-600 text-white rounded-2xl shadow-sm shadow-indigo-500/20">
                  <i data-lucide="users" class="w-5 h-5 sm:w-6 sm:h-6"></i>
                </span>
                วันลาและการสอนแทน
              </h2>
              <p class="text-xs sm:text-sm text-slate-500 mt-1">ติดตามสถิติการลา (ไปราชการ, ลากิจ, ลาป่วย) และจำนวนครั้งการปฏิบัติหน้าที่สอนแทนของคุณครู</p>
            </div>

            <!-- Controls: ค้นหา & ตัวกรองช่วงชั้น & เรียงลำดับ -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div class="relative w-full sm:w-60">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                <input type="text" id="teacher-search-input" value="${searchQuery}" 
                  placeholder="ค้นหาชื่อคุณครู..." 
                  class="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs">
              </div>

              <!-- ตัวกรองช่วงชั้น -->
              <div class="flex items-center gap-1.5 w-full sm:w-auto">
                <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">ช่วงชั้น:</span>
                <select id="teacher-grade-filter-select" 
                  class="w-full sm:w-auto bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer">
                  <option value="ALL" ${selectedGradeFilter === 'ALL' ? 'selected' : ''}>ทั้งหมด</option>
                  <option value="อนุบาล" ${selectedGradeFilter === 'อนุบาล' ? 'selected' : ''}>🟠 อนุบาล</option>
                  <option value="ป.1-3" ${selectedGradeFilter === 'ป.1-3' ? 'selected' : ''}>🟢 ป.1-3</option>
                  <option value="ป.4-6" ${selectedGradeFilter === 'ป.4-6' ? 'selected' : ''}>🔴 ป.4-6</option>
                  <option value="ม.1-3" ${selectedGradeFilter === 'ม.1-3' ? 'selected' : ''}>🔵 ม.1-3</option>
                  <option value="ม.4-6" ${selectedGradeFilter === 'ม.4-6' ? 'selected' : ''}>🟣 ม.4-6</option>
                </select>
              </div>

              <!-- เรียงลำดับ: มากไปน้อย / น้อยไปมาก / ตามลำดับ -->
              <div class="flex items-center gap-1.5 w-full sm:w-auto">
                <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">เรียง:</span>
                <select id="teacher-sort-select" 
                  class="w-full sm:w-auto bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer">
                  <option value="subCountDesc" ${sortBy === 'subCountDesc' ? 'selected' : ''}>มากไปน้อย</option>
                  <option value="subCountAsc" ${sortBy === 'subCountAsc' ? 'selected' : ''}>น้อยไปมาก</option>
                  <option value="orderAsc" ${sortBy === 'orderAsc' ? 'selected' : ''}>ตามลำดับ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Table Card (Glass Card) -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div class="flex justify-end px-4 pt-3 no-print">
            <button id="btn-print-teacher-report" type="button"
              class="btn-press inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="พิมพ์รายงานสถิติการลาและการสอนแทน">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/90 border-b border-slate-200/80 text-xs font-bold text-slate-600">
                  <th class="py-3 px-3 w-14 text-center">ลำดับ</th>
                  <th class="py-3 px-5">ชื่อคุณครู</th>
                  <th class="py-3 px-4 text-center">สถิติการลา (ครั้ง)</th>
                  <th class="py-3 px-4 text-center w-36">การสอนแทน</th>
                  <th class="py-3 px-4 text-center w-32">ประวัติ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${list.length === 0 ? `
                  <tr>
                    <td colspan="5" class="text-center py-10 text-slate-400">
                      ไม่พบข้อมูลคุณครูตามคำค้นหา
                    </td>
                  </tr>
                ` : list.map((teacher) => {
                  const badgeColor = teacher.subCount >= 5 
                    ? 'bg-rose-50 text-rose-800 border-rose-200/80' 
                    : teacher.subCount > 0 
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80' 
                      : 'bg-slate-100 text-slate-600 border-slate-200/80';

                  const gradeBand = (GRADE_BANDS || []).find(b => b.key === teacher.grade) || {
                    badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300'
                  };

                  return `
                    <tr class="hover:bg-indigo-50/20 transition-colors">
                      <td class="py-3.5 px-3 text-center text-xs font-semibold text-slate-400">
                        ${teacher.originalIndex}
                      </td>
                      <td class="py-3.5 px-5">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-slate-800">${teacher.name}</span>
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${gradeBand.badgeClass} shrink-0">
                            ${teacher.grade}
                          </span>
                        </div>
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        <div class="flex items-center justify-center gap-1.5 flex-wrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${teacher.leaveCounts.total > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-500 border border-slate-200/80'}">
                            รวม ${teacher.leaveCounts.total} ครั้ง
                          </span>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70" title="ไปราชการ">
                            🏛️ ราชการ ${teacher.leaveCounts.officialDuty}
                          </span>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70" title="ลากิจ">
                            📝 ลากิจ ${teacher.leaveCounts.personal}
                          </span>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70" title="ลาป่วย">
                            🏥 ป่วย ${teacher.leaveCounts.sick}
                          </span>
                        </div>
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeColor} shadow-2xs">
                          <i data-lucide="${teacher.subCount > 0 ? 'check-circle-2' : 'clock'}" class="w-3.5 h-3.5"></i>
                          ${teacher.subCount} ครั้ง
                        </span>
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        <button class="btn-view-history btn-press hover-lift-sm inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all shadow-2xs cursor-pointer"
                          data-teacher="${teacher.name}">
                          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                          ดูประวัติ
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

      <!-- Modal: ประวัติของครู (สอนแทน & การลา) -->
      <div id="teacher-history-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 hidden items-center justify-center p-4">
        <div class="glass-card rounded-3xl shadow-2xl border border-slate-200/90 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-white/90">
            <div class="flex items-center gap-2.5">
              <span class="p-2.5 bg-gradient-to-tr from-indigo-500 to-violet-600 text-white rounded-xl shadow-xs shadow-indigo-500/20">
                <i data-lucide="history" class="w-5 h-5"></i>
              </span>
              <div>
                <h3 id="modal-teacher-name" class="font-bold text-slate-800 text-base">ประวัติและสถิติ</h3>
                <p id="modal-teacher-subtitle" class="text-xs text-slate-500"></p>
              </div>
            </div>
            <button id="btn-close-history-modal" class="btn-press p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Modal Tabs (Segmented Glass) -->
          <div class="px-5 pt-3 border-b border-slate-200/80 flex items-center gap-2 bg-slate-50/70">
            <button id="tab-btn-sub" class="pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer">
              ประวัติการสอนแทน
            </button>
            <button id="tab-btn-leave" class="pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer">
              ประวัติการลา
            </button>
          </div>

          <!-- Modal Content -->
          <div id="modal-history-content" class="p-5 overflow-y-auto space-y-3 flex-1 text-sm bg-slate-50/40">
          </div>

          <div class="p-4 border-t border-slate-100 bg-white/90 flex justify-end">
            <button id="btn-close-history-modal-footer" class="btn-press px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('teacher-search-input');
    searchInput.addEventListener('input', (e) => {
      const cursorStart = e.target.selectionStart;
      const cursorEnd = e.target.selectionEnd;
      searchQuery = e.target.value;
      renderTeacherStatsUI();

      // Rendering replaces the input element, so restore focus and caret for continuous typing.
      const refreshedSearchInput = document.getElementById('teacher-search-input');
      if (refreshedSearchInput) {
        refreshedSearchInput.focus();
        if (typeof cursorStart === 'number' && typeof cursorEnd === 'number') {
          refreshedSearchInput.setSelectionRange(cursorStart, cursorEnd);
        }
      }
    });

    const gradeFilterSelect = document.getElementById('teacher-grade-filter-select');
    if (gradeFilterSelect) {
      gradeFilterSelect.addEventListener('change', (e) => {
        selectedGradeFilter = e.target.value;
        renderTeacherStatsUI();
      });
    }

    const sortSelect = document.getElementById('teacher-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderTeacherStatsUI();
      });
    }

    const printReportButton = document.getElementById('btn-print-teacher-report');
    if (printReportButton) {
      printReportButton.addEventListener('click', () => {
        const printSection = document.getElementById('print-section');
        if (!printSection) return;

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[char]);
        const sortedLabel = sortSelect.options[sortSelect.selectedIndex]?.textContent.trim() || '';
        const gradeFilterLabel = selectedGradeFilter !== 'ALL' ? ` • ช่วงชั้น: ${selectedGradeFilter}` : '';
        const searchLabel = searchQuery.trim()
          ? `<div>คำค้นหา: ${escapeHtml(searchQuery.trim())}</div>`
          : '';
        const printedAt = new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'long',
          timeStyle: 'short'
        }).format(new Date());
        const reportRows = list.map((teacher, index) => `
          <tr>
            <td class="report-center">${index + 1}</td>
            <td>${escapeHtml(teacher.name)} <small style="color:#64748b;">(${escapeHtml(teacher.grade)})</small></td>
            <td class="report-center">${teacher.leaveCounts.officialDuty}</td>
            <td class="report-center">${teacher.leaveCounts.personal}</td>
            <td class="report-center">${teacher.leaveCounts.sick}</td>
            <td class="report-center">${teacher.leaveCounts.total}</td>
            <td class="report-center">${teacher.subCount}</td>
          </tr>
        `).join('');

        printSection.innerHTML = `
          <article class="teacher-stats-print-report">
            <header class="teacher-stats-report-header">
              <h1>รายงานสถิติการลาและการสอนแทน</h1>
              <div>ข้อมูลคุณครู ${list.length} ท่าน${escapeHtml(gradeFilterLabel)} • เรียงตาม${escapeHtml(sortedLabel)}</div>
              ${searchLabel}
              <div>พิมพ์เมื่อ ${escapeHtml(printedAt)}</div>
            </header>
            <table class="teacher-stats-print-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ชื่อคุณครู</th>
                  <th>ไปราชการ</th>
                  <th>ลากิจ</th>
                  <th>ลาป่วย</th>
                  <th>รวมลา</th>
                  <th>สอนแทน</th>
                </tr>
              </thead>
              <tbody>
                ${reportRows || '<tr><td colspan="7" class="report-center">ไม่พบข้อมูลคุณครู</td></tr>'}
              </tbody>
            </table>
          </article>`;
        window.print();
      });
    }

    container.querySelectorAll('.btn-view-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const teacherName = e.currentTarget.dataset.teacher;
        const stats = teacherStatsMap[teacherName] || createEmptyTeacherStat(teacherName);
        // หากไม่มีการสอนแทนแต่มีประวัติการลา ให้เปิดแท็บการลาเป็นค่าเริ่มต้น
        if (stats.subCount === 0 && stats.leaveCounts.total > 0) {
          currentModalTab = "leave";
        } else {
          currentModalTab = "sub";
        }
        openTeacherHistoryModal(teacherName, stats);
      });
    });

    const modal = document.getElementById('teacher-history-modal');
    const closeModal = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    };
    document.getElementById('btn-close-history-modal').addEventListener('click', closeModal);
    document.getElementById('btn-close-history-modal-footer').addEventListener('click', closeModal);

    if (window.lucide) window.lucide.createIcons();
  }

  function checkAdminPin(entered) {
    if (typeof verifyAdminPin === 'function') {
      return verifyAdminPin(entered);
    }
    const saved = localStorage.getItem('teach_admin_pin');
    const correctPin = (!saved || saved === '0000') ? '1111' : saved;
    return String(entered || '').trim() === correctPin;
  }

  function requestAdminPinConfirm(options) {
    if (global.TeachApp && typeof global.TeachApp.requestAdminPinConfirm === 'function') {
      return global.TeachApp.requestAdminPinConfirm(options);
    }
    const { detailHtml, onConfirm } = options || {};
    const pinModal = document.getElementById('admin-pin-confirm-modal');
    const pinCard = document.getElementById('admin-pin-modal-card');
    const pinInput = document.getElementById('admin-pin-confirm-input');
    const pinError = document.getElementById('admin-pin-confirm-error');
    const pinDetail = document.getElementById('admin-pin-item-detail');
    const btnCancel = document.getElementById('btn-cancel-admin-pin');
    const btnSubmit = document.getElementById('btn-submit-admin-pin');

    if (!pinModal || !pinInput) {
      const entered = prompt("กรุณากรอกรหัสผ่านแอดมิน 4 หลัก เพื่อยืนยันการลบ:");
      if (entered && checkAdminPin(entered)) {
        onConfirm();
      } else if (entered) {
        alert("รหัสผ่านแอดมินไม่ถูกต้อง");
      }
      return;
    }

    if (pinDetail) pinDetail.innerHTML = detailHtml || '';
    if (pinError) pinError.classList.add('hidden');
    pinInput.value = '';
    pinModal.classList.remove('hidden');
    pinModal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      pinInput.focus();
    }, 100);

    const closeModal = () => {
      pinModal.classList.add('hidden');
      pinModal.classList.remove('flex');
      pinInput.value = '';
      if (pinError) pinError.classList.add('hidden');
    };

    btnCancel.onclick = closeModal;
    pinModal.onclick = (e) => {
      if (e.target === pinModal) closeModal();
    };

    let isSubmitting = false;
    const doVerifyAndExecute = async () => {
      if (isSubmitting) return;
      const enteredPin = pinInput.value.trim();
      if (checkAdminPin(enteredPin)) {
        isSubmitting = true;
        closeModal();
        try {
          await onConfirm();
          if (global.TeachApp && global.TeachApp.showToast) {
            global.TeachApp.showToast("ลบรายการประวัติเรียบร้อยแล้ว", "success");
          }
        } catch (err) {
          console.error("Delete record error:", err);
          alert("เกิดข้อผิดพลาดในการลบ: " + (err.message || err));
        } finally {
          isSubmitting = false;
        }
      } else {
        if (pinError) pinError.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
        if (pinCard) {
          pinCard.classList.remove('animate-shake');
          void pinCard.offsetWidth;
          pinCard.classList.add('animate-shake');
        }
        pinInput.value = '';
        pinInput.focus();
      }
    };

    btnSubmit.onclick = doVerifyAndExecute;

    pinInput.oninput = () => {
      if (pinError) pinError.classList.add('hidden');
      if (pinInput.value.length === 4) {
        setTimeout(doVerifyAndExecute, 120);
      }
    };

    pinInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doVerifyAndExecute();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };
  }

  function openTeacherHistoryModal(teacherName, stats) {
    const modal = document.getElementById('teacher-history-modal');
    const title = document.getElementById('modal-teacher-name');
    const subtitle = document.getElementById('modal-teacher-subtitle');
    const content = document.getElementById('modal-history-content');
    const tabBtnSub = document.getElementById('tab-btn-sub');
    const tabBtnLeave = document.getElementById('tab-btn-leave');

    title.innerText = `ประวัติและสถิติ: ${teacherName}`;
    subtitle.innerText = `สอนแทน ${stats.subCount} ครั้ง • ลารวม ${stats.leaveCounts.total} ครั้ง (ราชการ ${stats.leaveCounts.officialDuty} | ลากิจ ${stats.leaveCounts.personal} | ลาป่วย ${stats.leaveCounts.sick})`;

    tabBtnSub.innerText = `ประวัติการสอนแทน (${stats.subCount} ครั้ง)`;
    tabBtnLeave.innerText = `ประวัติการลา (${stats.leaveCounts.total} ครั้ง)`;

    function updateTabAppearance() {
      if (currentModalTab === 'sub') {
        tabBtnSub.className = "pb-2.5 px-2 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 cursor-pointer";
        tabBtnLeave.className = "pb-2.5 px-2 text-xs font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 cursor-pointer";
      } else {
        tabBtnLeave.className = "pb-2.5 px-2 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 cursor-pointer";
        tabBtnSub.className = "pb-2.5 px-2 text-xs font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 cursor-pointer";
      }
    }

    function renderModalContent() {
      updateTabAppearance();

      if (currentModalTab === 'sub') {
        // แท็บ 1: ประวัติการสอนแทน
        const historyItems = stats.subHistory;
        if (historyItems.length === 0) {
          content.innerHTML = `
            <div class="text-center py-10 text-slate-400 text-xs">
              <i data-lucide="calendar" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
              ยังไม่มีประวัติการได้รับมอบหมายให้สอนแทน
            </div>
          `;
        } else {
          content.innerHTML = historyItems.map(item => `
            <div class="glass-card hover-lift-sm rounded-xl p-3.5 flex items-center justify-between gap-3 border border-slate-200/80 bg-white">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-800">${item.date} (${item.dayOfWeek})</span>
                  <span class="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold border border-indigo-200/60">คาบ ${item.periodId}</span>
                  <span class="text-[11px] text-slate-400 font-medium">${item.periodTime || ''}</span>
                </div>
                <div class="text-xs text-slate-600">
                  <strong>วิชา:</strong> ${item.subject || '-'} ${item.room ? `(${item.room})` : ''} 
                  • <strong>แทนคุณครู:</strong> <span class="text-rose-600 font-bold">${item.absentTeacher}</span> (${item.leaveType || 'ไปราชการ'})
                </div>
              </div>

              <button class="btn-delete-sub-record btn-press text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                data-id="${item.id}" title="ลบรายการนี้">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('');

          content.querySelectorAll('.btn-delete-sub-record').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const id = e.currentTarget.dataset.id;
              const targetRecord = cachedSubstitutions.find(record => record.id === id);
              if (!targetRecord) return;

              const detailHtml = `
                <div class="space-y-1.5">
                  <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-1.5 text-rose-700">
                    <i data-lucide="calendar-x" class="w-4 h-4"></i>
                    <span>ยกเลิกการสอนแทนคาบนี้:</span>
                  </div>
                  <div><strong>วันที่:</strong> ${targetRecord.date} (${targetRecord.dayOfWeek || ''}) • คาบ ${targetRecord.periodId} (${targetRecord.periodTime || ''})</div>
                  <div><strong>วิชา:</strong> ${targetRecord.subject || '-'} ${targetRecord.room ? `(${targetRecord.room})` : ''}</div>
                  <div><strong>ครูผู้สอนแทนเดิม:</strong> <span class="font-bold text-indigo-700">${targetRecord.substituteTeacher || teacherName}</span></div>
                  <div><strong>แทนคุณครู:</strong> <span class="text-rose-600 font-bold">${targetRecord.absentTeacher}</span> (${targetRecord.leaveType || 'ไปราชการ'})</div>
                  <div class="text-emerald-700 font-semibold mt-1 text-[11px] bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    💡 ระบบจะยกเลิกชื่อผู้สอนแทน และเปลี่ยนสถานะคาบนี้เป็น <strong>-- เลือกครูสอนแทน --</strong> โดยวิชาและข้อมูลคาบสอนจะยังคงอยู่ครบถ้วน
                  </div>
                </div>
              `;

              requestAdminPinConfirm({
                detailHtml,
                onConfirm: async () => {
                  const targetAbsentTeacher = String(targetRecord.absentTeacher || '').trim();
                  const targetDate = targetRecord.date;
                  const targetPeriodId = Number(targetRecord.periodId || 0);

                  // ค้นหารายการทั้งหมดของครูที่ลาในวันดังกล่าวเพื่อคงวิชาและคาบอื่นๆ ไว้
                  const sameTeacherRecords = (cachedSubstitutions || []).filter(r =>
                    r && r.date === targetDate && String(r.absentTeacher || '').trim() === targetAbsentTeacher
                  );

                  let updatedTeacherRecords = [];
                  if (sameTeacherRecords.length > 0) {
                    updatedTeacherRecords = sameTeacherRecords.map(r => {
                      if (r.id === targetRecord.id || (Number(r.periodId) === targetPeriodId && r.date === targetDate && String(r.absentTeacher || '').trim() === targetAbsentTeacher)) {
                        return {
                          ...r,
                          substituteTeacher: '' // ปลดชื่อครูสอนแทนออก ให้กลับเป็นว่าง (--เลือกครูสอนแทน--) โดยคงวิชาและข้อมูลคาบไว้
                        };
                      }
                      return r;
                    });
                  } else {
                    updatedTeacherRecords = [{
                      ...targetRecord,
                      substituteTeacher: ''
                    }];
                  }

                  if (typeof recordSubstitutions === 'function') {
                    cachedSubstitutions = await recordSubstitutions(updatedTeacherRecords);
                  } else if (typeof deleteSubstitution === 'function') {
                    cachedSubstitutions = await deleteSubstitution(id);
                  }

                  renderTeacherStatsUI();
                  const updatedStatsMap = calculateTeacherStats();
                  openTeacherHistoryModal(teacherName, updatedStatsMap[teacherName] || createEmptyTeacherStat(teacherName));

                  if (global.TeachApp && global.TeachApp.showToast) {
                    global.TeachApp.showToast(`ยกเลิกการสอนแทนคาบ ${targetPeriodId} เรียบร้อย (เปลี่ยนสถานะเป็นเลือกครูสอนแทน)`, "success");
                  }
                }
              });
            });
          });
        }
      } else {
        // แท็บ 2: ประวัติการลา
        const leaveEvents = stats.leaveEvents;
        if (leaveEvents.length === 0) {
          content.innerHTML = `
            <div class="text-center py-10 text-slate-400 text-xs">
              <i data-lucide="file-check-2" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
              ยังไม่มีประวัติการลา
            </div>
          `;
        } else {
          content.innerHTML = leaveEvents.map(event => {
            const badge = getLeaveTypeBadge(event.leaveType);
            return `
              <div class="glass-card hover-lift-sm rounded-2xl p-4 space-y-2.5 border border-slate-200/80 bg-white">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-800">${event.date} (${event.dayOfWeek})</span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.className}">
                      <span>${badge.icon}</span>
                      <span>${event.leaveType}</span>
                    </span>
                  </div>
                  <button class="btn-delete-leave-event btn-press text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    data-record-ids="${event.recordIds.join(',')}" title="ลบประวัติการลานี้">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>

                <div>
                  ${event.periods.length === 0 ? `
                    <div class="text-xs text-slate-400 italic">ไม่มีคาบสอนในวันดังกล่าว (หรือไม่ได้ระบุผู้สอนแทน)</div>
                  ` : `
                    <div class="space-y-1.5">
                      <div class="text-[11px] font-semibold text-slate-500">คาบที่ได้รับการสอนแทน:</div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${event.periods.map(p => `
                          <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs shadow-2xs">
                            <div class="font-bold text-slate-700 flex items-center justify-between">
                              <span class="text-indigo-700">คาบ ${p.periodId} (${p.periodTime || ''})</span>
                              <span class="text-[11px] text-slate-500 font-normal">${p.room || ''}</span>
                            </div>
                            <div class="text-slate-600 mt-1">
                              ${p.subject ? `วิชา: <strong>${p.subject}</strong><br>` : ''}
                              ผู้สอนแทน: ${p.substituteTeacher && p.substituteTeacher !== 'ไม่มีผู้สอนแทน'
                                ? `<span class="text-indigo-600 font-semibold">${p.substituteTeacher}</span>`
                                : `<span class="text-amber-600 font-semibold italic">⚠️ ยังไม่ได้ระบุผู้สอนแทน</span>`}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('');

          content.querySelectorAll('.btn-delete-leave-event').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const rawIds = e.currentTarget.dataset.recordIds;
              const ids = rawIds ? rawIds.split(',').filter(Boolean) : [];
              if (ids.length === 0) return;

              const detailHtml = `
                <div class="space-y-1.5">
                  <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-1.5 text-rose-700">
                    <i data-lucide="file-x-2" class="w-4 h-4"></i>
                    <span>ลบประวัติการลา:</span>
                  </div>
                  <div><strong>วันที่:</strong> ${event.date} (${event.dayOfWeek || ''})</div>
                  <div><strong>คุณครูผู้ลา:</strong> <span class="font-bold text-slate-800">${teacherName}</span></div>
                  <div><strong>ประเภทการลา:</strong> <span class="text-rose-600 font-bold">${event.leaveType}</span></div>
                  <div><strong>จำนวนคาบที่บันทึกไว้:</strong> ${ids.length} คาบ</div>
                  <div class="text-amber-700 font-semibold mt-1 text-[11px] bg-amber-50 p-1.5 rounded-lg border border-amber-200/80">* การลบรายการนี้จะลบสถิติการลาและคาบสอนแทนทั้งหมดของวันนี้</div>
                </div>
              `;

              requestAdminPinConfirm({
                detailHtml,
                onConfirm: async () => {
                  if (deleteSubstitutionsBatch) {
                    cachedSubstitutions = await deleteSubstitutionsBatch(ids);
                  } else {
                    for (const id of ids) {
                      cachedSubstitutions = await deleteSubstitution(id);
                    }
                  }
                  renderTeacherStatsUI();
                  const updatedStatsMap = calculateTeacherStats();
                  openTeacherHistoryModal(teacherName, updatedStatsMap[teacherName] || createEmptyTeacherStat(teacherName));
                }
              });
            });
          });
        }
      }

      if (window.lucide) window.lucide.createIcons();
    }

    tabBtnSub.onclick = () => {
      currentModalTab = 'sub';
      renderModalContent();
    };

    tabBtnLeave.onclick = () => {
      currentModalTab = 'leave';
      renderModalContent();
    };

    renderModalContent();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  global.TeachStats = {
    initTeacherStatsPage
  };
})(typeof window !== 'undefined' ? window : this);
