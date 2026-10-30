/**
 * firebaseClient.js - จัดการการเชื่อมต่อฐานข้อมูล Google Cloud Firestore (Firebase) และ LocalStorage Fallback
 */

(function(global) {
  const { DEFAULT_SCHOOL_SETTINGS, DEFAULT_PERIODS, TEACHER_NAMES, DEFAULT_TEACHER_GRADES, INITIAL_TIMETABLES } = global.TeachData;

  // ฝังการตั้งค่า Firebase ของคุณโดยตรง
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAoT8TQNKazEsZfSuIdQjsSoG5Y8ZhbJ88",
    authDomain: "arrange-c24b2.firebaseapp.com",
    projectId: "arrange-c24b2",
    storageBucket: "arrange-c24b2.firebasestorage.app",
    messagingSenderId: "682784660540",
    appId: "1:682784660540:web:84523a9e97e97ca4527739",
    measurementId: "G-X0PPX6D8MS"
  };

  const STORAGE_KEYS = {
    FIREBASE_CONFIG: 'teach_firebase_config',
    SETTINGS: 'teach_school_settings',
    PERIODS: 'teach_periods',
    TEACHERS: 'teach_teachers',
    TEACHER_GRADES: 'teach_teacher_grades',
    TIMETABLES: 'teach_timetables',
    SUBSTITUTIONS: 'teach_substitutions'
  };

  let firebaseApp = null;
  let firestoreDb = null;

  function getFirebaseConfig() {
    const raw = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return DEFAULT_FIREBASE_CONFIG;
  }

  function parseConfigInput(inputText) {
    if (!inputText || !inputText.trim()) return null;
    const text = inputText.trim();

    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        return JSON.parse(text);
      } catch (e) {}
    }

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const fn = new Function(`return ${match[0]};`);
        const result = fn();
        if (result && typeof result === 'object' && result.projectId) {
          return result;
        }
      }
    } catch (e) {
      console.warn("Parse config error:", e);
    }

    return null;
  }

  function saveFirebaseConfig(config) {
    if (!config) {
      localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
      firebaseApp = null;
      firestoreDb = null;
      return;
    }

    localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    initFirebaseClient();
  }

  function initFirebaseClient() {
    const config = getFirebaseConfig();
    if (!config || !window.firebase) {
      firestoreDb = null;
      return null;
    }

    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.app();
      }
      firestoreDb = firebase.firestore();

      // ตรวจสอบและ auto-seed ข้อมูลเริ่มต้นหากใน Firebase ยังว่างอยู่
      autoSeedIfEmpty();

      return firestoreDb;
    } catch (e) {
      console.warn("Firebase init error:", e);
      firestoreDb = null;
      return null;
    }
  }

  let isAutoSeeding = false;
  async function autoSeedIfEmpty() {
    if (!firestoreDb || isAutoSeeding) return;
    try {
      const checkDoc = await firestoreDb.collection('teachers').doc('list').get();
      if (!checkDoc.exists) {
        isAutoSeeding = true;
        console.log("Firebase ยังไม่มีข้อมูลเริ่มต้น กำลังอัปโหลดให้อัตโนมัติ...");
        await seedAllDataToFirebase();
        console.log("Auto-seed สำเร็จเรียบร้อย!");
      }
    } catch (e) {
      console.warn("Auto seed check failed (อาจติด Rules หรือ offline):", e);
    } finally {
      isAutoSeeding = false;
    }
  }

  async function testFirebaseConnection(config) {
    if (!window.firebase) {
      throw new Error("Firebase SDK library ยังไม่ได้โหลดในเบราว์เซอร์");
    }

    const testAppName = 'test_app_' + Date.now();
    const tempApp = firebase.initializeApp(config, testAppName);
    const testDb = tempApp.firestore();

    try {
      await testDb.collection('settings').doc('school').get();
      await tempApp.delete();
      return true;
    } catch (err) {
      await tempApp.delete();
      throw err;
    }
  }

  // -------------------------------------------------------------
  // School Settings
  // -------------------------------------------------------------
  async function getSchoolSettings() {
    if (firestoreDb) {
      try {
        const doc = await firestoreDb.collection('settings').doc('school').get();
        if (doc.exists) {
          const data = doc.data() || {};
          delete data.rawLogoUrl;
          return { ...DEFAULT_SCHOOL_SETTINGS, ...data };
        }
      } catch (e) {
        console.warn("Firestore fetch settings error, fallback to local:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.rawLogoUrl) {
          delete parsed.rawLogoUrl;
          try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
          } catch (e) {}
        }
        return { ...DEFAULT_SCHOOL_SETTINGS, ...parsed };
      } catch (e) {}
    }
    return { ...DEFAULT_SCHOOL_SETTINGS };
  }

  async function saveSchoolSettings(settings) {
    const cleanSettings = { ...settings };
    // ป้องกัน Quota เกิน: ไม่บันทึกไฟล์ภาพดิบขนาดใหญ่ (rawLogoUrl) ลงฐานข้อมูล
    delete cleanSettings.rawLogoUrl;

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cleanSettings));
    } catch (err) {
      console.warn("LocalStorage save settings quota exceeded, trying fallback:", err);
      try {
        // หากพื้นที่ LocalStorage เต็ม ให้ลบฟิลด์ขนาดใหญ่แล้วลองบันทึกเฉพาะการตั้งค่าข้อความ
        const minimalSettings = { ...cleanSettings, logoUrl: "" };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(minimalSettings));
      } catch (e2) {
        console.warn("LocalStorage fallback write failed:", e2);
      }
    }

    if (firestoreDb) {
      try {
        await firestoreDb.collection('settings').doc('school').set({
          ...cleanSettings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore save settings error:", e);
      }
    }
  }

  // -------------------------------------------------------------
  // Periods
  // -------------------------------------------------------------
  async function getPeriods() {
    if (firestoreDb) {
      try {
        const doc = await firestoreDb.collection('settings').doc('periods').get();
        if (doc.exists && doc.data().periods) {
          return doc.data().periods;
        }
      } catch (e) {
        console.warn("Firestore fetch periods error:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.PERIODS);
    if (local) {
      try { return JSON.parse(local); } catch(e){}
    }
    return [...DEFAULT_PERIODS];
  }

  async function savePeriods(periods) {
    localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(periods));

    if (firestoreDb) {
      try {
        await firestoreDb.collection('settings').doc('periods').set({
          periods,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("Firestore save periods error:", e);
      }
    }
  }

  // -------------------------------------------------------------
  // Teachers
  // -------------------------------------------------------------
  async function getTeachers() {
    if (firestoreDb) {
      try {
        const doc = await firestoreDb.collection('teachers').doc('list').get();
        if (doc.exists && doc.data().names && doc.data().names.length > 0) {
          return doc.data().names;
        }
      } catch (e) {
        console.warn("Firestore teachers fetch error:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    if (local) {
      try { return JSON.parse(local); } catch(e){}
    }
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(TEACHER_NAMES));
    return [...TEACHER_NAMES];
  }

  async function saveTeachers(teachersList) {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachersList));

    if (firestoreDb) {
      try {
        await firestoreDb.collection('teachers').doc('list').set({
          names: teachersList,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore save teachers error:", e);
        throw new Error("บันทึกรายชื่อครูลง Firebase ไม่สำเร็จ: " + e.message);
      }
    }
  }

  async function getTeacherGrades() {
    if (firestoreDb) {
      try {
        const doc = await firestoreDb.collection('teachers').doc('list').get();
        if (doc.exists && doc.data().grades) {
          return { ...(DEFAULT_TEACHER_GRADES || {}), ...doc.data().grades };
        }
      } catch (e) {
        console.warn("Firestore fetch teacher grades error:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.TEACHER_GRADES);
    if (local) {
      try { return { ...(DEFAULT_TEACHER_GRADES || {}), ...JSON.parse(local) }; } catch(e){}
    }
    const def = DEFAULT_TEACHER_GRADES || {};
    localStorage.setItem(STORAGE_KEYS.TEACHER_GRADES, JSON.stringify(def));
    return { ...def };
  }

  async function saveTeacherGrades(gradesMap) {
    localStorage.setItem(STORAGE_KEYS.TEACHER_GRADES, JSON.stringify(gradesMap));

    if (firestoreDb) {
      try {
        await firestoreDb.collection('teachers').doc('list').set({
          grades: gradesMap,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore save teacher grades error:", e);
        throw new Error("บันทึกช่วงชั้นคุณครูลง Firebase ไม่สำเร็จ: " + e.message);
      }
    }
  }

  // -------------------------------------------------------------
  // Timetables
  // -------------------------------------------------------------
  async function getAllTimetables() {
    if (firestoreDb) {
      try {
        const snapshot = await firestoreDb.collection('timetables').get();
        if (!snapshot.empty) {
          const result = {};
          snapshot.forEach(doc => {
            const data = doc.data();
            let grid = null;
            if (data.gridJson) {
              try { grid = JSON.parse(data.gridJson); } catch (e) {}
            }
            if (!grid && data.rows && Array.isArray(data.rows)) {
              grid = data.rows.map(r => [
                r.p1 || "", r.p2 || "", r.p3 || "", r.p4 || "", r.p5 || "", r.p6 || "", r.p7 || ""
              ]);
            }
            if (grid) {
              result[doc.id] = grid;
            }
          });
          const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          const complete = days.every(d => result[d] && result[d].length > 0);
          if (complete) return result;
        }
      } catch (e) {
        console.warn("Firestore timetables fetch error:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.TIMETABLES);
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }

    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(INITIAL_TIMETABLES));
    return JSON.parse(JSON.stringify(INITIAL_TIMETABLES));
  }

  async function saveDayTimetable(day, dayGrid, teacherList) {
    const all = await getAllTimetables();
    all[day] = dayGrid;
    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(all));

    if (firestoreDb) {
      try {
        // แปลงตาราง 2D ให้เป็น array of objects เพื่อรองรับข้อจำกัดของ Firestore (ไม่รองรับ Nested Array)
        const rows = dayGrid.map((p, idx) => ({
          teacher: (teacherList && teacherList[idx]) || '',
          p1: p[0] || "",
          p2: p[1] || "",
          p3: p[2] || "",
          p4: p[3] || "",
          p5: p[4] || "",
          p6: p[5] || "",
          p7: p[6] || ""
        }));

        await firestoreDb.collection('timetables').doc(day).set({
          rows: rows,
          gridJson: JSON.stringify(dayGrid),
          teachers: teacherList || [],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("Firestore save day timetable error:", e);
        throw new Error("บันทึกลง Firebase ไม่สำเร็จ: " + e.message);
      }
    }
  }

  async function saveAllTimetables(timetablesMap, teacherList) {
    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(timetablesMap));

    if (firestoreDb) {
      try {
        const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
        for (const day of days) {
          const dayGrid = timetablesMap[day] || [];
          const rows = dayGrid.map((p, idx) => ({
            teacher: (teacherList && teacherList[idx]) || '',
            p1: p[0] || "",
            p2: p[1] || "",
            p3: p[2] || "",
            p4: p[3] || "",
            p5: p[4] || "",
            p6: p[5] || "",
            p7: p[6] || ""
          }));

          await firestoreDb.collection('timetables').doc(day).set({
            rows: rows,
            gridJson: JSON.stringify(dayGrid),
            teachers: teacherList || [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (e) {
        console.warn("Firestore save all timetables error:", e);
        throw new Error("บันทึกตารางสอนลง Firebase ไม่สำเร็จ: " + e.message);
      }
    }
    return true;
  }

  // -------------------------------------------------------------
  // Substitutions
  // -------------------------------------------------------------
  function buildSubstitutionDocId(date, absentTeacher, periodId) {
    const safeTeacher = String(absentTeacher || '').trim().replace(/[\/\s#?\[\]]/g, '_');
    const safePeriod = periodId !== undefined && periodId !== null ? periodId : 0;
    return `sub_${date}_${safeTeacher}_${safePeriod}`;
  }

  function deduplicateSubstitutions(list) {
    if (!list || list.length === 0) return { cleanList: [], zombieIds: [] };

    // จัดกลุ่มตาม (date + absentTeacher)
    const grouped = {};
    list.forEach(item => {
      const groupKey = `${item.date || ''}__${String(item.absentTeacher || '').trim()}`;
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(item);
    });

    const cleanList = [];
    const zombieIds = [];

    Object.values(grouped).forEach(groupItems => {
      // ตรวจสอบว่าในกลุ่มนี้มีคาบสอนแทนจริง (periodId > 0) หรือไม่
      const hasActualPeriods = groupItems.some(it => Number(it.periodId) > 0);

      // จัดกลุ่มย่อยตาม periodId
      const periodMap = {};
      groupItems.forEach(item => {
        const pid = Number(item.periodId) || 0;
        // ถ้ามีคาบสอนแทนจริงแล้ว แต่เรคคอร์ดนี้เป็น periodId 0 (เรคคอร์ดว่างเดิม) ให้ถือเป็น zombie
        if (hasActualPeriods && pid === 0) {
          if (item.id) zombieIds.push(item.id);
          return;
        }

        if (!periodMap[pid]) {
          periodMap[pid] = item;
        } else {
          // ถ้ามี periodId ซ้ำกัน ให้เลือกรายการที่ใหม่กว่า (เปรียบเทียบ createdAt)
          const existing = periodMap[pid];
          const existingTime = new Date(existing.createdAt || 0).getTime();
          const itemTime = new Date(item.createdAt || 0).getTime();
          if (itemTime >= existingTime) {
            if (existing.id) zombieIds.push(existing.id);
            periodMap[pid] = item;
          } else {
            if (item.id) zombieIds.push(item.id);
          }
        }
      });

      Object.values(periodMap).forEach(item => cleanList.push(item));
    });

    // เรียงลำดับรายการตามเวลาจริงจากใหม่ไปเก่าอย่างแม่นยำ
    cleanList.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    });

    return { cleanList, zombieIds };
  }

  async function getSubstitutions() {
    let rawList = [];
    let fetchedFromCloud = false;

    if (firestoreDb) {
      try {
        const snapshot = await firestoreDb.collection('substitutions')
          .orderBy('createdAt', 'desc')
          .limit(1000)
          .get();

        fetchedFromCloud = true;

        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            const data = doc.data();
            rawList.push({
              id: doc.id,
              date: data.date,
              dayOfWeek: data.dayOfWeek,
              absentTeacher: data.absentTeacher,
              leaveType: data.leaveType,
              periodId: data.periodId,
              periodTime: data.periodTime,
              subject: data.subject,
              room: data.room,
              substituteTeacher: data.substituteTeacher,
              notes: data.notes || '',
              createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString()
            });
          });
        }
      } catch (e) {
        console.warn("Firestore fetch substitutions error:", e);
      }
    }

    if (!fetchedFromCloud) {
      const local = localStorage.getItem(STORAGE_KEYS.SUBSTITUTIONS);
      rawList = local ? JSON.parse(local) : [];
    }

    // กรองและลบข้อมูลที่ซ้ำซ้อนออก
    const { cleanList, zombieIds } = deduplicateSubstitutions(rawList);

    // ซิงค์บันทึก cleanList ลง LocalStorage อย่างปลอดภัย
    try {
      localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(cleanList));
    } catch (storageErr) {
      console.warn("LocalStorage save substitutions quota note:", storageErr);
    }

    // หากพบเรคคอร์ดที่ซ้ำซ้อนใน Firestore ให้สั่งลบแบบเงียบๆ ใน Background เพื่อคลีนฐานข้อมูล
    if (firestoreDb && zombieIds.length > 0) {
      (async () => {
        try {
          const batch = firestoreDb.batch();
          zombieIds.slice(0, 450).forEach(zid => {
            batch.delete(firestoreDb.collection('substitutions').doc(zid));
          });
          await batch.commit();
          console.log(`[Auto-Clean] กำจัดข้อมูลซ้ำซ้อนที่ตกค้างใน Firestore สำเร็จ ${zombieIds.length} รายการ`);
        } catch (err) {
          console.warn("[Auto-Clean] ลบข้อมูลซ้ำซ้อนตกค้างไม่สำเร็จ:", err);
        }
      })();
    }

    return cleanList;
  }

  async function recordSubstitutions(records) {
    if (!records || records.length === 0) return await getSubstitutions();

    // 1. รวบรวมคู่ (date + absentTeacher) ทั้งหมดที่กำลังจะบันทึก
    const targetPairs = [];
    const seenPairs = new Set();
    records.forEach(r => {
      const pairKey = `${r.date}__${String(r.absentTeacher || '').trim()}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        targetPairs.push({ date: r.date, absentTeacher: String(r.absentTeacher || '').trim() });
      }
    });

    // 2. กำหนด doc ID ตามรูปแบบตายตัว (Deterministic ID) ป้องกันการสุ่ม ID ใหม่จนเกิดข้อมูลเบิ้ล
    const newRecordsWithId = records.map(rec => {
      const safePeriodId = rec.periodId !== undefined ? Number(rec.periodId) : 0;
      const deterministicId = buildSubstitutionDocId(rec.date, rec.absentTeacher, safePeriodId);
      return {
        id: deterministicId,
        date: rec.date,
        dayOfWeek: rec.dayOfWeek || '',
        absentTeacher: rec.absentTeacher,
        leaveType: rec.leaveType || 'ไปราชการ',
        periodId: safePeriodId,
        periodTime: rec.periodTime || '',
        subject: rec.subject || '',
        room: rec.room || '',
        substituteTeacher: rec.substituteTeacher || '',
        notes: rec.notes || '',
        createdAt: new Date().toISOString()
      };
    });

    // 3. จัดการใน Firestore: ก่อนบันทึก ให้ค้นหาและลบเอกสารเดิมทั้งหมดของ (date + absentTeacher) เพื่อไม่ให้เอกสารเก่าตกค้าง
    if (firestoreDb) {
      try {
        const batch = firestoreDb.batch();

        for (const pair of targetPairs) {
          const snapshot = await firestoreDb.collection('substitutions')
            .where('date', '==', pair.date)
            .where('absentTeacher', '==', pair.absentTeacher)
            .get();

          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        }

        newRecordsWithId.forEach(r => {
          const docRef = firestoreDb.collection('substitutions').doc(r.id);
          const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
            ? firebase.firestore.FieldValue.serverTimestamp()
            : new Date();
          batch.set(docRef, {
            ...r,
            createdAt: serverTs,
            updatedAt: serverTs
          });
        });

        await batch.commit();
      } catch (e) {
        console.warn("Firestore record substitutions error:", e);
      }
    }

    // 4. จัดการใน LocalStorage: ลบข้อมูลเดิมของ (date + absentTeacher) ออก แล้วแทนที่ด้วยชุดใหม่
    const current = await getSubstitutions();
    const oldFiltered = current.filter(r => !seenPairs.has(`${r.date}__${String(r.absentTeacher || '').trim()}`));
    const updated = [...newRecordsWithId, ...oldFiltered];
    const { cleanList } = deduplicateSubstitutions(updated);
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(cleanList));

    return cleanList;
  }

  async function deleteSubstitution(id) {
    const current = await getSubstitutions();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(updated));

    if (firestoreDb) {
      try {
        await firestoreDb.collection('substitutions').doc(id).delete();
      } catch (e) {
        console.warn("Firestore delete substitution error:", e);
      }
    }
    return updated;
  }

  async function deleteSubstitutionsBatch(ids) {
    if (!ids || ids.length === 0) return await getSubstitutions();
    const idSet = new Set(ids);
    const current = await getSubstitutions();
    const updated = current.filter(r => !idSet.has(r.id));
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(updated));

    if (firestoreDb) {
      try {
        const batch = firestoreDb.batch();
        ids.forEach(id => {
          batch.delete(firestoreDb.collection('substitutions').doc(id));
        });
        await batch.commit();
      } catch (e) {
        console.warn("Firestore batch delete substitutions error:", e);
      }
    }
    return updated;
  }

  async function deleteSubstitutionsForTeacher(date, absentTeacher) {
    const cleanTeacher = String(absentTeacher || '').trim();

    if (firestoreDb) {
      try {
        const snapshot = await firestoreDb.collection('substitutions')
          .where('date', '==', date)
          .where('absentTeacher', '==', cleanTeacher)
          .get();

        if (!snapshot.empty) {
          const batch = firestoreDb.batch();
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn("Firestore delete substitutions for teacher error:", e);
      }
    }

    const current = await getSubstitutions();
    const updated = current.filter(r => !(r.date === date && String(r.absentTeacher || '').trim() === cleanTeacher));
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(updated));
    return updated;
  }

  // -------------------------------------------------------------
  // Seed All Data to Firebase
  // -------------------------------------------------------------
  async function seedAllDataToFirebase() {
    if (!firestoreDb) {
      throw new Error("กรุณาเชื่อมต่อ Firebase ให้เรียบร้อยก่อนทำการ Seed ข้อมูล");
    }

    const teachers = await getTeachers();
    const timetables = await getAllTimetables();
    const settings = await getSchoolSettings();
    const periods = await getPeriods();

    // 1. Settings
    await firestoreDb.collection('settings').doc('school').set({
      ...settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Periods
    await firestoreDb.collection('settings').doc('periods').set({
      periods,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 3. Teachers & Grades
    const teacherGrades = await getTeacherGrades();
    await firestoreDb.collection('teachers').doc('list').set({
      names: teachers,
      grades: teacherGrades,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. Timetables (5 days)
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    for (const day of days) {
      const dayGrid = timetables[day] || [];
      const rows = dayGrid.map((p, idx) => ({
        teacher: teachers[idx] || '',
        p1: p[0] || "",
        p2: p[1] || "",
        p3: p[2] || "",
        p4: p[3] || "",
        p5: p[4] || "",
        p6: p[5] || "",
        p7: p[6] || ""
      }));

      await firestoreDb.collection('timetables').doc(day).set({
        rows: rows,
        gridJson: JSON.stringify(dayGrid),
        teachers: teachers,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    return true;
  }

  const api = {
    DEFAULT_FIREBASE_CONFIG,
    getFirebaseConfig,
    parseConfigInput,
    saveFirebaseConfig,
    initFirebaseClient,
    testFirebaseConnection,
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
    getSubstitutions,
    recordSubstitutions,
    deleteSubstitution,
    deleteSubstitutionsBatch,
    deleteSubstitutionsForTeacher,
    seedAllDataToFirebase
  };

  global.TeachDatabase = api;
  global.TeachSupabase = api;
})(typeof window !== 'undefined' ? window : this);
