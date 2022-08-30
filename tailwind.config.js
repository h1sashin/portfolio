/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/pages/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/layouts/**/*.{ts,tsx}'],
    theme: {
        colors: {
            white: '#fffffa',
            black: '#061526',
            transparent: 'transparent',
            primary: '#ff4d5a',
            secondary: '#353e48',
            disabled: '#798591'
        }
    },
    plugins: []
}
