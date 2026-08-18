import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn.ts'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

const Select: React.FC<SelectProps> = ({
                                           value,
                                           onValueChange,
                                           children,
                                           disabled = false,
                                           className = ''
                                       }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

    const updateMenuPosition = () => {
        const el = selectRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setMenuStyle({
            position: 'fixed',
            top: rect.bottom + 6,
            left: rect.left,
            width: Math.max(rect.width, 160),
            zIndex: 9999,
        })
    }

    useLayoutEffect(() => {
        if (!isOpen) return
        updateMenuPosition()
        const onReposition = () => updateMenuPosition()
        window.addEventListener('resize', onReposition)
        window.addEventListener('scroll', onReposition, true)
        return () => {
            window.removeEventListener('resize', onReposition)
            window.removeEventListener('scroll', onReposition, true)
        }
    }, [isOpen])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (selectRef.current?.contains(target) || contentRef.current?.contains(target)) return
            setIsOpen(false)
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (itemValue: string) => {
        onValueChange(itemValue); // Trigger the onValueChange to update the value
        setIsOpen(false); // Close dropdown after selecting an item
    };

    // Find selected text from SelectContent
    let selectedText = '';
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === SelectContent) {
            React.Children.forEach(child.props.children, (item) => {
                if (React.isValidElement(item) && item.type === SelectItem && item.props.value === value) {
                    selectedText = typeof item.props.children === 'string' ? item.props.children : '';
                }
            });
        }
    });

    return (
        <div ref={selectRef} className={cn('relative', className)}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    if (child.type === SelectTrigger) {
                        return React.cloneElement(child, {
                            onClick: () => !disabled && setIsOpen(!isOpen),
                            isOpen,
                            disabled,
                            selectedValue: value,
                            selectedText: selectedText
                        });
                    } else if (child.type === SelectContent) {
                        return isOpen ? React.cloneElement(child, {
                            onItemClick: handleItemClick,
                            selectedValue: value,
                            contentRef,
                            menuStyle,
                        }) : null;
                    }
                }
                return child;
            })}
        </div>
    );
};
const SelectTrigger: React.FC<SelectTriggerProps & { onClick?: () => void; isOpen?: boolean; disabled?: boolean; selectedValue?: string; selectedText?: string }> = ({
                                                                                                                                                  className = '',
                                                                                                                                                  onClick,
                                                                                                                                                  isOpen = false,
                                                                                                                                                  disabled = false,
                                                                                                                                                  selectedValue,
                                                                                                                                                  selectedText,
                                                                                                                                                  children
                                                                                                                                              }) => {
    // Find the SelectValue child to get placeholder and clone it with selected values
    let placeholder = '';
    let selectValueElement: React.ReactElement | null = null;
    
    // Process children to find SelectValue and clone it with selected values
    const processedChildren = React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === SelectValue) {
            placeholder = child.props.placeholder || '';
            selectValueElement = child;
            // Clone SelectValue with selected values
            return React.cloneElement(child, { selectedValue, selectedText });
        }
        return child;
    });

    // If no SelectValue found, create one
    const displayContent = selectValueElement 
        ? processedChildren
        : <SelectValue placeholder={placeholder} selectedValue={selectedValue} selectedText={selectedText}>{selectedText || selectedValue || placeholder}</SelectValue>;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:shadow-sm',
                isOpen && 'border-blue-500 ring-2 ring-blue-500 ring-offset-0 shadow-md',
                className
            )}
        >
            {displayContent}
            <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-all duration-200', isOpen && 'rotate-180 text-gray-700')} />
        </button>
    );
};

const SelectValue: React.FC<SelectValueProps & { selectedValue?: string; selectedText?: string }> = ({ placeholder, children, selectedValue, selectedText }) => {
    // Priority: children (custom display) > selectedText > selectedValue > placeholder
    // If children is provided (even if empty string), use it for custom display
    // Otherwise, use selectedText (from SelectContent) or selectedValue or placeholder
    const hasCustomChildren = children !== undefined;
    const displayValue = hasCustomChildren ? children : (selectedText || selectedValue || placeholder);
    
    return (
        <span className={cn('truncate', !displayValue && 'text-gray-500')}>
            {displayValue || placeholder}
        </span>
    );
};


const SelectContent: React.FC<SelectContentProps & {
    onItemClick?: (value: string) => void
    selectedValue?: string
    contentRef?: React.RefObject<HTMLDivElement | null>
    menuStyle?: React.CSSProperties
}> = ({
    children,
    className = '',
    onItemClick,
    selectedValue,
    contentRef,
    menuStyle,
}) => {
    const menu = (
        <div
            ref={contentRef}
            style={menuStyle}
            className={cn(
                'max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl ring-1 ring-black ring-opacity-5',
                className
            )}
        >
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && child.type === SelectItem) {
                    return React.cloneElement(child, {
                        onClick: () => onItemClick?.(child.props.value),
                        isSelected: child.props.value === selectedValue
                    });
                }
                return child;
            })}
        </div>
    )

    if (typeof document === 'undefined') return menu
    return createPortal(menu, document.body)
};
const SelectItem: React.FC<SelectItemProps & { onClick?: () => void; isSelected?: boolean }> = ({
                                                                                                    children,
                                                                                                    className = '',
                                                                                                    onClick,
                                                                                                    isSelected = false
                                                                                                }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-9 pr-3 text-sm font-medium outline-none transition-colors duration-150 hover:bg-gray-50 focus:bg-gray-50 active:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                isSelected && 'bg-blue-50 text-blue-900 hover:bg-blue-50 focus:bg-blue-50',
                className
            )}
        >
            {isSelected && (
                <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
                    <Check className="h-4 w-4 text-blue-600" />
                </span>
            )}
            <span className={cn('flex-1 text-left', isSelected && 'text-blue-900')}>
                {children}
            </span>
        </button>
    );
};

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
