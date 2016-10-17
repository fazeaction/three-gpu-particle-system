import babel from 'rollup-plugin-babel';
import  commonjs from 'rollup-plugin-commonjs';
import  nodeResolve from 'rollup-plugin-node-resolve';

export default {
    entry: './js/main.js',
    dest: './build/bundle.js',
    plugins: [
        babel({ exclude: ['./../../build/three-gpu-particle-system.js']}),
        nodeResolve({
            jsnext: true,
            main: true,
            preferBuiltins: true
        }),
        commonjs({
            namedExports: {
                './../../build/three-gpu-particle-system.js': ['THREE_GPU_ParticleSystem']
            }
        })
    ]
};