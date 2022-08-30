import { ButtonProps } from './types'

export const Button: React.FC<ButtonProps> = ({ children, fullWidth, ...props }) => (
    <button
        className={`${
            fullWidth ? 'w-full' : 'w-max'
        } bg-primary px-5 py-4 rounded-xl text-xl font-bold text-white leading-none`}
        {...props}
    >
        {children}
    </button>
)
