import SectionTitle from '@/components/SectionTitle';

type ChildInfo = {
  id: number;
  firstName: string;
  lastName: string;
  preferredName: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  grade: string;
  tshirtSize: string;
  allergyInformation: string;
  medicalNotes: string;
};

type ChildInfoCardProps = {
  child: ChildInfo;
  childNumber: number;
  onChange: (childId: number, field: keyof ChildInfo, value: string) => void;
};

const genderOptions = ['Select gender', 'Female', 'Male', 'Prefer not to say'];
const gradeOptions = ['Select grade', 'Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
const tshirtSizes = ['Select size', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL'];

export type { ChildInfo };

export default function ChildInfoCard({ child, childNumber, onChange }: ChildInfoCardProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <SectionTitle
        title={`Child Information ${childNumber}`}
        description="Add the details needed for attendance, classroom planning, and child safety."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">First Name</span>
          <input
            type="text"
            value={child.firstName}
            onChange={(event) => onChange(child.id, 'firstName', event.target.value)}
            placeholder="First name"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Last Name</span>
          <input
            type="text"
            value={child.lastName}
            onChange={(event) => onChange(child.id, 'lastName', event.target.value)}
            placeholder="Last name"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Preferred Name</span>
          <input
            type="text"
            value={child.preferredName}
            onChange={(event) => onChange(child.id, 'preferredName', event.target.value)}
            placeholder="Preferred name"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Gender</span>
          <select
            value={child.gender}
            onChange={(event) => onChange(child.id, 'gender', event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {genderOptions.map((option) => (
              <option key={option} value={option === 'Select gender' ? '' : option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Date of Birth</span>
          <input
            type="date"
            value={child.dateOfBirth}
            onChange={(event) => onChange(child.id, 'dateOfBirth', event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Age</span>
          <input
            type="number"
            min="0"
            value={child.age}
            onChange={(event) => onChange(child.id, 'age', event.target.value)}
            placeholder="Age"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Grade</span>
          <select
            value={child.grade}
            onChange={(event) => onChange(child.id, 'grade', event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {gradeOptions.map((option) => (
              <option key={option} value={option === 'Select grade' ? '' : option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">T-shirt Size</span>
          <select
            value={child.tshirtSize}
            onChange={(event) => onChange(child.id, 'tshirtSize', event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            {tshirtSizes.map((option) => (
              <option key={option} value={option === 'Select size' ? '' : option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Allergy Information</span>
          <textarea
            rows={3}
            value={child.allergyInformation}
            onChange={(event) => onChange(child.id, 'allergyInformation', event.target.value)}
            placeholder="List allergies or enter 'None'."
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Medical / Special Notes</span>
          <textarea
            rows={4}
            value={child.medicalNotes}
            onChange={(event) => onChange(child.id, 'medicalNotes', event.target.value)}
            placeholder="Share any medical, accessibility, or classroom notes."
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </label>
      </div>
    </section>
  );
}
