import  nodeResolve from 'rollup-plugin-node-resolve';
import serve from 'rollup-plugin-serve';

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
    entry: './js/main.js',
    dest: './build/bundle.js',
    plugins: [
        nodeResolve(),
        glsl(),
        serve({
            port:8080
        })
    ]
};