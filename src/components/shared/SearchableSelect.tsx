import ReactSelect, {
    type StylesConfig,
    type GroupBase,
    type DropdownIndicatorProps,
    type ClearIndicatorProps,
    components,
} from 'react-select';

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

// react-select tidak baca class Tailwind langsung (dia pakai inline style/emotion),
// jadi kita override lewat prop `styles` biar tampilannya konsisten sama
// TextInput/Select yang sudah ada (border, radius, warna focus, state error).
function buildStyles(error: boolean): StylesConfig<Option, false, GroupBase<Option>> {
    return {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderRadius: '0.5rem', // rounded-lg
            borderColor: error
                ? '#fca5a5' // border-red-300
                : state.isFocused
                ? '#08090a'
                : '#000000',
            boxShadow: state.isFocused
                ? error
                    ? '0 0 0 3px rgba(12, 10, 10, 0.06)'
                    : '0 0 0 3px rgba(6, 6, 7, 0.2)'
                : 'none',
            '&:hover': {
                borderColor: error ? '#fca5a5' : '#000000',
            },
            fontSize: '0.875rem', // text-sm
        }),
        placeholder: (base) => ({
            ...base,
            color: '#9ca3af', // text-gray-400
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '0.5rem',
            overflow: 'hidden',
            boxShadow:
                '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
            zIndex: 20,
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '0.875rem',
            backgroundColor: state.isSelected
                ? '#eff6ff'
                : state.isFocused
                ? '#eff6ff'
                : 'white',
            color: state.isSelected ? '#1d4ed8' : '#111827',
            fontWeight: state.isSelected ? 500 : 400,
            cursor: 'pointer',
        }),
        singleValue: (base) => ({
            ...base,
            color: '#111827',
        }),
        input: (base) => ({
            ...base,
            fontSize: '0.875rem',
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base) => ({
            ...base,
            color: '#6b7280', // text-gray-500
            padding: '0 8px',
            '&:hover': {
                color: '#374151', // text-gray-700
            },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: '#6b7280', // text-gray-500
            padding: '0 4px',
            '&:hover': {
                color: '#374151', // text-gray-700
            },
        }),
    };
}

// custom panah dropdown: rotate 180deg pas menu kebuka, balik lagi pas ditutup.
// `state.selectProps.menuIsOpen` otomatis ke-update oleh react-select tiap
// dropdown dibuka/ditutup, jadi transform-nya ngikutin itu.
function DropdownIndicator(props: DropdownIndicatorProps<Option, false>) {
    const { selectProps } = props;
    return (
        <components.DropdownIndicator {...props}>
            <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                style={{
                    transform: selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                }}
            >
                <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </components.DropdownIndicator>
    );
}

// custom tombol clear (x): pakai stroke tipis (1.5) biar konsisten sama
// chevron di DropdownIndicator, bukan icon "x" tebal bawaan react-select.
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
            components={{ DropdownIndicator, ClearIndicator }}
            noOptionsMessage={() => 'Tidak ada hasil.'}
            isLoading={false}
        />
    );
}