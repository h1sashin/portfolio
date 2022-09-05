import React from 'react'
import { TextareaProps } from './types'

export const Textarea: React.FC<TextareaProps> = ({ label, error, ...props }) => {
    return (
        <div className="relative bg-secondary flex mb-4 items-end pt-2">
            <textarea
                id={props.name}
                className={`resize-none text-white transition-colors peer px-4 bg-transparent text-xl pt-4 w-full outline-none border-b ${
                    !!error ? 'border-b-error' : 'focus:border-b-primary border-b-transparent'
                }`}
                placeholder=" "
                {...props}
            />
            <label
                htmlFor={props.name}
                className={`absolute top-1 left-4 ${
                    !!error ? 'text-error' : 'text-white peer-focus:text-primary'
                } text-sm transform transition-colors`}
            >
                {label}
            </label>
            {!!error && <span className="absolute top-full left-4 text-error text-xs">{error}</span>}
        </div>
    )
}
