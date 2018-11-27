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

export default {
    input: 'src/main.js',
    output: {
        format: 'umd',
        name: 'THREE_GPU_ParticleSystem',
        file: 'build/three-gpu-particle-system.js',
        indent: '\t'
    },
    globals: { 'three': 'three' },
    plugins: [
        glsl()
    ]
};