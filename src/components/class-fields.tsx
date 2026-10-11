export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AI&DS", "AIML"];
export const YEARS = ["I", "II", "III", "IV"];
export const SEMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
export const SECS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type ClassSel = { branch: string; year: string; semester: string; section: string };

function Sel({ label, value, opts, onChange, any }: { label: string; value: string; opts: string[]; onChange: (v: string) => void; any?: boolean | undefined }) {
  return (
    <div className="min-w-28">
      <label className="text-sm">{label}</label>
      <select className="block h-10 w-full rounded-md border bg-background px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{any ? "All" : "Select"}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function ClassFields({ value, onChange, any }: { value: ClassSel; onChange: (v: ClassSel) => void; any?: boolean | undefined }) {
  return (
    <>
      <Sel label="Branch" value={value.branch} opts={BRANCHES} any={any} onChange={(branch) => onChange({ ...value, branch })} />
      <Sel label="Year" value={value.year} opts={YEARS} any={any} onChange={(year) => onChange({ ...value, year })} />
      <Sel label="Sem" value={value.semester} opts={SEMS} any={any} onChange={(semester) => onChange({ ...value, semester })} />
      <Sel label="Sec" value={value.section} opts={SECS} any={any} onChange={(section) => onChange({ ...value, section })} />
    </>
  );
}

export const classLabel = (c: ClassSel) =>
  [c.branch, c.year && `${c.year} Year`, c.semester && `${c.semester} Sem`, c.section && `Sec ${c.section}`].filter(Boolean).join(" · ");
