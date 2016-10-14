import * as fs from 'fs';
import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';

export default {
    entry: 'src/main.js',
    dest: 'build/three-gpu-particle-system.js',
    moduleName: 'THREE-GPU-ParticleSystem',
    format: 'umd',
    plugins: [ babel(babelrc()) ]
};