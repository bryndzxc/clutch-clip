export default function Tooltip({ text, children, position = 'top' }) {
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
    };

    return (
        <div className="relative group/tooltip">
            {children}
            <div
                className={[
                    'pointer-events-none absolute z-50 px-3 py-1.5',
                    'rounded-lg bg-gray-800 border border-white/10',
                    'text-xs text-gray-300 whitespace-nowrap',
                    'opacity-0 group-hover/tooltip:opacity-100',
                    'transition-opacity duration-150',
                    positionClasses[position],
                ].join(' ')}
            >
                {text}
                <div
                    className={[
                        'absolute border-4 border-transparent',
                        arrowClasses[position],
                    ].join(' ')}
                />
            </div>
        </div>
    );
}
