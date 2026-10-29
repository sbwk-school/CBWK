/**
 * supabaseClient.js - จัดการการเชื่อมต่อฐานข้อมูล Supabase และ LocalStorage Fallback
 */

(function(global) {
  const { DEFAULT_SCHOOL_SETTINGS, DEFAULT_PERIODS, TEACHER_NAMES, INITIAL_TIMETABLES } = global.TeachData;

  const STORAGE_KEYS = {
    SUPABASE_URL: 'teach_supabase_url',
    SUPABASE_KEY: 'teach_supabase_key',
    SETTINGS: 'teach_school_settings',
    PERIODS: 'teach_periods',
    TEACHERS: 'teach_teachers',
    TIMETABLES: 'teach_timetables',
    SUBSTITUTIONS: 'teach_substitutions'
  };

  let supabaseClient = null;

  function getSupabaseCredentials() {
    return {
      url: localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '',
      key: localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || ''
    };
  }

  function saveSupabaseCredentials(url, key) {
    if (url) localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);

    if (key) localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);

    initSupabaseClient();
  }

  function initSupabaseClient() {
    const { url, key } = getSupabaseCredentials();
    if (url && key && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(url, key);
        return supabaseClient;
      } catch (e) {
        console.warn("Could not initialize Supabase client:", e);
        supabaseClient = null;
      }
    }
    supabaseClient = null;
    return null;
  }

  async function testSupabaseConnection(url, key) {
    if (!window.supabase) {
      throw new Error("Supabase library not loaded in browser");
    }
    const client = window.supabase.createClient(url.trim(), key.trim());
    const { data, error } = await client.from('school_settings').select('id').limit(1);
    if (error) {
      throw error;
    }
    return true;
  }

  async function getSchoolSettings() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('school_settings').select('*').eq('id', 'default').maybeSingle();
        if (!error && data) {
          return {
            schoolName: data.school_name || DEFAULT_SCHOOL_SETTINGS.schoolName,
            subdistrict: data.subdistrict || DEFAULT_SCHOOL_SETTINGS.subdistrict,
            district: data.district || DEFAULT_SCHOOL_SETTINGS.district,
            province: data.province || DEFAULT_SCHOOL_SETTINGS.province,
            postalCode: data.postal_code || DEFAULT_SCHOOL_SETTINGS.postalCode,
            docTitle: data.doc_title || DEFAULT_SCHOOL_SETTINGS.docTitle,
            docSubject: data.doc_subject || DEFAULT_SCHOOL_SETTINGS.docSubject,
            docDear: data.doc_dear || DEFAULT_SCHOOL_SETTINGS.docDear,
            academicHeadRank: data.academic_head_rank || DEFAULT_SCHOOL_SETTINGS.academicHeadRank,
            academicHeadName: data.academic_head_name || DEFAULT_SCHOOL_SETTINGS.academicHeadName,
            academicHeadPosition: data.academic_head_position || DEFAULT_SCHOOL_SETTINGS.academicHeadPosition,
            directorRank: data.director_rank || DEFAULT_SCHOOL_SETTINGS.directorRank,
            directorName: data.director_name || DEFAULT_SCHOOL_SETTINGS.directorName,
            directorPosition: data.director_position || DEFAULT_SCHOOL_SETTINGS.directorPosition
          };
        }
      } catch (e) {
        console.warn("Supabase fetch settings failed, fallback to local:", e);
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
    delete cleanSettings.rawLogoUrl;

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cleanSettings));
    } catch (err) {
      console.warn("LocalStorage save settings quota exceeded:", err);
    }

    if (supabaseClient) {
      try {
        await supabaseClient.from('school_settings').upsert({
          id: 'default',
          school_name: settings.schoolName,
          subdistrict: settings.subdistrict,
          district: settings.district,
          province: settings.province,
          postal_code: settings.postalCode,
          academic_head_rank: settings.academicHeadRank,
          academic_head_name: settings.academicHeadName,
          academic_head_position: settings.academicHeadPosition,
          director_rank: settings.directorRank,
          director_name: settings.directorName,
          director_position: settings.directorPosition,
          doc_subject: settings.docSubject,
          doc_dear: settings.docDear,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Supabase save settings error:", e);
      }
    }
  }

  async function getPeriods() {
    const local = localStorage.getItem(STORAGE_KEYS.PERIODS);
    if (local) {
      try { return JSON.parse(local); } catch(e){}
    }
    return [...DEFAULT_PERIODS];
  }

  async function savePeriods(periods) {
    localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(periods));
    if (supabaseClient) {
      try {
        await supabaseClient.from('school_settings').upsert({
          id: 'default',
          periods_config: periods,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Supabase save periods error:", e);
      }
    }
  }

  async function getTeachers() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('teachers').select('name').eq('is_active', true).order('display_order', { ascending: true });
        if (!error && data && data.length > 0) {
          return data.map(t => t.name);
        }
      } catch(e) {
        console.warn("Supabase teachers fetch failed, fallback:", e);
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
    if (supabaseClient) {
      try {
        const payload = teachersList.map((name, idx) => ({
          name,
          display_order: idx + 1,
          is_active: true
        }));
        await supabaseClient.from('teachers').upsert(payload, { onConflict: 'name' });
      } catch (e) {
        console.warn("Supabase save teachers error:", e);
      }
    }
  }

  async function getAllTimetables() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('timetables').select('*');
        if (!error && data && data.length > 0) {
          const teachers = await getTeachers();
          const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
          const formatted = {};

          days.forEach(day => {
            formatted[day] = teachers.map(teacherName => {
              const row = data.find(r => r.teacher_name === teacherName && r.day_of_week === day);
              if (row) {
                return [row.p1 || "", row.p2 || "", row.p3 || "", row.p4 || "", row.p5 || "", row.p6 || "", row.p7 || ""];
              }
              return ["", "", "", "", "", "", ""];
            });
          });
          return formatted;
        }
      } catch (e) {
        console.warn("Supabase timetable error, using local:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.TIMETABLES);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }

    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(INITIAL_TIMETABLES));
    return JSON.parse(JSON.stringify(INITIAL_TIMETABLES));
  }

  async function saveDayTimetable(day, dayGrid, teacherList) {
    const all = await getAllTimetables();
    all[day] = dayGrid;
    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(all));

    if (supabaseClient && teacherList) {
      try {
        const rows = dayGrid.map((periodArr, idx) => {
          const teacherName = teacherList[idx];
          return {
            teacher_name: teacherName,
            day_of_week: day,
            p1: periodArr[0] || "",
            p2: periodArr[1] || "",
            p3: periodArr[2] || "",
            p4: periodArr[3] || "",
            p5: periodArr[4] || "",
            p6: periodArr[5] || "",
            p7: periodArr[6] || "",
            updated_at: new Date().toISOString()
          };
        });
        await supabaseClient.from('timetables').upsert(rows, { onConflict: 'teacher_name,day_of_week' });
      } catch (e) {
        console.warn("Supabase save day timetable error:", e);
      }
    }
  }

  async function getSubstitutions() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('substitutions').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          return data.map(r => ({
            id: r.id,
            date: r.sub_date,
            dayOfWeek: r.day_of_week,
            absentTeacher: r.absent_teacher_name,
            leaveType: r.leave_type,
            periodId: r.period_id,
            periodTime: r.period_time,
            subject: r.subject,
            room: r.room,
            substituteTeacher: r.substitute_teacher_name,
            notes: r.notes,
            createdAt: r.created_at
          }));
        }
      } catch (e) {
        console.warn("Supabase fetch substitutions error:", e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.SUBSTITUTIONS);
    return local ? JSON.parse(local) : [];
  }

  async function recordSubstitutions(records) {
    const current = await getSubstitutions();
    const newRecordsWithId = records.map(rec => ({
      id: rec.id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
      date: rec.date,
      dayOfWeek: rec.dayOfWeek,
      absentTeacher: rec.absentTeacher,
      leaveType: rec.leaveType || 'ไปราชการ',
      periodId: rec.periodId,
      periodTime: rec.periodTime || '',
      subject: rec.subject || '',
      room: rec.room || '',
      substituteTeacher: rec.substituteTeacher,
      notes: rec.notes || '',
      createdAt: new Date().toISOString()
    }));

    const updated = [...newRecordsWithId, ...current];
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(updated));

    if (supabaseClient) {
      try {
        const dbRows = newRecordsWithId.map(r => ({
          id: r.id.startsWith('sub_') ? undefined : r.id,
          sub_date: r.date,
          day_of_week: r.dayOfWeek,
          absent_teacher_name: r.absentTeacher,
          leave_type: r.leaveType,
          period_id: r.periodId,
          period_time: r.periodTime,
          subject: r.subject,
          room: r.room,
          substitute_teacher_name: r.substituteTeacher,
          notes: r.notes,
          created_at: r.createdAt
        }));
        await supabaseClient.from('substitutions').insert(dbRows);
      } catch (e) {
        console.warn("Supabase insert substitutions error:", e);
      }
    }

    return updated;
  }

  async function deleteSubstitution(id) {
    const current = await getSubstitutions();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUBSTITUTIONS, JSON.stringify(updated));

    if (supabaseClient) {
      try {
        await supabaseClient.from('substitutions').delete().eq('id', id);
      } catch (e) {
        console.warn("Supabase delete substitution error:", e);
      }
    }
    return updated;
  }

  async function seedAllDataToSupabase() {
    if (!supabaseClient) {
      throw new Error("กรุณาเชื่อมต่อ Supabase ให้เรียบร้อยก่อนทำการ Seed ข้อมูล");
    }

    const teachers = await getTeachers();
    const timetables = await getAllTimetables();
    const settings = await getSchoolSettings();
    const periods = await getPeriods();

    // 1. Settings
    await supabaseClient.from('school_settings').upsert({
      id: 'default',
      school_name: settings.schoolName,
      subdistrict: settings.subdistrict,
      district: settings.district,
      province: settings.province,
      postal_code: settings.postalCode,
      academic_head_name: settings.academicHeadName,
      academic_head_position: settings.academicHeadPosition,
      director_rank: settings.directorRank,
      director_name: settings.directorName,
      director_position: settings.directorPosition,
      doc_subject: settings.docSubject,
      doc_dear: settings.docDear,
      periods_config: periods,
      updated_at: new Date().toISOString()
    });

    // 2. Teachers
    const teacherRows = teachers.map((name, idx) => ({
      name,
      display_order: idx + 1,
      is_active: true
    }));
    await supabaseClient.from('teachers').upsert(teacherRows, { onConflict: 'name' });

    // 3. Timetables
    const timetableRows = [];
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    for (const day of days) {
      const dayGrid = timetables[day] || [];
      dayGrid.forEach((periodArr, idx) => {
        const teacherName = teachers[idx];
        if (teacherName) {
          timetableRows.push({
            teacher_name: teacherName,
            day_of_week: day,
            p1: periodArr[0] || "",
            p2: periodArr[1] || "",
            p3: periodArr[2] || "",
            p4: periodArr[3] || "",
            p5: periodArr[4] || "",
            p6: periodArr[5] || "",
            p7: periodArr[6] || "",
            updated_at: new Date().toISOString()
          });
        }
      });
    }

    for (let i = 0; i < timetableRows.length; i += 50) {
      const chunk = timetableRows.slice(i, i + 50);
      const { error } = await supabaseClient.from('timetables').upsert(chunk, { onConflict: 'teacher_name,day_of_week' });
      if (error) throw error;
    }

    return true;
  }

  global.TeachSupabase = {
    getSupabaseCredentials,
    saveSupabaseCredentials,
    initSupabaseClient,
    testSupabaseConnection,
    getSchoolSettings,
    saveSchoolSettings,
    getPeriods,
    savePeriods,
    getTeachers,
    saveTeachers,
    getAllTimetables,
    saveDayTimetable,
    getSubstitutions,
    recordSubstitutions,
    deleteSubstitution,
    seedAllDataToSupabase
  };
})(typeof window !== 'undefined' ? window : this);
