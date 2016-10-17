import babel from 'rollup-plugin-babel';


export default {
    entry: './js/main.js',
    dest: './build/bundle.js',
    plugins: [
        babel()
    ]
};