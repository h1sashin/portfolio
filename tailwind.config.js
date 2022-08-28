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
        },
        extend: {
            backgroundImage: {
                'gradient-radial':
                    'radial-gradient(circle at 75%, rgba(6,21,38,1) 0%, rgba(6,21,38,1) 70%, rgba(0,0,0,0) 150%)'
            }
        }
    },
    plugins: []
}
