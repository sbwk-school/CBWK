/**
 * app.js - ตัวควบคุมหลักของเว็บแอพพลิเคชันจัดสอนแทน (Firebase Edition)
 */

(function(global) {
  const db = global.TeachDatabase || global.TeachSupabase;
  const { initSubstitutePage } = global.TeachSubstitute || {};
  const { initTeacherStatsPage } = global.TeachStats || {};
  const { initAdminPage } = global.TeachAdmin || {};

  let currentTab = 'substitute';

  function updateSchoolBrandingUI(settings) {
    if (!settings) return;
    const schoolTitleEl = document.getElementById('nav-school-name');
    if (schoolTitleEl && settings.schoolName) {
      schoolTitleEl.innerText = settings.schoolName;
    }
    const logoWrapper = document.getElementById('nav-school-logo-wrapper');
    if (logoWrapper) {
      if (settings.logoUrl) {
        logoWrapper.innerHTML = `<img src="${settings.logoUrl}" alt="โลโก้โรงเรียน" class="w-full h-full object-contain p-0.5 bg-white">`;
      } else {
        logoWrapper.innerHTML = `<i data-lucide="graduation-cap" class="w-5 h-5 text-white"></i>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById('teach-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'teach-global-toast';
      document.body.appendChild(toast);
    }

    let iconHtml = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500 shrink-0"></i>';
    let borderClass = 'border-emerald-300/80 bg-white/95';
    if (type === 'error') {
      iconHtml = '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-500 shrink-0"></i>';
      borderClass = 'border-rose-300/80 bg-white/95';
    } else if (type === 'info') {
      iconHtml = '<i data-lucide="info" class="w-5 h-5 text-indigo-500 shrink-0"></i>';
      borderClass = 'border-indigo-300/80 bg-white/95';
    }

    // วาง Toast ไว้มุมขวาล่าง (bottom-6 right-6) เพื่อไม่ให้บังเมนูด้านบน และปิดกั้นการกดแท็บ
    toast.style.display = 'flex';
    toast.style.pointerEvents = 'auto';
    toast.className = `fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md ${borderClass} border text-slate-800 px-4 py-3 rounded-2xl shadow-xl shadow-slate-900/10 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 backdrop-blur-md transform transition-all duration-300 translate-y-0 opacity-100 pointer-events-auto`;
    toast.innerHTML = `
      <div class="flex items-center gap-2.5">
        ${iconHtml}
        <span class="leading-snug">${message}</span>
      </div>
      <button type="button" class="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition-colors" onclick="const t = document.getElementById('teach-global-toast'); if (t) { t.style.display='none'; t.style.pointerEvents='none'; }">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;
    if (window.lucide) window.lucide.createIcons();

    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.display = 'none';
      toast.style.pointerEvents = 'none';
      toast.classList.add('hidden');
    }, 3400);
  }

  function switchTab(tabName) {
    if (!tabName) return;
    currentTab = tabName;

    // อัปเดตรูปลักษณ์ปุ่มแท็บ
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.className = "nav-tab-btn px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-indigo-700 bg-white rounded-xl shadow-xs border border-slate-200/80 transition-all flex items-center gap-2 cursor-pointer";
      } else {
        btn.className = "nav-tab-btn px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-white/60 rounded-xl transition-all flex items-center gap-2 cursor-pointer";
      }
    });

    const viewSub = document.getElementById('view-substitute');
    const viewStats = document.getElementById('view-teacher-stats');
    const viewAdmin = document.getElementById('view-admin');

    if (viewSub) viewSub.classList.add('hidden');
    if (viewStats) viewStats.classList.add('hidden');
    if (viewAdmin) viewAdmin.classList.add('hidden');

    try {
      if (tabName === 'substitute') {
        if (viewSub) viewSub.classList.remove('hidden');
        if (typeof initSubstitutePage === 'function') {
          initSubstitutePage();
        } else if (global.TeachSubstitute && global.TeachSubstitute.initSubstitutePage) {
          global.TeachSubstitute.initSubstitutePage();
        }
      } else if (tabName === 'teacher-stats') {
        if (viewStats) viewStats.classList.remove('hidden');
        if (typeof initTeacherStatsPage === 'function') {
          initTeacherStatsPage();
        } else if (global.TeachStats && global.TeachStats.initTeacherStatsPage) {
          global.TeachStats.initTeacherStatsPage();
        }
      } else if (tabName === 'admin') {
        if (viewAdmin) viewAdmin.classList.remove('hidden');
        if (typeof initAdminPage === 'function') {
          initAdminPage();
        } else if (global.TeachAdmin && global.TeachAdmin.initAdminPage) {
          global.TeachAdmin.initAdminPage();
        }
      }
    } catch (err) {
      console.error("Tab switch execution error:", err);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.lucide) window.lucide.createIcons();
  }

  // ส่งออก TeachApp ทันที เพื่อให้เรียกใช้ได้ตั้งแต่เริ่มต้น
  global.TeachApp = {
    switchTab,
    updateSchoolBrandingUI,
    showToast
  };

  document.addEventListener('DOMContentLoaded', () => {
    // 1. ผูก Event Listener บนปุ่มแท็บทันทีแบบ Synchronous (ไม่ต้องรอโหลด Network)
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const btnEl = e.currentTarget;
        const targetTab = btnEl ? btnEl.dataset.tab : null;
        if (targetTab) switchTab(targetTab);
      });
    });

    const appTabs = document.getElementById('app-tabs');
    if (appTabs) {
      appTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-tab-btn');
        if (btn && btn.dataset.tab) {
          switchTab(btn.dataset.tab);
        }
      });
    }

    const printModal = document.getElementById('pdf-preview-modal');
    const btnCloseModal = document.getElementById('btn-close-pdf-modal');
    const btnPrintNow = document.getElementById('btn-print-now');

    if (btnCloseModal && printModal) {
      btnCloseModal.addEventListener('click', () => {
        printModal.classList.add('hidden');
        printModal.classList.remove('flex');
      });
    }

    if (btnPrintNow) {
      btnPrintNow.addEventListener('click', () => {
        window.print();
      });
    }

    // 2. เริ่มต้นฐานข้อมูล Firebase ทันทีแบบ Synchronous เพื่อให้ firestoreDb พร้อมใช้งานก่อนโหลดข้อมูลหน้าแรก
    try {
      if (db && db.initFirebaseClient) {
        db.initFirebaseClient();
      } else if (db && db.initSupabaseClient) {
        db.initSupabaseClient();
      }
    } catch (e) {
      console.warn("Synchronous DB init error:", e);
    }

    // 3. สลับไปแท็บเริ่มต้น (initSubstitutePage จะดึงข้อมูลล่าสุดจาก Firebase ได้ทันทีตั้งแต่เปิดเว็บ/F5)
    switchTab('substitute');

    // 4. อัปเดต School Branding ใน Background โดยไม่บล็อกการแสดงผล
    (async () => {
      try {
        if (db && db.getSchoolSettings) {
          const settings = await db.getSchoolSettings();
          updateSchoolBrandingUI(settings);
        }
      } catch (e) {
        console.warn("Background init school settings error:", e);
      }
    })();
  });

})(typeof window !== 'undefined' ? window : this);
