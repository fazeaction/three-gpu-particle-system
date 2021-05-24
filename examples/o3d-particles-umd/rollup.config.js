import serve from 'rollup-plugin-serve';
export default {
    input: 'js/main.js',
    output: {
        file: 'build/bundle.js',
        format: 'umd'
    },
    plugins: [
        serve({
            open: true,
            contentBase:'',
            host: 'localhost',
            port: 8080
        })
    ]
};