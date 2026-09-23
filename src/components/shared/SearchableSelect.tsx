import ReactSelect, {
    type StylesConfig,
    type GroupBase,
    type DropdownIndicatorProps,
    type ClearIndicatorProps,
    type OptionProps,
    components,
} from 'react-select';
import { Check, ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    error?: boolean;
    disabled?: boolean;
    isClearable?: boolean;
}

// Warna & radius disamakan manual sama komponen `Select` (native replacement):
// border slate-300 default, slate-400 hover, slate-900 fokus, red-400 error,
// shadow-sm konstan (bukan ring saat fokus), text-sm, rounded-lg.
function buildStyles(error: boolean): StylesConfig<Option, false, GroupBase<Option>> {
    return {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderRadius: '0.5rem', // rounded-lg
            borderColor: error
                ? '#f87171' // border-red-400
                : state.isFocused
                ? '#0f172a' // border-slate-900
                : '#cbd5e1', // border-slate-300
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-sm, sama kayak Select (bukan ring)
            transition: 'border-color 150ms, box-shadow 150ms',
            '&:hover': {
                borderColor: error ? '#f87171' : state.isFocused ? '#0f172a' : '#94a3b8', // slate-400
            },
            fontSize: '0.875rem', // text-sm
            cursor: 'pointer',
        }),
        placeholder: (base) => ({
            ...base,
            color: '#94a3b8', // text-slate-400
        }),
        menu: (base) => ({
            ...base,
            marginTop: '0.375rem', // mt-1.5
            borderRadius: '0.5rem', // rounded-lg
            border: '1px solid #e2e8f0', // border-slate-200
            overflow: 'hidden',
            boxShadow:
                '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', // shadow-lg
            zIndex: 20,
        }),
        menuList: (base) => ({
            ...base,
            padding: '0.25rem', // p-1
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '0.875rem',
            borderRadius: '0.375rem', // rounded-md
            padding: '0.5rem 0.625rem', // py-2 px-2.5
            backgroundColor: state.isFocused ? '#f1f5f9' : 'white', // slate-100 on hover/active
            color: state.isSelected ? '#0f172a' : '#334155', // slate-900 : slate-700
            fontWeight: state.isSelected ? 500 : 400,
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        }),
        singleValue: (base) => ({
            ...base,
            color: '#1e293b', // text-slate-800
        }),
        input: (base) => ({
            ...base,
            fontSize: '0.875rem',
            color: '#1e293b',
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base) => ({
            ...base,
            color: '#94a3b8', // text-slate-400
            padding: '0 8px',
            '&:hover': {
                color: '#94a3b8',
            },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: '#94a3b8',
            padding: '0 4px',
            '&:hover': {
                color: '#334155', // text-slate-700
            },
        }),
    };
}

// Pakai ChevronDown dari lucide-react biar ikon sama persis kayak `Select`
// (bukan svg custom lagi), rotate 180deg pas menu kebuka.
function DropdownIndicator(props: DropdownIndicatorProps<Option, false>) {
    const { selectProps } = props;
    return (
        <components.DropdownIndicator {...props}>
            <ChevronDown
                size={15}
                className="shrink-0 transition-transform duration-200"
                style={{ transform: selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
        </components.DropdownIndicator>
    );
}

function ClearIndicator(props: ClearIndicatorProps<Option, false>) {
    return (
        <components.ClearIndicator {...props}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </components.ClearIndicator>
    );
}

// Custom Option: tambahin icon Check di kanan waktu opsi lagi ke-select,
// biar konsisten sama tampilan <li> di `Select` yang juga pakai Check.
function CustomOption(props: OptionProps<Option, false>) {
    const { data, isSelected } = props;
    return (
        <components.Option {...props}>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate">{data.label}</span>
                {isSelected && <Check size={14} className="shrink-0 text-slate-900" />}
            </div>
        </components.Option>
    );
}

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = 'Pilih...',
    error = false,
    disabled = false,
    isClearable = true,
}: SearchableSelectProps) {
    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <ReactSelect<Option, false>
            value={selected}
            onChange={(opt) => onChange(opt?.value ?? '')}
            options={options}
            placeholder={placeholder}
            isDisabled={disabled}
            isClearable={isClearable}
            styles={buildStyles(error)}
            components={{ DropdownIndicator, ClearIndicator, Option: CustomOption }}
            noOptionsMessage={() => 'Tidak ada hasil.'}
            isLoading={false}
        />
    );
}