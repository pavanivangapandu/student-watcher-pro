CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom text NOT NULL,
  subject text NOT NULL DEFAULT '',
  faculty_id uuid NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sessions" ON public.class_sessions FOR SELECT TO authenticated
  USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff create sessions" ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK (faculty_id = auth.uid() AND (public.has_role(auth.uid(),'faculty') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "staff update own sessions" ON public.class_sessions FOR UPDATE TO authenticated
  USING (faculty_id = auth.uid()) WITH CHECK (faculty_id = auth.uid());

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  scanned_by uuid NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
GRANT SELECT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "staff reads session attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.class_sessions s WHERE s.id = session_id AND s.faculty_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_scan(_session_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.class_sessions; stu public.profiles; n int;
BEGIN
  SELECT * INTO s FROM public.class_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RETURN jsonb_build_object('status','error','message','Session not found'); END IF;
  IF s.faculty_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('status','error','message','Not your session'); END IF;
  IF NOT s.is_open THEN RETURN jsonb_build_object('status','error','message','Session is closed'); END IF;
  _code := trim(regexp_replace(coalesce(_code,''), '^PFPB:', ''));
  SELECT p.* INTO stu FROM public.profiles p
    WHERE (p.id::text = _code OR (p.roll_number IS NOT NULL AND lower(p.roll_number) = lower(_code)))
      AND public.has_role(p.id,'student') LIMIT 1;
  IF stu.id IS NULL THEN RETURN jsonb_build_object('status','error','message','Unknown student ID'); END IF;
  INSERT INTO public.attendance(session_id, student_id, scanned_by) VALUES (_session_id, stu.id, auth.uid())
    ON CONFLICT (session_id, student_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('status', CASE WHEN n = 1 THEN 'recorded' ELSE 'duplicate' END,
    'name', stu.full_name, 'roll_number', stu.roll_number);
END $$;
REVOKE EXECUTE ON FUNCTION public.record_scan(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_scan(uuid, text) TO authenticated;