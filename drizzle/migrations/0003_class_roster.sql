ALTER TABLE public.class_sessions
  ADD COLUMN branch text NOT NULL DEFAULT '',
  ADD COLUMN year text NOT NULL DEFAULT '',
  ADD COLUMN semester text NOT NULL DEFAULT '',
  ADD COLUMN section text NOT NULL DEFAULT '';

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  branch text NOT NULL DEFAULT '',
  year text NOT NULL DEFAULT '',
  semester text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX students_roll_unique ON public.students (lower(roll_number));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'));

CREATE OR REPLACE FUNCTION public.record_scan(_session_id uuid, _code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s public.class_sessions; r public.students; stu public.profiles; n int; _sid uuid; _name text; _roll text;
BEGIN
  SELECT * INTO s FROM public.class_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RETURN jsonb_build_object('status','error','message','Session not found'); END IF;
  IF s.faculty_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('status','error','message','Not your session'); END IF;
  IF NOT s.is_open THEN RETURN jsonb_build_object('status','error','message','Session is closed'); END IF;
  _code := trim(regexp_replace(coalesce(_code,''), '^PFPB:', ''));
  SELECT * INTO r FROM public.students WHERE lower(roll_number) = lower(_code) LIMIT 1;
  IF r.id IS NOT NULL THEN
    IF (s.branch <> '' AND lower(r.branch) <> lower(s.branch)) OR (s.year <> '' AND r.year <> s.year)
       OR (s.semester <> '' AND r.semester <> s.semester) OR (s.section <> '' AND lower(r.section) <> lower(s.section)) THEN
      RETURN jsonb_build_object('status','error','message', r.roll_number || ' is not in this class (' || r.branch || ' ' || r.year || ' yr, sem ' || r.semester || ', sec ' || r.section || ')');
    END IF;
    _sid := r.id; _name := r.full_name; _roll := r.roll_number;
  ELSE
    SELECT p.* INTO stu FROM public.profiles p
      WHERE (p.id::text = _code OR (p.roll_number IS NOT NULL AND lower(p.roll_number) = lower(_code)))
        AND public.has_role(p.id,'student') LIMIT 1;
    IF stu.id IS NULL THEN RETURN jsonb_build_object('status','error','message','Unknown student ID: ' || _code); END IF;
    _sid := stu.id; _name := stu.full_name; _roll := stu.roll_number;
  END IF;
  INSERT INTO public.attendance(session_id, student_id, scanned_by) VALUES (_session_id, _sid, auth.uid())
    ON CONFLICT (session_id, student_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('status', CASE WHEN n = 1 THEN 'recorded' ELSE 'duplicate' END, 'name', _name, 'roll_number', _roll);
END $function$;