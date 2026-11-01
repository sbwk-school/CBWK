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
        const getFn = () => (global.TeachSubstitute && global.TeachSubstitute.initSubstitutePage) || (typeof initSubstitutePage === 'function' ? initSubstitutePage : null);
        const fn = getFn();
        if (fn) {
          Promise.resolve(fn()).catch(err => {
            console.error("initSubstitutePage rejection:", err);
            if (viewSub && (!viewSub.children || viewSub.children.length === 0)) {
              viewSub.innerHTML = `
                <div class="max-w-xl mx-auto p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 mt-6 shadow-sm">
                  <h3 class="font-bold text-base flex items-center gap-2 mb-2 text-rose-700">
                    <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                    <span>เกิดข้อผิดพลาดในการโหลดหน้าจัดสอนแทน</span>
                  </h3>
                  <p class="text-xs text-rose-600 mb-4">${err.message || err}</p>
                  <button onclick="location.reload(true)" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer">
                    รีเฟรชหน้าเว็บ (Ctrl+F5)
                  </button>
                </div>
              `;
              if (window.lucide) window.lucide.createIcons();
            }
          });
        } else {
          // หากยังโหลดสคริปต์ไม่เสร็จ ให้รอ 150ms แล้วลองใหม่
          setTimeout(() => {
            const retryFn = getFn();
            if (retryFn) {
              Promise.resolve(retryFn()).catch(console.error);
            } else if (viewSub && (!viewSub.children || viewSub.children.length === 0)) {
              viewSub.innerHTML = `
                <div class="max-w-xl mx-auto p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 mt-6 shadow-sm text-center">
                  <h3 class="font-bold text-base mb-2 text-amber-800">กำลังเชื่อมต่อหน้าจัดสอนแทน...</h3>
                  <p class="text-xs text-amber-700 mb-4">หากหน้าจอไม่แสดงผล กรุณากดปุ่มด้านล่างเพื่อรีโหลดแบบล้างแคช</p>
                  <button onclick="location.reload(true)" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
                    รีโหลดหน้าเว็บ (Ctrl + F5)
                  </button>
                </div>
              `;
              if (window.lucide) window.lucide.createIcons();
            }
          }, 150);
        }
      } else if (tabName === 'teacher-stats') {
        if (viewStats) viewStats.classList.remove('hidden');
        const fn = (typeof initTeacherStatsPage === 'function') 
          ? initTeacherStatsPage 
          : (global.TeachStats && global.TeachStats.initTeacherStatsPage);
        if (fn) {
          Promise.resolve(fn()).catch(err => console.error("initTeacherStatsPage rejection:", err));
        }
      } else if (tabName === 'admin') {
        if (viewAdmin) viewAdmin.classList.remove('hidden');
        const fn = (typeof initAdminPage === 'function') 
          ? initAdminPage 
          : (global.TeachAdmin && global.TeachAdmin.initAdminPage);
        if (fn) {
          Promise.resolve(fn()).catch(err => console.error("initAdminPage rejection:", err));
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
    // ผูก listener ที่แถบเมนูเพียงจุดเดียว เพื่อไม่ให้คลิกแล้วสลับหน้าซ้ำ
    const appTabs = document.getElementById('app-tabs');
    if (appTabs) {
      appTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-tab-btn');
        if (btn && appTabs.contains(btn) && btn.dataset.tab) {
          switchTab(btn.dataset.tab);
        }
      });
    }

    const printModal = document.getElementById('pdf-preview-modal');
    const btnCloseModal = document.getElementById('btn-close-pdf-modal');
    const btnPrintNow = document.getElementById('btn-print-now');
    const btnSavePdf = document.getElementById('btn-save-pdf');

    if (btnCloseModal && printModal) {
      btnCloseModal.addEventListener('click', () => {
        printModal.classList.add('hidden');
        printModal.classList.remove('flex');
      });
    }

    function openPrintDialog() {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      const previewContent = document.getElementById('pdf-preview-content');
      const printSection = document.getElementById('print-section');
      if (previewContent && printSection) {
        printSection.innerHTML = previewContent.innerHTML;
      }
      window.print();
    }

    if (btnSavePdf) {
      btnSavePdf.addEventListener('click', openPrintDialog);
    }

    if (btnPrintNow) {
      btnPrintNow.addEventListener('click', openPrintDialog);
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
