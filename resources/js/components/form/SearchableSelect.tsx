import ReactSelect, {
    type StylesConfig,
    type GroupBase,
    type DropdownIndicatorProps,
    type ClearIndicatorProps,
    type OptionProps,
    components,
} from 'react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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
// Mode gelap memakai latar abu-abu gelap terangkat (#222226), border #383842.
function buildStyles(error: boolean, isDark: boolean): StylesConfig<Option, false, GroupBase<Option>> {
    return {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderRadius: '0.5rem', // rounded-lg
            backgroundColor: isDark ? '#222226' : '#ffffff',
            borderColor: error
                ? '#f87171' // border-red-400
                : state.isFocused
                ? isDark
                    ? '#5c5c68'
                    : '#0f172a'
                : isDark
                ? '#383842'
                : '#cbd5e1',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'border-color 150ms, box-shadow 150ms, background-color 150ms',
            '&:hover': {
                borderColor: error
                    ? '#f87171'
                    : state.isFocused
                    ? isDark
                        ? '#5c5c68'
                        : '#0f172a'
                    : isDark
                    ? '#4b4b55'
                    : '#94a3b8',
            },
            fontSize: '0.875rem', // text-sm
            cursor: 'pointer',
        }),
        placeholder: (base) => ({
            ...base,
            color: isDark ? '#71717a' : '#94a3b8',
        }),
        menu: (base) => ({
            ...base,
            marginTop: '0.375rem',
            borderRadius: '0.5rem',
            border: isDark ? '1px solid #383842' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#1e1e22' : '#ffffff',
            overflow: 'hidden',
            boxShadow: isDark
                ? '0 10px 25px -5px rgba(0,0,0,0.5)'
                : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
            zIndex: 20,
        }),
        menuList: (base) => ({
            ...base,
            padding: '0.25rem',
            backgroundColor: isDark ? '#1e1e22' : '#ffffff',
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '0.875rem',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.625rem',
            backgroundColor: state.isFocused
                ? isDark
                    ? '#2a2a30'
                    : '#f1f5f9'
                : isDark
                ? '#1e1e22'
                : '#ffffff',
            color: state.isSelected
                ? isDark
                    ? '#ffffff'
                    : '#0f172a'
                : isDark
                ? '#e4e4e7'
                : '#334155',
            fontWeight: state.isSelected ? 500 : 400,
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
            '&:active': {
                backgroundColor: isDark ? '#32323a' : '#e2e8f0',
            },
        }),
        singleValue: (base) => ({
            ...base,
            color: isDark ? '#f4f4f5' : '#1e293b',
        }),
        input: (base) => ({
            ...base,
            fontSize: '0.875rem',
            color: isDark ? '#f4f4f5' : '#1e293b',
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base) => ({
            ...base,
            color: isDark ? '#71717a' : '#94a3b8',
            padding: '0 8px',
            '&:hover': {
                color: isDark ? '#a1a1aa' : '#94a3b8',
            },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: isDark ? '#71717a' : '#94a3b8',
            padding: '0 4px',
            '&:hover': {
                color: isDark ? '#f4f4f5' : '#334155',
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
                {isSelected && <Check size={14} className="shrink-0 text-slate-900 dark:text-white" />}
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
    const { isDark } = useTheme();
    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <ReactSelect<Option, false>
            value={selected}
            onChange={(opt) => onChange(opt?.value ?? '')}
            options={options}
            placeholder={placeholder}
            isDisabled={disabled}
            isClearable={isClearable}
            styles={buildStyles(error, isDark)}
            components={{ DropdownIndicator, ClearIndicator, Option: CustomOption }}
            noOptionsMessage={() => 'Tidak ada hasil.'}
            isLoading={false}
        />
    );
}