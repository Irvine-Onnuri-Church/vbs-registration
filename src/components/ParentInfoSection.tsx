import SectionTitle from '@/components/SectionTitle';

type ParentInfo = {
  parentName: string;
  email: string;
  phoneNumber: string;
  emergencyContactName: string;
  emergencyContactPhoneNumber: string;
};

type ParentInfoSectionProps = {
  values: ParentInfo;
  onChange: (field: keyof ParentInfo, value: string) => void;
};

const parentFields: Array<{
  field: keyof ParentInfo;
  label: string;
  type?: string;
  placeholder: string;
}> = [
  {
    field: 'parentName',
    label: 'Parent / Guardian Name',
    placeholder: 'Enter parent or guardian name',
  },
  {
    field: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'parent@example.com',
  },
  {
    field: 'phoneNumber',
    label: 'Phone Number',
    type: 'tel',
    placeholder: '(555) 123-4567',
  },
  {
    field: 'emergencyContactName',
    label: 'Emergency Contact Name',
    placeholder: 'Enter emergency contact name',
  },
  {
    field: 'emergencyContactPhoneNumber',
    label: 'Emergency Contact Phone Number',
    type: 'tel',
    placeholder: '(555) 987-6543',
  },
];

export type { ParentInfo };

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function stripPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export default function ParentInfoSection({ values, onChange }: ParentInfoSectionProps) {
  const isPhoneField = (field: keyof ParentInfo) =>
    field === 'phoneNumber' || field === 'emergencyContactPhoneNumber';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <SectionTitle
        title="Parent / Guardian Information"
        description="Provide the main family contact details for registration and communication."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {parentFields.map((field) => (
          <label key={field.field} className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {field.label} <span className="text-red-500">*</span>
            </span>
            <input
              type={field.type ?? 'text'}
              value={isPhoneField(field.field) ? formatPhoneDisplay(values[field.field]) : values[field.field]}
              onChange={(event) => {
                if (isPhoneField(field.field)) {
                  onChange(field.field, stripPhone(event.target.value));
                } else {
                  onChange(field.field, event.target.value);
                }
              }}
              placeholder={field.placeholder}
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
