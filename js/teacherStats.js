/**
 * teacherStats.js - หน้ารายชื่อครูทุกคน นับสถิติการสอนแทน และสถิติการลา (ไปราชการ, ลากิจ, ลาป่วย)
 */

(function(global) {
  const db = global.TeachDatabase || global.TeachSupabase;
  const { getTeachers, getSubstitutions, deleteSubstitution, deleteSubstitutionsBatch } = db;
  const { formatThaiDate } = global.TeachData;

  let cachedTeachers = [];
  let cachedSubstitutions = [];
  let searchQuery = "";
  let sortBy = "subCountDesc";
  let currentModalTab = "sub"; // 'sub' | 'leave'
  let currentModalTeacher = null;

  async function initTeacherStatsPage() {
    const container = document.getElementById('view-teacher-stats');
    if (!container) return;

    cachedTeachers = await getTeachers();
    cachedSubstitutions = await getSubstitutions();

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
      return {
        originalIndex: index + 1,
        name,
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

    // เรียงลำดับ
    if (sortBy === 'subCountDesc') {
      list.sort((a, b) => b.subCount - a.subCount || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'subCountAsc') {
      list.sort((a, b) => a.subCount - b.subCount || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'leaveTotalDesc') {
      list.sort((a, b) => b.leaveCounts.total - a.leaveCounts.total || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'leaveTotalAsc') {
      list.sort((a, b) => a.leaveCounts.total - b.leaveCounts.total || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'officialDutyDesc') {
      list.sort((a, b) => b.leaveCounts.officialDuty - a.leaveCounts.officialDuty || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'personalDesc') {
      list.sort((a, b) => b.leaveCounts.personal - a.leaveCounts.personal || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'sickDesc') {
      list.sort((a, b) => b.leaveCounts.sick - a.leaveCounts.sick || a.originalIndex - b.originalIndex);
    } else if (sortBy === 'nameAsc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
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

            <!-- Controls: ค้นหา & เรียงลำดับ -->
            <div class="flex flex-col sm:flex-row items-center gap-3">
              <div class="relative w-full sm:w-72">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                <input type="text" id="teacher-search-input" value="${searchQuery}" 
                  placeholder="ค้นหาชื่อคุณครู..." 
                  class="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs">
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">เรียง:</span>
                <select id="teacher-sort-select" 
                  class="w-full sm:w-auto bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer">
                  <option value="subCountDesc" ${sortBy === 'subCountDesc' ? 'selected' : ''}>สอนแทนมากที่สุด ➔ น้อยที่สุด</option>
                  <option value="subCountAsc" ${sortBy === 'subCountAsc' ? 'selected' : ''}>สอนแทนน้อยที่สุด ➔ มากที่สุด</option>
                  <option value="leaveTotalDesc" ${sortBy === 'leaveTotalDesc' ? 'selected' : ''}>การลามากที่สุด ➔ น้อยที่สุด (รวม)</option>
                  <option value="leaveTotalAsc" ${sortBy === 'leaveTotalAsc' ? 'selected' : ''}>การลาน้อยที่สุด ➔ มากที่สุด</option>
                  <option value="officialDutyDesc" ${sortBy === 'officialDutyDesc' ? 'selected' : ''}>🏛️ ไปราชการมากที่สุด</option>
                  <option value="personalDesc" ${sortBy === 'personalDesc' ? 'selected' : ''}>📝 ลากิจมากที่สุด</option>
                  <option value="sickDesc" ${sortBy === 'sickDesc' ? 'selected' : ''}>🏥 ลาป่วยมากที่สุด</option>
                  <option value="nameAsc" ${sortBy === 'nameAsc' ? 'selected' : ''}>ตามตัวอักษร ก-ฮ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Table Card (Glass Card) -->
        <div class="glass-card rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
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

                  return `
                    <tr class="hover:bg-indigo-50/20 transition-colors">
                      <td class="py-3.5 px-3 text-center text-xs font-semibold text-slate-400">
                        ${teacher.originalIndex}
                      </td>
                      <td class="py-3.5 px-5">
                        <div class="font-bold text-slate-800">${teacher.name}</div>
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
      searchQuery = e.target.value;
      renderTeacherStatsUI();
    });

    const sortSelect = document.getElementById('teacher-sort-select');
    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      renderTeacherStatsUI();
    });

    container.querySelectorAll('.btn-view-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const teacherName = e.currentTarget.dataset.teacher;
        const stats = teacherStatsMap[teacherName] || createEmptyTeacherStat(teacherName);
        currentModalTeacher = teacherName;
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
            btn.addEventListener('click', async (e) => {
              const id = e.currentTarget.dataset.id;
              if (confirm("ต้องการลบประวัติการสอนแทนรายการนี้ใช่หรือไม่?")) {
                cachedSubstitutions = await deleteSubstitution(id);
                renderTeacherStatsUI();
                const updatedStatsMap = calculateTeacherStats();
                openTeacherHistoryModal(teacherName, updatedStatsMap[teacherName] || createEmptyTeacherStat(teacherName));
              }
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
                              ผู้สอนแทน: <span class="text-indigo-600 font-semibold">${p.substituteTeacher}</span>
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
            btn.addEventListener('click', async (e) => {
              const rawIds = e.currentTarget.dataset.recordIds;
              const ids = rawIds ? rawIds.split(',').filter(Boolean) : [];
              if (confirm("ต้องการลบประวัติการลารายการนี้ใช่หรือไม่?")) {
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
