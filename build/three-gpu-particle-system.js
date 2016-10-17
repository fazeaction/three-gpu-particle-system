(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.THREE_GPU_ParticleSystem = global.THREE_GPU_ParticleSystem || {})));
}(this, (function (exports) { 'use strict';

var CORNERS_ = [

	[ - 0.5, - 0.5 ],
	[ + 0.5, - 0.5 ],
	[ + 0.5, + 0.5 ],
	[ - 0.5, + 0.5 ]

];

function createDefaultClock_( particleSystem ) {

	return function () {

					var now = particleSystem.now_;
					var base = particleSystem.timeBase_;

					return ( now.getTime() - base.getTime() ) / 1000.0;

				}

}

var POSITION_START_TIME_IDX = 0;
var UV_LIFE_TIME_FRAME_START_IDX = 4;
var VELOCITY_START_SIZE_IDX = 8;
var ACCELERATION_END_SIZE_IDX = 12;
var SPIN_START_SPIN_SPEED_IDX = 16;
var ORIENTATION_IDX = 20;
var COLOR_MULT_IDX = 24;
var LAST_IDX = 28;
var singleParticleArray_ = new Float32Array( 4 * LAST_IDX );

function ParticleSpec () {

	this.numParticles = 1;

	this.numFrames = 1;

	this.frameDuration = 1;

	this.frameStart = 0;

	this.frameStartRange = 0;

	this.timeRange = 99999999;

	this.startTime = null;

	this.lifeTime = 1;

	this.lifeTimeRange = 0;

	this.startSize = 1;

	this.startSizeRange = 0;

	this.endSize = 1;

	this.endSizeRange = 0;

	this.position = [ 0, 0, 0 ];

	this.positionRange = [ 0, 0, 0 ];

	this.velocity = [ 0, 0, 0 ];

	this.velocityRange = [ 0, 0, 0 ];

	this.acceleration = [ 0, 0, 0 ];

	this.accelerationRange = [ 0, 0, 0 ];

	this.spinStart = 0;

	this.spinStartRange = 0;

	this.spinSpeed = 0;

	this.spinSpeedRange = 0;

	this.colorMult = [ 1, 1, 1, 1 ];

	this.colorMultRange = [ 0, 0, 0, 0 ];

	this.worldVelocity = [ 0, 0, 0 ];

	this.worldAcceleration = [ 0, 0, 0 ];

	this.billboard = true;

	this.orientation = [ 0, 0, 0, 1 ];

}

function OneShot( emitter, scene ) {

	THREE.Mesh.call( this );
	this.emitter_ = emitter.clone();
	this.scene = scene;

	this.world_ = new THREE.Matrix4();
	this.tempWorld_ = new THREE.Matrix4();
	this.timeOffset_ = 0;
	this.visible_ = false;

	// Remove the parent emitter from the particle system's drawable
	// list (if it's still there) and add ourselves instead.
	var particleSystem = emitter.particleSystem;
	var idx = particleSystem.drawables_.indexOf( this.emitter_ );
	if ( idx >= 0 ) {

		particleSystem.drawables_.splice( idx, 1 );

	}

	particleSystem.drawables_.push( this );

}

OneShot.prototype = Object.create( THREE.Mesh.prototype );

OneShot.prototype.constructor = OneShot;


OneShot.prototype.trigger = function ( opt_world ) {

	if ( ! this.visible_ ) {

		this.scene.add( this.emitter_ );

	}
	if ( opt_world ) {

		this.world_.setPosition( new THREE.Vector3().fromArray( opt_world ) );

	}
	this.visible_ = true;
	this.timeOffset_ = this.emitter_.timeSource_();

};

OneShot.prototype.draw = function ( world, viewProjection, timeOffset ) {

	if ( this.visible_ ) {

		//this.tempWorld_.multiplyMatrices(this.world_, world);
		this.emitter_.draw( this.world_, viewProjection, this.timeOffset_ );

	}

};

var billboardParticleInstancedVertexShader = "uniform mat4 world;\r\n        uniform mat4 viewInverse;\r\n        uniform vec3 worldVelocity;\r\n        uniform vec3 worldAcceleration;\r\n        uniform float timeRange;\r\n        uniform float time;\r\n        uniform float timeOffset;\r\n        uniform float frameDuration;\r\n        uniform float numFrames;\r\n\r\n        // Incoming vertex attributes\r\n        attribute vec3 offset;\r\n        attribute vec4 uvLifeTimeFrameStart;\r\n        attribute float startTime;\r\n        attribute vec4 velocityStartSize;\r\n        attribute vec4 accelerationEndSize;\r\n        attribute vec4 spinStartSpinSpeed;\r\n        attribute vec4 colorMult;\r\n\r\n        // Outgoing variables to fragment shader\r\n        varying vec2 outputTexcoord;\r\n        varying float outputPercentLife;\r\n        varying vec4 outputColorMult;\r\n\r\n        void main() {\r\n            float lifeTime = uvLifeTimeFrameStart.z;\r\n            float frameStart = uvLifeTimeFrameStart.w;\r\n            vec3 velocity = (world * vec4(velocityStartSize.xyz,\r\n                                         0.)).xyz + worldVelocity;\r\n            float startSize = velocityStartSize.w;\r\n            vec3 acceleration = (world * vec4(accelerationEndSize.xyz,\r\n                                             0)).xyz + worldAcceleration;\r\n            float endSize = accelerationEndSize.w;\r\n            float spinStart = spinStartSpinSpeed.x;\r\n            float spinSpeed = spinStartSpinSpeed.y;\r\n\r\n            float localTime = mod((time - timeOffset - startTime), timeRange);\r\n            float percentLife = localTime / lifeTime;\r\n\r\n            float frame = mod(floor(localTime / frameDuration + frameStart),\r\n                             numFrames);\r\n            float uOffset = frame / numFrames;\r\n            float u = uOffset + (uv.x + 0.5) * (1. / numFrames);\r\n\r\n            outputTexcoord = vec2(u, uv.y + 0.5);\r\n            outputColorMult = colorMult;\r\n\r\n            vec3 basisX = viewInverse[0].xyz;\r\n            vec3 basisZ = viewInverse[1].xyz;\r\n\r\n            float size = mix(startSize, endSize, percentLife);\r\n            size = (percentLife < 0. || percentLife > 1.) ? 0. : size;\r\n            float s = sin(spinStart + spinSpeed * localTime);\r\n            float c = cos(spinStart + spinSpeed * localTime);\r\n\r\n            vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, -uv.x * s + uv.y * c);\r\n            vec3 localPosition = vec3(basisX * rotatedPoint.x + basisZ * rotatedPoint.y) * size +\r\n                                velocity * localTime +\r\n                                acceleration * localTime * localTime +\r\n                                position;\r\n\r\n            outputPercentLife = percentLife;\r\n            gl_Position = projectionMatrix * viewMatrix * vec4(localPosition + offset + world[3].xyz, 1.);\r\n\r\n        }";

var orientedParticleInstancedVertexShader = "// 3D (oriented) vertex shader\r\n       uniform mat4 worldViewProjection;\r\n       uniform mat4 world;\r\n       uniform vec3 worldVelocity;\r\n       uniform vec3 worldAcceleration;\r\n       uniform float timeRange;\r\n       uniform float time;\r\n       uniform float timeOffset;\r\n       uniform float frameDuration;\r\n       uniform float numFrames;\r\n\r\n      // Incoming vertex attributes\r\n      attribute vec3 offset;\r\n      attribute vec4 uvLifeTimeFrameStart; // uv, lifeTime, frameStart\r\n      attribute float startTime;    // position.xyz, startTime\r\n      attribute vec4 velocityStartSize;    // velocity.xyz, startSize\r\n      attribute vec4 accelerationEndSize;  // acceleration.xyz, endSize\r\n      attribute vec4 spinStartSpinSpeed;   // spinStart.x, spinSpeed.y\r\n      attribute vec4 orientation;          // orientation quaternion\r\n      attribute vec4 colorMult;            // multiplies color and ramp textures\r\n\r\n       // Outgoing variables to fragment shader\r\n       varying vec2 outputTexcoord;\r\n       varying float outputPercentLife;\r\n       varying vec4 outputColorMult;\r\n      void main() {\r\n        float lifeTime = uvLifeTimeFrameStart.z;\r\n        float frameStart = uvLifeTimeFrameStart.w;\r\n        vec3 velocity = (world * vec4(velocityStartSize.xyz,\r\n                                      0.)).xyz + worldVelocity;\r\n        float startSize = velocityStartSize.w;\r\n        vec3 acceleration = (world * vec4(accelerationEndSize.xyz,\r\n                                          0)).xyz + worldAcceleration;\r\n        float endSize = accelerationEndSize.w;\r\n        float spinStart = spinStartSpinSpeed.x;\r\n        float spinSpeed = spinStartSpinSpeed.y;\r\n\r\n        float localTime = mod((time - timeOffset - startTime), timeRange);\r\n        float percentLife = localTime / lifeTime;\r\n\r\n        float frame = mod(floor(localTime / frameDuration + frameStart),\r\n                          numFrames);\r\n        float uOffset = frame / numFrames;\r\n        float u = uOffset + (uv.x + 0.5) * (1. / numFrames);\r\n\r\n        outputTexcoord = vec2(u, uv.y + 0.5);\r\n        outputColorMult = colorMult;\r\n\r\n        float size = mix(startSize, endSize, percentLife);\r\n        size = (percentLife < 0. || percentLife > 1.) ? 0. : size;\r\n        float s = sin(spinStart + spinSpeed * localTime);\r\n        float c = cos(spinStart + spinSpeed * localTime);\r\n\r\n        vec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.,\r\n                                 (uv.x * s - uv.y * c) * size, 1.);\r\n        vec3 center = velocity * localTime +\r\n                      acceleration * localTime * localTime +\r\n                      position +offset;\r\n\r\n        vec4 q2 = orientation + orientation;\r\n        vec4 qx = orientation.xxxw * q2.xyzx;\r\n        vec4 qy = orientation.xyyw * q2.xyzy;\r\n        vec4 qz = orientation.xxzw * q2.xxzz;\r\n\r\n        mat4 localMatrix = mat4(\r\n            (1.0 - qy.y) - qz.z,\r\n            qx.y + qz.w,\r\n            qx.z - qy.w,\r\n            0,\r\n\r\n            qx.y - qz.w,\r\n            (1.0 - qx.x) - qz.z,\r\n            qy.z + qx.w,\r\n            0,\r\n\r\n            qx.z + qy.w,\r\n            qy.z - qx.w,\r\n            (1.0 - qx.x) - qy.y,\r\n            0,\r\n\r\n            center.x, center.y, center.z, 1);\r\n        rotatedPoint = localMatrix * rotatedPoint;\r\n        outputPercentLife = percentLife;\r\n        gl_Position = projectionMatrix * modelViewMatrix * rotatedPoint;\r\n      }";

var particleFragmentShader = "  #ifdef GL_ES\r\n        precision mediump float;\r\n        #endif\r\n        uniform sampler2D rampSampler;\r\n        uniform sampler2D colorSampler;\r\n\r\n        // Incoming variables from vertex shader\r\n        varying vec2 outputTexcoord;\r\n        varying float outputPercentLife;\r\n        varying vec4 outputColorMult;\r\n\r\n        void main() {\r\n            vec4 colorMult = texture2D(rampSampler, vec2(outputPercentLife, 0.5)) * outputColorMult;\r\n            gl_FragColor = texture2D(colorSampler, outputTexcoord) * colorMult;\r\n            // For debugging: requires setup of some uniforms and vertex\r\n            // attributes to be commented out to avoid GL errors\r\n            //gl_FragColor = vec4(1., 0., 0., 1.);\r\n        }";

function ParticleEmitter ( particleSystem, opt_texture, opt_clock ) {

	THREE.Mesh.call( this );

	opt_clock = opt_clock || particleSystem.timeSource_;

	this.tmpWorld_ = new Float32Array( 16 );

	//this.particleBuffer_ = new THREE.BufferGeometry();


	this.particleBuffer_ = new THREE.InstancedBufferGeometry();
	this.interleavedBuffer = new THREE.InterleavedBuffer();

	this.indexBuffer_ = [];

	this.numParticles_ = 0;

	this.rampTexture_ = particleSystem.defaultRampTexture;
	this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;

	this.particleSystem = particleSystem;

	this.timeSource_ = opt_clock;

	this.translation_ = [ 0, 0, 0 ];

	this.setState( THREE.NormalBlending );

}
/*
var ParticleEmitter = function( particleSystem, opt_texture, opt_clock) {



    THREE.Mesh.call( this );

    opt_clock = opt_clock || particleSystem.timeSource_;

    this.tmpWorld_ = new Float32Array(16);

    this.particleBuffer_ = new THREE.BufferGeometry();
    // The VBO holding the particles' data, (re-)allocated in
    // allocateParticles_().

    //this.particleBuffer_ = new THREE.BufferGeometry();

    //this.particleBuffer_ = new THREE.InstancedBufferGeometry();
    //this.interleavedBuffer = new THREE.InterleavedBuffer();

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
};*/

ParticleEmitter.prototype = Object.create( THREE.Mesh.prototype );

ParticleEmitter.prototype.constructor = ParticleEmitter

ParticleEmitter.prototype.setTranslation = function ( x, y, z ) {

        this.position.x = x;
        this.position.y = y;
        this.position.z = z;

							}

ParticleEmitter.prototype.setState = function ( stateId ) {

        this.blendFunc_ = stateId;

}

ParticleEmitter.prototype.setColorRamp = function ( colorRamp ) {

        var width = colorRamp.length / 4;
        if ( width % 1 != 0 ) {

									throw 'colorRamp must have multiple of 4 entries';

        }

        if ( this.rampTexture_ == this.particleSystem.defaultRampTexture ) {

									this.rampTexture_ = null;

        }

        this.rampTexture_ = this.particleSystem.createTextureFromFloats( width, 1, colorRamp, this.rampTexture_ );

}

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

}

/*ParticleEmitter.prototype.createParticles_ = function( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter) {

    var positions = this.geometry.attributes.position.array
    var startTime = this.geometry.attributes.startTime.array
    var uvLifeTimeFrameStart = this.geometry.attributes.uvLifeTimeFrameStart.array
    var velocityStartSize = this.geometry.attributes.velocityStartSize.array
    var accelerationEndSize = this.geometry.attributes.accelerationEndSize.array
    var spinStartSpinSpeed = this.geometry.attributes.spinStartSpinSpeed.array
    var orientation = this.geometry.attributes.orientation.array
    var colorMult = this.geometry.attributes.colorMult.array

    var offset_position=0+(firstParticleIndex*3*4);
    var offset_start_time=0+(firstParticleIndex*4);
    var offset_4buffers=0+(firstParticleIndex*4*4);

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

            positions[ offset_position ] = pPosition.x;
            positions[ offset_position + 1 ] = pPosition.y;
            positions[ offset_position + 2 ] = pPosition.z;


            uvLifeTimeFrameStart[offset_4buffers] = Constants.CORNERS_[jj][0];
            uvLifeTimeFrameStart[offset_4buffers + 1] = Constants.CORNERS_[jj][1];
            uvLifeTimeFrameStart[offset_4buffers + 2] = pLifeTime;
            uvLifeTimeFrameStart[offset_4buffers + 3] = pFrameStart;

            startTime[ offset_start_time] = pStartTime;

            velocityStartSize[offset_4buffers] = pVelocity.x;
            velocityStartSize[offset_4buffers + 1] = pVelocity.y;
            velocityStartSize[offset_4buffers + 2] = pVelocity.z;
            velocityStartSize[offset_4buffers + 3] = pStartSize;

            accelerationEndSize[offset_4buffers] = pAcceleration.x;
            accelerationEndSize[offset_4buffers + 1] = pAcceleration.y;
            accelerationEndSize[offset_4buffers + 2] = pAcceleration.z;
            accelerationEndSize[offset_4buffers + 3] = pEndSize;

            spinStartSpinSpeed[offset_4buffers] = pSpinStart;
            spinStartSpinSpeed[offset_4buffers + 1] = pSpinSpeed;
            spinStartSpinSpeed[offset_4buffers + 2] = 0;
            spinStartSpinSpeed[offset_4buffers + 3] = 0;

            orientation[offset_4buffers] = pOrientation.x;
            orientation[offset_4buffers +1] = pOrientation.y;
            orientation[offset_4buffers +2] = pOrientation.z;
            orientation[offset_4buffers +3] = pOrientation.w;

            colorMult[offset_4buffers] = pColorMult.x;
            colorMult[offset_4buffers + 1] = pColorMult.y;
            colorMult[offset_4buffers + 2] = pColorMult.z;
            colorMult[offset_4buffers + 3] = pColorMult.w;


            offset_position+=3;
            offset_start_time+=1;
            offset_4buffers+=4;

        }

    }



    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.startTime.needsUpdate = true;
    this.geometry.attributes.uvLifeTimeFrameStart.needsUpdate = true;
    this.geometry.attributes.velocityStartSize.needsUpdate = true;
    this.geometry.attributes.accelerationEndSize.needsUpdate = true;
    this.geometry.attributes.spinStartSpinSpeed.needsUpdate = true;
    this.geometry.attributes.orientation.needsUpdate = true;
    this.geometry.attributes.colorMult.needsUpdate = true;

    this.material.uniforms.worldVelocity.value = new THREE.Vector3(parameters.worldVelocity[0],parameters.worldVelocity[1], parameters.worldVelocity[2]);
    this.material.uniforms.worldAcceleration.value = new THREE.Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
    this.material.uniforms.timeRange.value = parameters.timeRange;
    this.material.uniforms.frameDuration.value = parameters.frameDuration;
    this.material.uniforms.numFrames.value = parameters.numFrames;
    this.material.uniforms.rampSampler.value = this.rampTexture_;
    this.material.uniforms.colorSampler.value = this.colorTexture_;

    this.material.blending = this.blendFunc_;


};*/
/*
ParticleEmitter.prototype.createParticles_ = function( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter) {

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

            var offset0 = Constants.LAST_IDX * jj +(ii*Constants.LAST_IDX*4)+(firstParticleIndex*Constants.LAST_IDX*4);
            var offset1 = offset0 + 1;
            var offset2 = offset0 + 2;
            var offset3 = offset0 + 3;

            interleaveBufferData[ Constants.POSITION_START_TIME_IDX + offset0 ] = pPosition.x;
            interleaveBufferData[ Constants.POSITION_START_TIME_IDX + offset1 ] = pPosition.y;
            interleaveBufferData[ Constants.POSITION_START_TIME_IDX + offset2 ] = pPosition.z;
            interleaveBufferData[ Constants.POSITION_START_TIME_IDX + offset3] = pStartTime;

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

    this.material.uniforms.worldVelocity.value = new THREE.Vector3(parameters.worldVelocity[0],parameters.worldVelocity[1], parameters.worldVelocity[2]);
    this.material.uniforms.worldAcceleration.value = new THREE.Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
    this.material.uniforms.timeRange.value = parameters.timeRange;
    this.material.uniforms.frameDuration.value = parameters.frameDuration;
    this.material.uniforms.numFrames.value = parameters.numFrames;
    this.material.uniforms.rampSampler.value = this.rampTexture_;
    this.material.uniforms.colorSampler.value = this.colorTexture_;

    this.material.blending = this.blendFunc_;


};*/

ParticleEmitter.prototype.createParticles_ = function( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter ) {

    var interleaveBufferData = this.interleavedBuffer.array;

    // Set the globals.
    this.billboard_ = parameters.billboard;

    var random = this.particleSystem.randomFunction_;

    var plusMinus = function (range) {

        return ( random() - 0.5 ) * range * 2;

    };

    // TODO: change to not allocate.
    var plusMinusVector = function (range) {

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
        var pStartTime = ( parameters.startTime === null ) ?
            ( ii * parameters.lifeTime / numParticles ) : parameters.startTime;
        var pFrameStart =
            parameters.frameStart + plusMinus(parameters.frameStartRange);

        var pPosition = new THREE.Vector3().addVectors(
            new THREE.Vector3().fromArray(parameters.position), new THREE.Vector3().fromArray(plusMinusVector(parameters.positionRange)));

        var pVelocity = new THREE.Vector3().addVectors(
            new THREE.Vector3().fromArray(parameters.velocity), new THREE.Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
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
        for (var jj = 0; jj < 1; ++jj) {

            var offset0 = LAST_IDX * jj + ( ii * LAST_IDX * 4 ) + ( firstParticleIndex * LAST_IDX * 4 );
            var offset1 = offset0 + 1;
            var offset2 = offset0 + 2;
            var offset3 = offset0 + 3;


            interleaveBufferData[POSITION_START_TIME_IDX + offset0] = pPosition.x;
            interleaveBufferData[POSITION_START_TIME_IDX + offset1] = pPosition.y;
            interleaveBufferData[POSITION_START_TIME_IDX + offset2] = pPosition.z;
            interleaveBufferData[POSITION_START_TIME_IDX + offset3] = pStartTime;

            interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset0] = CORNERS_[jj][0];
            interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset1] = CORNERS_[jj][1];
            interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset2] = pLifeTime;
            interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset3] = pFrameStart;

            interleaveBufferData[VELOCITY_START_SIZE_IDX + offset0] = pVelocity.x;
            interleaveBufferData[VELOCITY_START_SIZE_IDX + offset1] = pVelocity.y;
            interleaveBufferData[VELOCITY_START_SIZE_IDX + offset2] = pVelocity.z;
            interleaveBufferData[VELOCITY_START_SIZE_IDX + offset3] = pStartSize;

            interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset0] = pAcceleration.x;
            interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset1] = pAcceleration.y;
            interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset2] = pAcceleration.z;
            interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset3] = pEndSize;

            interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset0] = pSpinStart;
            interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset1] = pSpinSpeed;
            interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset2] = 0;
            interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset3] = 0;

            interleaveBufferData[ORIENTATION_IDX + offset0] = pOrientation.x;
            interleaveBufferData[ORIENTATION_IDX + offset1] = pOrientation.y;
            interleaveBufferData[ORIENTATION_IDX + offset2] = pOrientation.z;
            interleaveBufferData[ORIENTATION_IDX + offset3] = pOrientation.w;

            interleaveBufferData[COLOR_MULT_IDX + offset0] = pColorMult.x;
            interleaveBufferData[COLOR_MULT_IDX + offset1] = pColorMult.y;
            interleaveBufferData[COLOR_MULT_IDX + offset2] = pColorMult.z;
            interleaveBufferData[COLOR_MULT_IDX + offset3] = pColorMult.w;

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



/*ParticleEmitter.prototype.allocateParticles_ = function(numParticles,parameters) {

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

        var positions = new Float32Array(numParticles * 4 * 3);
        var startTime = new Float32Array(numParticles * 4 * 1);
        var uvLifeTimeFrameStart = new Float32Array(numParticles * 4 * 4);
        var velocityStartSize = new Float32Array(numParticles * 4 * 4);
        var accelerationEndSize = new Float32Array(numParticles * 4 * 4);
        var spinStartSpinSpeed = new Float32Array(numParticles * 4 * 4);
        var orientation = new Float32Array(numParticles * 4 * 4);
        var colorMult = new Float32Array(numParticles * 4 * 4);

        this.indexBuffer_=indices;
        this.numParticles_ = numParticles;


        this.particleBuffer_.setIndex(new THREE.BufferAttribute(this.indexBuffer_, 1));
        this.particleBuffer_.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleBuffer_.addAttribute('startTime', new THREE.BufferAttribute(startTime, 1));
        this.particleBuffer_.addAttribute('uvLifeTimeFrameStart', new THREE.BufferAttribute(uvLifeTimeFrameStart, 4));
        this.particleBuffer_.addAttribute('velocityStartSize', new THREE.BufferAttribute(velocityStartSize, 4));
        this.particleBuffer_.addAttribute('accelerationEndSize', new THREE.BufferAttribute(accelerationEndSize, 4));
        this.particleBuffer_.addAttribute('spinStartSpinSpeed', new THREE.BufferAttribute(spinStartSpinSpeed, 4));
        this.particleBuffer_.addAttribute('orientation', new THREE.BufferAttribute(orientation, 4));
        this.particleBuffer_.addAttribute('colorMult', new THREE.BufferAttribute(colorMult, 4));

        this.particleBuffer_.computeBoundingSphere();

        var attributes = {

            startTime: { type: 'f', value: null },
            uvLifeTimeFrameStart: { type: 'v4', value: null },
            velocityStartSize: { type: 'v4', value: null },
            accelerationEndSize: { type: 'v4', value: null },
            spinStartSpinSpeed: { type: 'v4', value: null },
            orientation: { type: 'v4', value: null },
            colorMult: { type: 'v4', value: null }

        };

        var uniforms = {

            //world:  { type: 'm4', value: this.mesh.matrixWorld },
            world:  { type: 'm4', value: this.matrixWorld },
            viewInverse:  { type: 'm4', value: this.particleSystem.camera.matrixWorld },
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
};*/
/*
ParticleEmitter.prototype.allocateParticles_ = function(numParticles,parameters) {

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

        this.interleavedBuffer=new THREE.InterleavedBuffer(new Float32Array(numParticles*Constants.singleParticleArray_.byteLength),Constants.LAST_IDX).setDynamic(true);

        this.particleBuffer_.setIndex(new THREE.BufferAttribute(this.indexBuffer_, 1));
        this.particleBuffer_.addAttribute('position', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 3, Constants.POSITION_START_TIME_IDX));
        this.particleBuffer_.addAttribute('startTime', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
        this.particleBuffer_.addAttribute('uvLifeTimeFrameStart', new THREE.InterleavedBufferAttribute(this.interleavedBuffer,4, Constants.UV_LIFE_TIME_FRAME_START_IDX));
        this.particleBuffer_.addAttribute('velocityStartSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,Constants.VELOCITY_START_SIZE_IDX ));
        this.particleBuffer_.addAttribute('accelerationEndSize', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,Constants.ACCELERATION_END_SIZE_IDX));
        this.particleBuffer_.addAttribute('spinStartSpinSpeed', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,Constants.SPIN_START_SPIN_SPEED_IDX));
        this.particleBuffer_.addAttribute('orientation', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,Constants.ORIENTATION_IDX));
        this.particleBuffer_.addAttribute('colorMult', new THREE.InterleavedBufferAttribute(this.interleavedBuffer, 4,Constants.COLOR_MULT_IDX));
        this.particleBuffer_.boundingSphere=new THREE.Sphere();
        var uniforms = {

            world:  { type: 'm4', value: this.matrixWorld },
            viewInverse:  { type: 'm4', value: camera.matrixWorld },
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
};
*/

ParticleEmitter.prototype.allocateParticles_ = function( numParticles,parameters ) {

    if ( this.numParticles_ != numParticles ) {

					var numIndices = 6 * numParticles;
					if ( numIndices > 65536 ) {

						throw "can't have more than 10922 particles per emitter";

					}

					var vertexBuffer = new THREE.InterleavedBuffer( new Float32Array( [
									// Front
									0, 0, 0, 0, - 0.5, - 0.5, 0, 0,
									0, 0, 0, 0, 0.5, - 0.5, 0, 0,
									0, 0, 0, 0, 0.5, 0.5, 0, 0,
									0, 0, 0, 0, - 0.5, 0.5, 0, 0
					] ), 8 );



					// Use vertexBuffer, starting at offset 0, 3 items in position attribute
					var positions = new THREE.InterleavedBufferAttribute( vertexBuffer, 3, 0 );
					this.particleBuffer_.addAttribute( 'position', positions );
					// Use vertexBuffer, starting at offset 4, 2 items in uv attribute
					var uvs = new THREE.InterleavedBufferAttribute( vertexBuffer, 2, 4 );
					this.particleBuffer_.addAttribute( 'uv', uvs );

					var indices = new Uint16Array( [
									0, 1, 2,
									0, 2, 3

					] );

					this.particleBuffer_.setIndex( new THREE.BufferAttribute( indices, 1 ) );


					this.numParticles_ = numParticles;
					this.interleavedBuffer = new THREE.InstancedInterleavedBuffer( new Float32Array(  numParticles * singleParticleArray_.byteLength ),LAST_IDX, 1 ).setDynamic( true );

					this.particleBuffer_.addAttribute( 'offset', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 3, POSITION_START_TIME_IDX ) );
					this.particleBuffer_.addAttribute( 'startTime', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 1, 3 ) );
					this.particleBuffer_.addAttribute( 'uvLifeTimeFrameStart', new THREE.InterleavedBufferAttribute( this.interleavedBuffer,4, UV_LIFE_TIME_FRAME_START_IDX ) );
					this.particleBuffer_.addAttribute( 'velocityStartSize', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 4,VELOCITY_START_SIZE_IDX ) );
					this.particleBuffer_.addAttribute( 'accelerationEndSize', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 4,ACCELERATION_END_SIZE_IDX ) );
					this.particleBuffer_.addAttribute( 'spinStartSpinSpeed', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 4,SPIN_START_SPIN_SPEED_IDX ) );
					this.particleBuffer_.addAttribute( 'orientation', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 4,ORIENTATION_IDX ) );
					this.particleBuffer_.addAttribute( 'colorMult', new THREE.InterleavedBufferAttribute( this.interleavedBuffer, 4,COLOR_MULT_IDX ) );
					this.particleBuffer_.boundingSphere = new THREE.Sphere();
					var uniforms = {

									world:  { type: 'm4', value: this.matrixWorld },
									viewInverse:  { type: 'm4', value: this.particleSystem.camera.matrixWorld },
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

					var material = new THREE.ShaderMaterial( {
									uniforms: uniforms,
									vertexShader: ( parameters.billboard ) ? billboardParticleInstancedVertexShader : orientedParticleInstancedVertexShader,
									fragmentShader: particleFragmentShader,
									side: THREE.DoubleSide,//(this.billboard_)? THREE.DoubleSide:THREE.FrontSide,
									blending: this.blendFunc_,
									depthTest:      true,
									depthWrite:      false,
									transparent:    true
								} );


					this.geometry = this.particleBuffer_;
					this.material = material;

    }

			};

ParticleEmitter.prototype.setParameters = function ( parameters, opt_perParticleParamSetter ) {

        this.validateParameters( parameters );

        var numParticles = parameters.numParticles;

        this.allocateParticles_( numParticles, parameters );
        this.createParticles_(
            0,
            numParticles,
            parameters,
            opt_perParticleParamSetter );

							}

ParticleEmitter.prototype.draw = function ( world, viewProjection, timeOffset ) {

					//var uniforms = this.mesh.material.uniforms;
					var uniforms = this.material.uniforms;
					if ( world !== undefined ) {

						uniforms.world.value = world;

					}


					var curTime = this.timeSource_();
					uniforms.time.value = curTime;
					uniforms.timeOffset.value = timeOffset;

    }

ParticleEmitter.prototype.createOneShot = function() {

        return new OneShot( this,this.particleSystem.scene );

							}

ParticleEmitter.prototype.clone = function  ( object ) {

					if ( object === undefined ) object = this.particleSystem.createParticleEmitter( this.colorTexture_, this.timeSource_ );//new ParticleEmitter(this.particleSystem,this.colorTexture_,this.timeSource_);
					object.geometry = this.geometry;
					object.material = this.material.clone();
					object.material.uniforms.world.value = this.matrixWorld;
					object.material.uniforms.viewInverse.value = this.particleSystem.camera.matrixWorld;
					object.material.uniforms.rampSampler.value = this.rampTexture_;
					object.material.uniforms.colorSampler.value = this.colorTexture_;
					THREE.Mesh.prototype.clone.call( this, object );
					return object;

    }

function Trail ( particleSystem, maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock ) {

	ParticleEmitter.call( this, particleSystem, opt_texture, opt_clock );

	this.allocateParticles_( maxParticles, parameters );
	this.validateParameters( parameters );

	this.parameters = parameters;
	this.perParticleParamSetter = opt_perParticleParamSetter;
	this.birthIndex_ = 0;
	this.maxParticles_ = maxParticles;

}

Trail.prototype = Object.create( ParticleEmitter.prototype );

Trail.prototype.constructor = Trail;

Trail.prototype.birthParticles = function ( position ) {

	var numParticles = this.parameters.numParticles;
	this.parameters.startTime = this.timeSource_();
	this.parameters.position = position;

	while ( this.birthIndex_ + numParticles >= this.maxParticles_ ) {

		var numParticlesToEnd = this.maxParticles_ - this.birthIndex_;

		this.createParticles_( this.birthIndex_, numParticlesToEnd,	this.parameters, this.perParticleParamSetter );
		numParticles -= numParticlesToEnd;

		this.birthIndex_ = 0;

	}

	this.createParticles_( this.birthIndex_, numParticles, this.parameters, this.perParticleParamSetter );

	if ( this.birthIndex_ === 0 ) {

		this.particleSystem.scene.add( this );

	}

	this.birthIndex_ += numParticles;


};

function ParticleSystem ( scene, camera, opt_clock, opt_randomFunction ) {

	this.scene = scene;
	this.camera = camera;

	this.drawables_ = [];

	var pixelBase = [ 0, 0.20, 0.70, 1, 0.70, 0.20, 0, 0 ];
	var pixels = [];

	for ( var yy = 0; yy < 8; ++ yy ) {

		for ( var xx = 0; xx < 8; ++ xx ) {

			var pixel = pixelBase[ xx ] * pixelBase[ yy ];
			pixels.push( pixel, pixel, pixel, pixel );

		}

	}

	var colorTexture = this.createTextureFromFloats( 8, 8, pixels );
	var rampTexture = this.createTextureFromFloats( 2, 1, [ 1, 1, 1, 1, 1, 1, 1, 0 ] );

	this.now_ = new Date();
	this.timeBase_ = new Date();

	if ( opt_clock ) {

		this.timeSource_ = opt_clock;

	} else {

		this.timeSource_ = createDefaultClock_( this );

	}

	this.randomFunction_ = opt_randomFunction || function () {

		return Math.random();

	};

	this.defaultColorTexture = colorTexture;
	this.defaultRampTexture = rampTexture;

};

ParticleSystem.prototype.createTextureFromFloats = function ( width, height, pixels, opt_texture ) {

	var texture = null;
	if ( opt_texture != null ) {

		texture = opt_texture;

	} else {

		var data = new Uint8Array( pixels.length );
		for ( var i = 0; i < pixels.length; i ++ ) {

			var t = pixels[ i ] * 255.;
			data[ i ] = t;

		}

		var texture = new THREE.DataTexture( data, width, height, THREE.RGBAFormat );
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;

		return texture;

	}

	return texture;

};

ParticleSystem.prototype.createParticleEmitter = function ( opt_texture, opt_clock ) {

	var emitter = new ParticleEmitter( this, opt_texture, opt_clock );
	this.drawables_.push( emitter );

	return emitter;

};

ParticleSystem.prototype.createTrail = function ( maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock ) {

	var trail = new Trail( this, maxParticles, parameters, opt_texture, opt_perParticleParamSetter,	opt_clock );
	this.drawables_.push( trail );

	return trail;

};

ParticleSystem.prototype.draw = function ( viewProjection, world, viewInverse ) {

	this.now_ = new Date();

	for ( var ii = 0; ii < this.drawables_.length; ++ ii ) {

		this.drawables_[ ii ].draw( world, viewProjection, 0 );

	}

};

exports.ParticleSpec = ParticleSpec;
exports.ParticleSystem = ParticleSystem;
exports.ParticleEmitter = ParticleEmitter;
exports.Trail = Trail;
exports.OneShot = OneShot;
exports.CORNERS_ = CORNERS_;
exports.createDefaultClock_ = createDefaultClock_;
exports.POSITION_START_TIME_IDX = POSITION_START_TIME_IDX;
exports.UV_LIFE_TIME_FRAME_START_IDX = UV_LIFE_TIME_FRAME_START_IDX;
exports.VELOCITY_START_SIZE_IDX = VELOCITY_START_SIZE_IDX;
exports.ACCELERATION_END_SIZE_IDX = ACCELERATION_END_SIZE_IDX;
exports.SPIN_START_SPIN_SPEED_IDX = SPIN_START_SPIN_SPEED_IDX;
exports.ORIENTATION_IDX = ORIENTATION_IDX;
exports.COLOR_MULT_IDX = COLOR_MULT_IDX;
exports.LAST_IDX = LAST_IDX;
exports.singleParticleArray_ = singleParticleArray_;

Object.defineProperty(exports, '__esModule', { value: true });

})));