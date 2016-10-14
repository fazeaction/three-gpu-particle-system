var THREE = require('three')
import ParticleSpec from './particle-spec'
import glslify from 'glslify'
const billboardParticleVertexShader=glslify('./../shaders/particles-billboard.vs.glsl')
const orientedParticleVertexShader=glslify('./../shaders/particles-oriented.vs.glsl')
const particleFragmentShader=glslify('./../shaders/particles.fs.glsl')

class ParticleEmitter extends THREE.Mesh  {

    constructor( particleSystem, opt_texture, opt_clock) {

        super();

        opt_clock = opt_clock || particleSystem.timeSource_;

        this.tmpWorld_ = new Float32Array(16);

        // The VBO holding the particles' data, (re-)allocated in
        // allocateParticles_().
        this.particleBuffer_ = new THREE.BufferGeometry();
        this.interleavedBuffer = new THREE.InterleavedBuffer();

        // The buffer object holding the particles' indices, (re-)allocated
        // in allocateParticles_().
        this.indexBuffer_ = [];

        // The number of particles that are stored in the particle buffer.
        this.numParticles_ = 0;

        this.rampTexture_ = particleSystem.defaultRampTexture;
        this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;

        this.particleSystem = particleSystem;

        this.timeSource_ = opt_clock;

        this.translation_ = [0, 0, 0];

        this.setState(THREE.NormalBlending);
    }

    setTranslation(x, y, z) {

        this.position.x=x;
        this.position.y=y;
        this.position.z=z;

    }

    setState (stateId) {
        this.blendFunc_ = stateId;
    }

    setColorRamp (colorRamp) {
        var width = colorRamp.length / 4;
        if (width % 1 != 0) {
            throw 'colorRamp must have multiple of 4 entries';
        }

        if (this.rampTexture_ == this.particleSystem.defaultRampTexture) {
            this.rampTexture_ = null;
        }

        this.rampTexture_ = this.particleSystem.createTextureFromFloats(width, 1, colorRamp, this.rampTexture_);
    }

    validateParameters (parameters) {
        var defaults = new ParticleSpec();
        for (var key in parameters) {
            if (typeof defaults[key] === 'undefined') {
                throw 'unknown particle parameter "' + key + '"';
            }
        }
        for (var key in defaults) {
            if (typeof parameters[key] === 'undefined') {
                parameters[key] = defaults[key];
            }
        }
    }

    createParticles_( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter) {


        var CORNERS_ = ParticleSpec.CORNERS_

        var interleaveBufferData=this.interleavedBuffer.array;

        // Set the globals.
        this.billboard_ = parameters.billboard;

        var random = this.particleSystem.randomFunction_;

        var plusMinus = function(range) {
            return (random() - 0.5) * range * 2;
        };

        // TODO: change to not allocate.
        var plusMinusVector = function(range) {
            var v = [];
            for (var ii = 0; ii < range.length; ++ii) {
                v.push(plusMinus(range[ii]));
            }
            return v;
        };



        for (var ii = 0; ii < numParticles; ++ii) {
            if (opt_perParticleParamSetter) {
                opt_perParticleParamSetter(ii, parameters);
            }
            var pLifeTime = parameters.lifeTime;
            var pStartTime = (parameters.startTime === null) ?
                (ii * parameters.lifeTime / numParticles) : parameters.startTime;
            var pFrameStart =
                parameters.frameStart + plusMinus(parameters.frameStartRange);

            var pPosition = new THREE.Vector3().addVectors(
                new THREE.Vector3().fromArray(parameters.position), new THREE.Vector3().fromArray(plusMinusVector(parameters.positionRange)));

            var pVelocity = new THREE.Vector3().addVectors(
                new THREE.Vector3().fromArray(parameters.velocity),  new THREE.Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
            var pAcceleration = new THREE.Vector3().addVectors(
                new THREE.Vector3().fromArray(parameters.acceleration),
                new THREE.Vector3().fromArray(plusMinusVector(parameters.accelerationRange)));
            var pColorMult = new THREE.Vector4().addVectors(
                new THREE.Vector4().fromArray(parameters.colorMult), new THREE.Vector4().fromArray(plusMinusVector(parameters.colorMultRange)));
            var pSpinStart =
                parameters.spinStart + plusMinus(parameters.spinStartRange);
            var pSpinSpeed =
                parameters.spinSpeed + plusMinus(parameters.spinSpeedRange);
            var pStartSize =
                parameters.startSize + plusMinus(parameters.startSizeRange);
            var pEndSize = parameters.endSize + plusMinus(parameters.endSizeRange);
            var pOrientation = new THREE.Vector4().fromArray(parameters.orientation);
            // make each corner of the particle.
            for (var jj = 0; jj < 4; ++jj) {

                var offset0 = ParticleSpec.LAST_IDX * jj +(ii*ParticleSpec.LAST_IDX*4)+(firstParticleIndex*ParticleSpec.LAST_IDX*4);
                var offset1 = offset0 + 1;
                var offset2 = offset0 + 2;
                var offset3 = offset0 + 3;

                interleaveBufferData[ ParticleSpec.POSITION_START_TIME_IDX + offset0 ] = pPosition.x;
                interleaveBufferData[ ParticleSpec.POSITION_START_TIME_IDX + offset1 ] = pPosition.y;
                interleaveBufferData[ ParticleSpec.POSITION_START_TIME_IDX + offset2 ] = pPosition.z;
                interleaveBufferData[ ParticleSpec.POSITION_START_TIME_IDX + offset3] = pStartTime;

                interleaveBufferData[ParticleSpec.UV_LIFE_TIME_FRAME_START_IDX + offset0] = CORNERS_[jj][0];
                interleaveBufferData[ParticleSpec.UV_LIFE_TIME_FRAME_START_IDX + offset1] = CORNERS_[jj][1];
                interleaveBufferData[ParticleSpec.UV_LIFE_TIME_FRAME_START_IDX + offset2] = pLifeTime;
                interleaveBufferData[ParticleSpec.UV_LIFE_TIME_FRAME_START_IDX + offset3] = pFrameStart;

                interleaveBufferData[ParticleSpec.VELOCITY_START_SIZE_IDX + offset0] = pVelocity.x;
                interleaveBufferData[ParticleSpec.VELOCITY_START_SIZE_IDX + offset1] = pVelocity.y;
                interleaveBufferData[ParticleSpec.VELOCITY_START_SIZE_IDX + offset2] = pVelocity.z;
                interleaveBufferData[ParticleSpec.VELOCITY_START_SIZE_IDX + offset3] = pStartSize;

                interleaveBufferData[ParticleSpec.ACCELERATION_END_SIZE_IDX + offset0] = pAcceleration.x;
                interleaveBufferData[ParticleSpec.ACCELERATION_END_SIZE_IDX + offset1] = pAcceleration.y;
                interleaveBufferData[ParticleSpec.ACCELERATION_END_SIZE_IDX + offset2] = pAcceleration.z;
                interleaveBufferData[ParticleSpec.ACCELERATION_END_SIZE_IDX + offset3] = pEndSize;

                interleaveBufferData[ParticleSpec.SPIN_START_SPIN_SPEED_IDX + offset0] = pSpinStart;
                interleaveBufferData[ParticleSpec.SPIN_START_SPIN_SPEED_IDX + offset1] = pSpinSpeed;
                interleaveBufferData[ParticleSpec.SPIN_START_SPIN_SPEED_IDX + offset2] = 0;
                interleaveBufferData[ParticleSpec.SPIN_START_SPIN_SPEED_IDX + offset3] = 0;

                interleaveBufferData[ParticleSpec.ORIENTATION_IDX + offset0] = pOrientation.x;
                interleaveBufferData[ParticleSpec.ORIENTATION_IDX + offset1] = pOrientation.y;
                interleaveBufferData[ParticleSpec.ORIENTATION_IDX + offset2] = pOrientation.z;
                interleaveBufferData[ParticleSpec.ORIENTATION_IDX + offset3] = pOrientation.w;

                interleaveBufferData[ParticleSpec.COLOR_MULT_IDX + offset0] = pColorMult.x;
                interleaveBufferData[ParticleSpec.COLOR_MULT_IDX + offset1] = pColorMult.y;
                interleaveBufferData[ParticleSpec.COLOR_MULT_IDX + offset2] = pColorMult.z;
                interleaveBufferData[ParticleSpec.COLOR_MULT_IDX + offset3] = pColorMult.w;

            }
        }

        this.interleavedBuffer.needsUpdate = true;

        this.material.uniforms.worldVelocity.value = new THREE.Vector3(parameters.worldVelocity[0],parameters.worldVelocity[1], parameters.worldVelocity[2]);
        this.material.uniforms.worldAcceleration.value = new THREE.Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
        this.material.uniforms.timeRange.value = parameters.timeRange;
        this.material.uniforms.frameDuration.value = parameters.frameDuration;
        this.material.uniforms.numFrames.value = parameters.numFrames;
        this.material.uniforms.rampSampler.value = this.rampTexture_;
        this.material.uniforms.colorSampler.value = this.colorTexture_;

        this.material.blending = this.blendFunc_;


    }

    allocateParticles_(numParticles,parameters) {

        if (this.numParticles_ != numParticles) {

            var numIndices = 6 * numParticles;
            if (numIndices > 65536) {
                throw "can't have more than 10922 particles per emitter";
            }

            var indices = new Uint16Array(numIndices);
            var idx = 0;


            for (var ii = 0; ii < numParticles; ++ii) {
                // Make 2 triangles for the quad.
                var startIndex = ii * 4;
                indices[idx++] = startIndex + 0;
                indices[idx++] = startIndex + 1;
                indices[idx++] = startIndex + 2;
                indices[idx++] = startIndex + 0;
                indices[idx++] = startIndex + 2;
                indices[idx++] = startIndex + 3;
            }


            this.indexBuffer_=indices;
            this.numParticles_ = numParticles;

            this.interleavedBuffer=new THREE.InterleavedBuffer(new Float32Array(numParticles*ParticleSpec.singleParticleArray_.byteLength),ParticleSpec.LAST_IDX).setDynamic(true);

            this.particleBuffer_.setIndex(new THREE.BufferAttribute(this.indexBuffer_, 1));
            this.particleBuffer_.addAttribute('position', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 3, ParticleSpec.POSITION_START_TIME_IDX));
            this.particleBuffer_.addAttribute('startTime', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
            this.particleBuffer_.addAttribute('uvLifeTimeFrameStart', new THREE.InterleavedBufferAttribute(this.interleavedBuffer,4, ParticleSpec.UV_LIFE_TIME_FRAME_START_IDX));
            this.particleBuffer_.addAttribute('velocityStartSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,ParticleSpec.VELOCITY_START_SIZE_IDX ));
            this.particleBuffer_.addAttribute('accelerationEndSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,ParticleSpec.ACCELERATION_END_SIZE_IDX));
            this.particleBuffer_.addAttribute('spinStartSpinSpeed', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,ParticleSpec.SPIN_START_SPIN_SPEED_IDX));
            this.particleBuffer_.addAttribute('orientation', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,ParticleSpec.ORIENTATION_IDX));
            this.particleBuffer_.addAttribute('colorMult', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,ParticleSpec.COLOR_MULT_IDX));
            this.particleBuffer_.boundingSphere=new THREE.Sphere();

            var uniforms = {

                world:  { type: 'm4', value: this.matrixWorld },
                viewInverse:  { type: 'm4', value: new THREE.Matrix4()},
                worldVelocity:  { type: 'v3', value: null },
                worldAcceleration:  { type: 'v3', value: null },
                timeRange:  { type: 'f', value: null },
                time:  { type: 'f', value: null },
                timeOffset:  { type: 'f', value: null },
                frameDuration:  { type: 'f', value: null },
                numFrames:  { type: 'f', value: null },
                rampSampler: { type: "t", value: this.rampTexture_ }, // regular texture;
                colorSampler: { type: "t", value: this.colorTexture_ } // regular texture;

            };

            var material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: (parameters.billboard)? billboardParticleVertexShader:orientedParticleVertexShader,
                fragmentShader: particleFragmentShader,
                side: THREE.DoubleSide,//(this.billboard_)? THREE.DoubleSide:THREE.FrontSide,
                blending: this.blendFunc_,
                depthTest:      true,
                depthWrite:      false,
                transparent:    true
            });



            this.geometry = this.particleBuffer_;
            this.material = material;

        }
    }

    setParameters ( parameters, opt_perParticleParamSetter) {

        this.validateParameters(parameters);

        var numParticles = parameters.numParticles;

        this.allocateParticles_(numParticles,parameters);
        this.createParticles_(
            0,
            numParticles,
            parameters,
            opt_perParticleParamSetter);
    }

    draw (world, viewProjection, timeOffset) {

        //var uniforms = this.mesh.material.uniforms;
        var uniforms = this.material.uniforms;
        if(world !== undefined) {
            uniforms.world.value=world;
        }


        var curTime = this.timeSource_();
        uniforms.time.value=curTime;
        uniforms.timeOffset.value=timeOffset;

    }

    createOneShot() {

        return new OneShot(this);
    }

    clone ( object ) {
        if ( object === undefined ) object = this.particleSystem.createParticleEmitter(this.colorTexture_, this.timeSource_);//new ParticleEmitter(this.particleSystem,this.colorTexture_,this.timeSource_);
        object.geometry=this.geometry;
        object.material=this.material.clone();
        object.material.uniforms.world.value=object.matrixWorld;
        object.material.uniforms.viewInverse.value = camera.matrixWorld;
        object.material.uniforms.rampSampler.value=this.rampTexture_;
        object.material.uniforms.colorSampler.value=this.colorTexture_;
        super.clone( object );
        return object;
    }

}

export default ParticleEmitter