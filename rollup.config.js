import babel from '@rollup/plugin-babel';
// import { terser } from 'rollup-plugin-terser';
import nodeResolve from '@rollup/plugin-node-resolve';

function glsl () {
    return {
        transform ( code, id ) {
            if ( !/\.glsl$/.test( id ) ) return;

            return 'export default ' + JSON.stringify(
                    code
                        .replace( /[ \t]*\/\/.*\n/g, '' )
                        .replace( /[ \t]*\/\*[\s\S]*?\*\//g, '' )
                        .replace( /\n{2,}/g, '\n' )
                ) + ';';
        }
    };
}

function babelCleanup() {

    const doubleSpaces = / {2}/g;

    return {

        transform( code ) {

            code = code.replace( doubleSpaces, '\t' );

            return {
                code: code,
                map: null
            };

        }

    };

}

const babelrc = {
    presets: [
        [
            '@babel/preset-env',
            {
                modules: false,
                targets: '>1%',
                loose: true,
                bugfixes: true,
            }
        ]
    ]
};

export default [
    {
        input: 'src/main.js',
        plugins: [
            nodeResolve(),
            glsl(),
            babel( {
                babelHelpers: 'bundled',
                compact: false,
                babelrc: false,
                ...babelrc
            } ),
            babelCleanup()
        ],
        external: ['three'],
        output: [
            {
                format: 'umd',
                name: 'THREE_GPU_ParticleSystem',
                file: 'build/three-gpu-particle-system.js',
                indent: '\t',
                globals:{
                    three:'THREE'
                }
            }
        ]
    },
    {
        input: 'src/main.js',
        plugins: [
            nodeResolve(),
            glsl(),
        ],
        external: ['three'],
        output: [
            {
                format: 'esm',
                file: 'build/three-gpu-particle-system.module.js'
            }
        ]
    }
];
