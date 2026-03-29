import SectionTitle from '@/components/SectionTitle';
import { formatCurrency } from '@/lib/utils';

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
  childPrice: number;
  priceCategoryLabel: string;
  onChange: (childId: number, field: keyof ChildInfo, value: string) => void;
  onRemove?: () => void;
};

const genderOptions = ['Select gender', 'Female', 'Male'];
const gradeOptions = ['Select grade', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'];
const tshirtSizes = [
  { value: '', label: 'Select size' },
  { value: 'YS', label: 'YS – Youth Small' },
  { value: 'YM', label: 'YM – Youth Medium' },
  { value: 'YL', label: 'YL – Youth Large' },
  { value: 'YXL', label: 'YXL – Youth X-Large' },
  { value: 'AS', label: 'AS – Adult Small' },
  { value: 'AM', label: 'AM – Adult Medium' },
  { value: 'AL', label: 'AL – Adult Large' },
];

function calculateAgeFromDOB(dateString: string): string {
  const dob = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return String(Math.max(0, age));
}

export type { ChildInfo };

export default function ChildInfoCard({
  child,
  childNumber,
  childPrice,
  priceCategoryLabel,
  onChange,
  onRemove,
}: ChildInfoCardProps) {
  function handleDateOfBirthChange(value: string) {
    onChange(child.id, 'dateOfBirth', value);
    onChange(child.id, 'age', value ? calculateAgeFromDOB(value) : '');
  }

  const inputClass = 'w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title={`Child ${childNumber}`}
          description="Add the details needed for attendance, classroom planning, and child safety."
          action={
            <div className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 ring-1 ring-sky-200">
              {child.grade ? `Price: ${formatCurrency(childPrice)}` : 'Select a grade for pricing'}
            </div>
          }
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-1 flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      {child.grade && (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Pricing group: {priceCategoryLabel}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></span>
          <input
            type="text"
            value={child.firstName}
            onChange={(event) => onChange(child.id, 'firstName', event.target.value)}
            placeholder="First name"
            required
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Last Name <span className="text-red-500">*</span></span>
          <input
            type="text"
            value={child.lastName}
            onChange={(event) => onChange(child.id, 'lastName', event.target.value)}
            placeholder="Last name"
            required
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Preferred Name</span>
          <input
            type="text"
            value={child.preferredName}
            onChange={(event) => onChange(child.id, 'preferredName', event.target.value)}
            placeholder="Nickname or preferred name (optional)"
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Gender <span className="text-red-500">*</span></span>
          <select
            value={child.gender}
            onChange={(event) => onChange(child.id, 'gender', event.target.value)}
            required
            className={inputClass}
          >
            {genderOptions.map((option) => (
              <option key={option} value={option === 'Select gender' ? '' : option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Date of Birth <span className="text-red-500">*</span></span>
          <input
            type="date"
            value={child.dateOfBirth}
            onChange={(event) => handleDateOfBirthChange(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Age</span>
          <input
            type="text"
            value={child.age}
            readOnly
            placeholder="Auto-calculated from date of birth"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none cursor-default"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Grade <span className="text-red-500">*</span></span>
          <select
            value={child.grade}
            onChange={(event) => onChange(child.id, 'grade', event.target.value)}
            required
            className={inputClass}
          >
            {gradeOptions.map((option) => (
              <option key={option} value={option === 'Select grade' ? '' : option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">T-shirt Size <span className="text-red-500">*</span></span>
          <select
            value={child.tshirtSize}
            onChange={(event) => onChange(child.id, 'tshirtSize', event.target.value)}
            required
            className={inputClass}
          >
            {tshirtSizes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            placeholder="List any food or environmental allergies, or enter 'None'."
            className={inputClass}
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Medical / Special Notes</span>
          <textarea
            rows={4}
            value={child.medicalNotes}
            onChange={(event) => onChange(child.id, 'medicalNotes', event.target.value)}
            placeholder="Share any medical conditions, accessibility needs, or classroom notes (optional)."
            className={inputClass}
          />
        </label>
      </div>
    </section>
  );
}
