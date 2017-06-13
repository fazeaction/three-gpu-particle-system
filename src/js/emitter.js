// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

import * as Constants  from './constants.js'
import {ParticleSpec} from './particle-spec.js'
import {OneShot} from './one-shot.js'
import billboardParticleInstancedVertexShader from './../shaders/particles-billboard-instanced_vs.glsl'
import orientedParticleInstancedVertexShader from './../shaders/particles-oriented-instanced_vs.glsl'
import particleFragmentShader from './../shaders/particles_fs.glsl'

function ParticleEmitter ( particleSystem, opt_texture, opt_clock ) {

	THREE.Mesh.call( this );

	opt_clock = opt_clock || particleSystem.timeSource_;

	//TODO make alternative to instanced buffer
	//this.particleBuffer_ = new THREE.BufferGeometry();
	//this.indexBuffer_ = [];

	this.particleBuffer_ = new THREE.InstancedBufferGeometry();
	this.interleavedBuffer = new THREE.InterleavedBuffer();

	this.numParticles_ = 0;

	this.rampTexture_ = particleSystem.defaultRampTexture;
	this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;

	this.particleSystem = particleSystem;

	this.timeSource_ = opt_clock;

	this.setState( THREE.NormalBlending );

};

ParticleEmitter.prototype = Object.create( THREE.Mesh.prototype );

ParticleEmitter.prototype.constructor = ParticleEmitter;

ParticleEmitter.prototype.setTranslation = function ( x, y, z ) {

        this.position.x = x;
        this.position.y = y;
        this.position.z = z;

};

ParticleEmitter.prototype.setState = function ( stateId ) {

        this.blendFunc_ = stateId;

};

ParticleEmitter.prototype.setColorRamp = function ( colorRamp ) {

	var width = colorRamp.length / 4;
	if (width % 1 != 0) {

		throw 'colorRamp must have multiple of 4 entries';

	}

	if (this.rampTexture_ == this.particleSystem.defaultRampTexture) {

		this.rampTexture_ = null;

	}

	this.rampTexture_ = this.particleSystem.createTextureFromFloats( width, 1, colorRamp, this.rampTexture_ );

};

ParticleEmitter.prototype.validateParameters = function ( parameters ) {

	var defaults = new ParticleSpec();

	for ( var key in parameters ) {

		if ( typeof defaults[ key ] === 'undefined' ) {

			throw 'unknown particle parameter "' + key + '"';

		}

	}

	for ( var key in defaults ) {

		if ( typeof parameters[ key ] === 'undefined' ) {

			parameters[ key ] = defaults[ key ];

		}

	}

};

ParticleEmitter.prototype.createParticles_ = function( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter ) {

    var interleaveBufferData = this.interleavedBuffer.array;

    this.billboard_ = parameters.billboard;

    var random = this.particleSystem.randomFunction_;

    var plusMinus = function ( range ) {

        return ( random() - 0.5 ) * range * 2;

    };

    // TODO: change to not allocate.
    var plusMinusVector = function ( range ) {

        var v = [];

        for (var ii = 0; ii < range.length; ++ ii) {

            v.push( plusMinus( range[ ii ] ) );

        }

        return v;

    };

    for ( var ii = 0; ii < numParticles; ++ ii ) {

        if ( opt_perParticleParamSetter ) {

            opt_perParticleParamSetter( ii, parameters );

        }

        var pLifeTime = parameters.lifeTime;
        var pStartTime = ( parameters.startTime === null ) ? ( ii * parameters.lifeTime / numParticles ) : parameters.startTime;
        var pFrameStart = parameters.frameStart + plusMinus(parameters.frameStartRange);
        var pPosition = new THREE.Vector3().addVectors( new THREE.Vector3().fromArray(parameters.position), new THREE.Vector3().fromArray(plusMinusVector(parameters.positionRange)));
        var pVelocity = new THREE.Vector3().addVectors( new THREE.Vector3().fromArray(parameters.velocity), new THREE.Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
        var pAcceleration = new THREE.Vector3().addVectors( new THREE.Vector3().fromArray(parameters.acceleration), new THREE.Vector3().fromArray( plusMinusVector( parameters.accelerationRange )));
        var pColorMult = new THREE.Vector4().addVectors( new THREE.Vector4().fromArray(parameters.colorMult), new THREE.Vector4().fromArray(plusMinusVector( parameters.colorMultRange )));
        var pSpinStart = parameters.spinStart + plusMinus(parameters.spinStartRange);
        var pSpinSpeed = parameters.spinSpeed + plusMinus(parameters.spinSpeedRange);
        var pStartSize = parameters.startSize + plusMinus(parameters.startSizeRange);
        var pEndSize = parameters.endSize + plusMinus(parameters.endSizeRange);
        var pOrientation = new THREE.Vector4().fromArray(parameters.orientation);

        for (var jj = 0; jj < 1; ++jj) {

            var offset0 = Constants.LAST_IDX * jj + ( ii * Constants.LAST_IDX * 4 ) + ( firstParticleIndex * Constants.LAST_IDX * 4 );
            var offset1 = offset0 + 1;
            var offset2 = offset0 + 2;
            var offset3 = offset0 + 3;


            interleaveBufferData[Constants.POSITION_START_TIME_IDX + offset0] = pPosition.x;
            interleaveBufferData[Constants.POSITION_START_TIME_IDX + offset1] = pPosition.y;
            interleaveBufferData[Constants.POSITION_START_TIME_IDX + offset2] = pPosition.z;
            interleaveBufferData[Constants.POSITION_START_TIME_IDX + offset3] = pStartTime;

            interleaveBufferData[Constants.UV_LIFE_TIME_FRAME_START_IDX + offset0] = Constants.CORNERS_[jj][0];
            interleaveBufferData[Constants.UV_LIFE_TIME_FRAME_START_IDX + offset1] = Constants.CORNERS_[jj][1];
            interleaveBufferData[Constants.UV_LIFE_TIME_FRAME_START_IDX + offset2] = pLifeTime;
            interleaveBufferData[Constants.UV_LIFE_TIME_FRAME_START_IDX + offset3] = pFrameStart;

            interleaveBufferData[Constants.VELOCITY_START_SIZE_IDX + offset0] = pVelocity.x;
            interleaveBufferData[Constants.VELOCITY_START_SIZE_IDX + offset1] = pVelocity.y;
            interleaveBufferData[Constants.VELOCITY_START_SIZE_IDX + offset2] = pVelocity.z;
            interleaveBufferData[Constants.VELOCITY_START_SIZE_IDX + offset3] = pStartSize;

            interleaveBufferData[Constants.ACCELERATION_END_SIZE_IDX + offset0] = pAcceleration.x;
            interleaveBufferData[Constants.ACCELERATION_END_SIZE_IDX + offset1] = pAcceleration.y;
            interleaveBufferData[Constants.ACCELERATION_END_SIZE_IDX + offset2] = pAcceleration.z;
            interleaveBufferData[Constants.ACCELERATION_END_SIZE_IDX + offset3] = pEndSize;

            interleaveBufferData[Constants.SPIN_START_SPIN_SPEED_IDX + offset0] = pSpinStart;
            interleaveBufferData[Constants.SPIN_START_SPIN_SPEED_IDX + offset1] = pSpinSpeed;
            interleaveBufferData[Constants.SPIN_START_SPIN_SPEED_IDX + offset2] = 0;
            interleaveBufferData[Constants.SPIN_START_SPIN_SPEED_IDX + offset3] = 0;

            interleaveBufferData[Constants.ORIENTATION_IDX + offset0] = pOrientation.x;
            interleaveBufferData[Constants.ORIENTATION_IDX + offset1] = pOrientation.y;
            interleaveBufferData[Constants.ORIENTATION_IDX + offset2] = pOrientation.z;
            interleaveBufferData[Constants.ORIENTATION_IDX + offset3] = pOrientation.w;

            interleaveBufferData[Constants.COLOR_MULT_IDX + offset0] = pColorMult.x;
            interleaveBufferData[Constants.COLOR_MULT_IDX + offset1] = pColorMult.y;
            interleaveBufferData[Constants.COLOR_MULT_IDX + offset2] = pColorMult.z;
            interleaveBufferData[Constants.COLOR_MULT_IDX + offset3] = pColorMult.w;

        }

    }

    this.interleavedBuffer.needsUpdate = true;

    this.material.uniforms.worldVelocity.value = new THREE.Vector3(parameters.worldVelocity[0], parameters.worldVelocity[1], parameters.worldVelocity[2]);
    this.material.uniforms.worldAcceleration.value = new THREE.Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
    this.material.uniforms.timeRange.value = parameters.timeRange;
    this.material.uniforms.frameDuration.value = parameters.frameDuration;
    this.material.uniforms.numFrames.value = parameters.numFrames;
    this.material.uniforms.rampSampler.value = this.rampTexture_;
    this.material.uniforms.colorSampler.value = this.colorTexture_;

    this.material.blending = this.blendFunc_;

};

ParticleEmitter.prototype.allocateParticles_ = function ( numParticles, parameters ) {

	if ( this.numParticles_ != numParticles ) {

		if (THREE.BufferGeometry.MaxIndex < 65536) {

			throw "can't have more than 10922 particles per emitter";

		}

		var vertexBuffer = new THREE.InterleavedBuffer( new Float32Array([
			// Front
			0, 0, 0, 0, -0.5, -0.5, 0, 0,
			0, 0, 0, 0, 0.5, -0.5, 0, 0,
			0, 0, 0, 0, 0.5, 0.5, 0, 0,
			0, 0, 0, 0, -0.5, 0.5, 0, 0
		]), 8);


		// Use vertexBuffer, starting at offset 0, 3 items in position attribute
		var positions = new THREE.InterleavedBufferAttribute( vertexBuffer, 3, 0 );
		this.particleBuffer_.addAttribute( 'position', positions );
		// Use vertexBuffer, starting at offset 4, 2 items in uv attribute
		var uvs = new THREE.InterleavedBufferAttribute( vertexBuffer, 2, 4 );
		this.particleBuffer_.addAttribute( 'uv', uvs );

		var indices = new Uint16Array([

			0, 1, 2,
			0, 2, 3

		]);

		this.particleBuffer_.setIndex( new THREE.BufferAttribute( indices, 1 ) );

		this.numParticles_ = numParticles;
		this.interleavedBuffer = new THREE.InstancedInterleavedBuffer( new Float32Array( numParticles * Constants.singleParticleArray_.byteLength ), Constants.LAST_IDX, 1 ).setDynamic( true );

		this.particleBuffer_.addAttribute( 'position', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 3, Constants.POSITION_START_TIME_IDX));
		this.particleBuffer_.addAttribute( 'startTime', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
		this.particleBuffer_.addAttribute( 'uvLifeTimeFrameStart', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.UV_LIFE_TIME_FRAME_START_IDX));
		this.particleBuffer_.addAttribute( 'velocityStartSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.VELOCITY_START_SIZE_IDX));
		this.particleBuffer_.addAttribute( 'accelerationEndSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.ACCELERATION_END_SIZE_IDX));
		this.particleBuffer_.addAttribute( 'spinStartSpinSpeed', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.SPIN_START_SPIN_SPEED_IDX));
		this.particleBuffer_.addAttribute( 'orientation', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.ORIENTATION_IDX));
		this.particleBuffer_.addAttribute( 'colorMult', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4, Constants.COLOR_MULT_IDX));

		//TODO Fix boundingSphere
		this.particleBuffer_.boundingSphere = new THREE.Sphere();

		var uniforms = {

			//world: { type: 'm4', value: this.matrixWorld },
			viewInverse: { type: 'm4', value: this.particleSystem.camera.matrixWorld },
			worldVelocity: { type: 'v3', value: null },
			worldAcceleration: { type: 'v3', value: null },
			timeRange: { type: 'f', value: null },
			time: { type: 'f', value: null },
			timeOffset: { type: 'f', value: null },
			frameDuration: { type: 'f', value: null },
			numFrames: { type: 'f', value: null },
			rampSampler: { type: "t", value: this.rampTexture_ },
			colorSampler: { type: "t", value: this.colorTexture_ }

		};

		var material = new THREE.ShaderMaterial({

			uniforms: uniforms,
			vertexShader: ( parameters.billboard ) ? billboardParticleInstancedVertexShader : orientedParticleInstancedVertexShader,
			fragmentShader: particleFragmentShader,
			side: (this.billboard_)? THREE.DoubleSide:THREE.FrontSide,
			blending: this.blendFunc_,
			depthTest: true,
			depthWrite: false,
			transparent: true

		});


		this.geometry = this.particleBuffer_;
		this.material = material;

	}

};

ParticleEmitter.prototype.setParameters = function ( parameters, opt_perParticleParamSetter ) {

	this.validateParameters ( parameters );

	var numParticles = parameters.numParticles;

	this.allocateParticles_ ( numParticles, parameters );
	this.createParticles_ ( 0, numParticles, parameters, opt_perParticleParamSetter );

};

ParticleEmitter.prototype.draw = function ( world, viewProjection, timeOffset ) {

	var uniforms = this.material.uniforms;

	uniforms.time.value = this.timeSource_();
	uniforms.timeOffset.value = timeOffset;

};

ParticleEmitter.prototype.createOneShot = function () {

	return new OneShot( this, this.particleSystem.scene );

};

ParticleEmitter.prototype.clone = function ( object ) {

	if ( object === undefined ) object = this.particleSystem.createParticleEmitter( this.colorTexture_, this.timeSource_);

	object.geometry = this.geometry;
	object.material = this.material.clone();
	object.material.uniforms.viewInverse.value = this.particleSystem.camera.matrixWorld;
	object.material.uniforms.rampSampler.value = this.rampTexture_;
	object.material.uniforms.colorSampler.value = this.colorTexture_;

	THREE.Mesh.prototype.clone.call( this, object );

	return object;

};

export { ParticleEmitter }