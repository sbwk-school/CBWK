-- ==========================================================
-- Supabase Schema สำหรับระบบจัดสอนแทน โรงเรียนชุมชนบ้านวังพิกุล
-- สามารถคัดลอกโค้ดนี้ไปวางในเมนู SQL Editor ของ Supabase แล้วกด RUN ได้ทันที
-- ==========================================================

-- 1. สร้างตารางการตั้งค่าโรงเรียน (school_settings)
CREATE TABLE IF NOT EXISTS public.school_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    school_name TEXT NOT NULL DEFAULT 'โรงเรียนชุมชนบ้านวังพิกุล',
    subdistrict TEXT DEFAULT 'ตำบลวังพิกุล',
    district TEXT DEFAULT 'อำเภอบึงสามพัน',
    province TEXT DEFAULT 'จังหวัดเพชรบูรณ์',
    postal_code TEXT DEFAULT '67230',
    academic_head_name TEXT DEFAULT 'นางประชารักษ์ ศรีบรรเทา',
    academic_head_position TEXT DEFAULT 'ตำแหน่งหัวหน้ากลุ่มบริหารงานวิชาการ',
    director_rank TEXT DEFAULT 'ว่าที่ร้อยตรี',
    director_name TEXT DEFAULT 'ภาคภูมิ บัวทอง',
    director_position TEXT DEFAULT 'ตำแหน่งผู้อำนวยการโรงเรียนชุมชนบ้านวังพิกุล',
    doc_subject TEXT DEFAULT 'รายงานผลการสอนแทนระดับชั้นมัธยมศึกษาปีที่ 1 – 3',
    doc_dear TEXT DEFAULT 'ผู้อำนวยการโรงเรียนชุมชนบ้านวังพิกุล',
    periods_config JSONB DEFAULT '[
      {"id": 1, "name": "คาบ 1", "time": "08.30 - 09.30", "isBreak": false},
      {"id": 2, "name": "คาบ 2", "time": "09.30 - 10.30", "isBreak": false},
      {"id": 3, "name": "คาบ 3", "time": "10.30 - 11.30", "isBreak": false},
      {"id": 4, "name": "คาบ 4 (พักกลางวัน)", "time": "11.30 - 12.30", "isBreak": true},
      {"id": 5, "name": "คาบ 5", "time": "12.30 - 13.30", "isBreak": false},
      {"id": 6, "name": "คาบ 6", "time": "13.30 - 14.30", "isBreak": false},
      {"id": 7, "name": "คาบ 7", "time": "14.30 - 15.30", "isBreak": false}
    ]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มแถวเริ่มต้น
INSERT INTO public.school_settings (id) 
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- 2. สร้างตารางรายชื่อครู (teachers)
CREATE TABLE IF NOT EXISTS public.teachers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. สร้างตารางตารางสอนรายสัปดาห์ (timetables)
CREATE TABLE IF NOT EXISTS public.timetables (
    id SERIAL PRIMARY KEY,
    teacher_name TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    p1 TEXT DEFAULT '',
    p2 TEXT DEFAULT '',
    p3 TEXT DEFAULT '',
    p4 TEXT DEFAULT '',
    p5 TEXT DEFAULT '',
    p6 TEXT DEFAULT '',
    p7 TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (teacher_name, day_of_week)
);

-- 4. สร้างตารางบันทึกการจัดสอนแทน (substitutions)
CREATE TABLE IF NOT EXISTS public.substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_date DATE NOT NULL,
    day_of_week TEXT NOT NULL,
    absent_teacher_name TEXT NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'ไปราชการ', -- 'ไปราชการ', 'ลากิจ', 'ลาป่วย'
    period_id INT NOT NULL,
    period_time TEXT,
    subject TEXT,
    room TEXT,
    substitute_teacher_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- สร้าง Index เพื่อให้ค้นหาและนับสถิติได้รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_substitutions_sub_teacher ON public.substitutions (substitute_teacher_name);
CREATE INDEX IF NOT EXISTS idx_substitutions_date ON public.substitutions (sub_date);
CREATE INDEX IF NOT EXISTS idx_timetables_teacher_day ON public.timetables (teacher_name, day_of_week);

-- 5. ตั้งค่าสิทธิ์ Row Level Security (RLS) เพื่อให้เว็บแอพใช้งานได้
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- นโยบายเปิดให้ทุกคนที่มี Anon Key สามารถอ่านและเขียนได้
DROP POLICY IF EXISTS "Public read school_settings" ON public.school_settings;
CREATE POLICY "Public read school_settings" ON public.school_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access teachers" ON public.teachers;
CREATE POLICY "Public access teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access timetables" ON public.timetables;
CREATE POLICY "Public access timetables" ON public.timetables FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access substitutions" ON public.substitutions;
CREATE POLICY "Public access substitutions" ON public.substitutions FOR ALL USING (true) WITH CHECK (true);
