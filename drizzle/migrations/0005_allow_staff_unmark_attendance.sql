GRANT DELETE ON public.attendance TO authenticated;

CREATE POLICY "staff delete session attendance" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.class_sessions s WHERE s.id = attendance.session_id AND s.faculty_id = auth.uid()));