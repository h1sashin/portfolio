/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/pages/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/layouts/**/*.{ts,tsx}'],
    theme: {
        colors: {
            white: '#fffffa',
            black: '#061526',
            transparent: 'transparent',
            primary: '#E8476A',
            secondary: '#353e48',
            disabled: '#798591',
            error: '#F76565',
            warning: '#F7C065',
            info: '#76CDD9',
            success: '#33D989'
        },
        extend: {
            gridTemplateColumns: {
                auto: 'repeat(auto-fill, minmax(8rem, 1fr))'
            }
        }
    },
    plugins: []
}
