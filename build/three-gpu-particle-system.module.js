import { Mesh, Matrix4, Vector3, InstancedBufferGeometry, InterleavedBuffer, NormalBlending, Vector4, BufferGeometry, InterleavedBufferAttribute, BufferAttribute, InstancedInterleavedBuffer, DynamicDrawUsage, ShaderMaterial, DoubleSide, FrontSide, DataTexture, RGBAFormat, LinearFilter } from 'three';

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

var CORNERS_ = [

	[ - 0.5, - 0.5 ],
	[ + 0.5, - 0.5 ],
	[ + 0.5, + 0.5 ],
	[ - 0.5, + 0.5 ]

];

function createDefaultClock_ ( particleSystem ) {

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

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

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

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class OneShot extends Mesh {
	constructor(emitter, scene) {
		super();
		this.emitter_ = emitter.clone();
		this.scene = scene;

		this.world_ = new Matrix4();
		this.tempWorld_ = new Matrix4();
		this.timeOffset_ = 0;
		this.visible_ = false;

		// Remove the parent emitter from the particle system's drawable
		// list (if it's still there) and add ourselves instead.
		var particleSystem = emitter.particleSystem;
		var idx = particleSystem.drawables_.indexOf(this.emitter_);
		if (idx >= 0) {

			particleSystem.drawables_.splice(idx, 1);

		}

		particleSystem.drawables_.push(this);
	}

	trigger ( opt_world ) {

		if ( ! this.visible_ ) {

			this.scene.add( this.emitter_ );

		}
		if ( opt_world ) {

			this.emitter_.position.copy( new Vector3().fromArray( opt_world ) );

		}
		this.visible_ = true;
		this.timeOffset_ = this.emitter_.timeSource_();

	}

	draw ( world, viewProjection, timeOffset ) {

		if ( this.visible_ ) {

			//this.tempWorld_.multiplyMatrices(this.world_, world);
			this.emitter_.draw( this.world_, viewProjection, this.timeOffset_ );

		}

	}

}

var billboardParticleInstancedVertexShader = "\nuniform mat4 viewInverse;\nuniform vec3 worldVelocity;\nuniform vec3 worldAcceleration;\nuniform float timeRange;\nuniform float time;\nuniform float timeOffset;\nuniform float frameDuration;\nuniform float numFrames;\nattribute vec4 uvLifeTimeFrameStart;\nattribute float startTime;\nattribute vec4 velocityStartSize;\nattribute vec4 accelerationEndSize;\nattribute vec4 spinStartSpinSpeed;\nattribute vec4 colorMult;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\n    float lifeTime = uvLifeTimeFrameStart.z;\n    float frameStart = uvLifeTimeFrameStart.w;\n    vec3 velocity = (modelMatrix * vec4(velocityStartSize.xyz,\n                                 0.)).xyz + worldVelocity;\n    float startSize = velocityStartSize.w;\n    vec3 acceleration = (modelMatrix * vec4(accelerationEndSize.xyz,\n                                     0)).xyz + worldAcceleration;\n    float endSize = accelerationEndSize.w;\n    float spinStart = spinStartSpinSpeed.x;\n    float spinSpeed = spinStartSpinSpeed.y;\n    float localTime = mod((time - timeOffset - startTime), timeRange);\n    float percentLife = localTime / lifeTime;\n    float frame = mod(floor(localTime / frameDuration + frameStart),\n                     numFrames);\n    float uOffset = frame / numFrames;\n    float u = uOffset + (uv.x + 0.5) * (1. / numFrames);\n    outputTexcoord = vec2(u, uv.y + 0.5);\n    outputColorMult = colorMult;\n    vec3 basisX = viewInverse[0].xyz;\n    vec3 basisZ = viewInverse[1].xyz;\n    vec4 vertexWorld = modelMatrix * vec4(position, 1.0);\n    float size = mix(startSize, endSize, percentLife);\n    size = (percentLife < 0. || percentLife > 1.) ? 0. : size;\n    float s = sin(spinStart + spinSpeed * localTime);\n    float c = cos(spinStart + spinSpeed * localTime);\n    vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, -uv.x * s + uv.y * c);\n    vec3 localPosition = vec3(basisX * rotatedPoint.x + basisZ * rotatedPoint.y) * size +\n                        velocity * localTime +\n                        acceleration * localTime * localTime +\n                        vertexWorld.xyz;\n    outputPercentLife = percentLife;\n    gl_Position = projectionMatrix * viewMatrix * vec4(localPosition, 1.);\n}";

var orientedParticleInstancedVertexShader = "\nuniform mat4 worldViewProjection;\nuniform mat4 world;\nuniform vec3 worldVelocity;\nuniform vec3 worldAcceleration;\nuniform float timeRange;\nuniform float time;\nuniform float timeOffset;\nuniform float frameDuration;\nuniform float numFrames;\nattribute vec3 offset;\nattribute vec4 uvLifeTimeFrameStart;attribute float startTime;attribute vec4 velocityStartSize;attribute vec4 accelerationEndSize;attribute vec4 spinStartSpinSpeed;attribute vec4 orientation;attribute vec4 colorMult;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\nfloat lifeTime = uvLifeTimeFrameStart.z;\nfloat frameStart = uvLifeTimeFrameStart.w;\nvec3 velocity = (world * vec4(velocityStartSize.xyz,\n                              0.)).xyz + worldVelocity;\nfloat startSize = velocityStartSize.w;\nvec3 acceleration = (world * vec4(accelerationEndSize.xyz,\n                                  0)).xyz + worldAcceleration;\nfloat endSize = accelerationEndSize.w;\nfloat spinStart = spinStartSpinSpeed.x;\nfloat spinSpeed = spinStartSpinSpeed.y;\nfloat localTime = mod((time - timeOffset - startTime), timeRange);\nfloat percentLife = localTime / lifeTime;\nfloat frame = mod(floor(localTime / frameDuration + frameStart),\n                  numFrames);\nfloat uOffset = frame / numFrames;\nfloat u = uOffset + (uv.x + 0.5) * (1. / numFrames);\noutputTexcoord = vec2(u, uv.y + 0.5);\noutputColorMult = colorMult;\nfloat size = mix(startSize, endSize, percentLife);\nsize = (percentLife < 0. || percentLife > 1.) ? 0. : size;\nfloat s = sin(spinStart + spinSpeed * localTime);\nfloat c = cos(spinStart + spinSpeed * localTime);\nvec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.,\n                         (uv.x * s - uv.y * c) * size, 1.);\nvec3 center = velocity * localTime +\n              acceleration * localTime * localTime +\n              position +offset;\nvec4 q2 = orientation + orientation;\nvec4 qx = orientation.xxxw * q2.xyzx;\nvec4 qy = orientation.xyyw * q2.xyzy;\nvec4 qz = orientation.xxzw * q2.xxzz;\nmat4 localMatrix = mat4(\n    (1.0 - qy.y) - qz.z,\n    qx.y + qz.w,\n    qx.z - qy.w,\n    0,\n    qx.y - qz.w,\n    (1.0 - qx.x) - qz.z,\n    qy.z + qx.w,\n    0,\n    qx.z + qy.w,\n    qy.z - qx.w,\n    (1.0 - qx.x) - qy.y,\n    0,\n    center.x, center.y, center.z, 1);\nrotatedPoint = localMatrix * rotatedPoint;\noutputPercentLife = percentLife;\ngl_Position = projectionMatrix * modelViewMatrix * rotatedPoint;\n}";

var particleFragmentShader = "\n#ifdef GL_ES\nprecision mediump float;\n#endif\nuniform sampler2D rampSampler;\nuniform sampler2D colorSampler;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\n    vec4 colorMult = texture2D(rampSampler, vec2(outputPercentLife, 0.5)) * outputColorMult;\n    gl_FragColor = texture2D(colorSampler, outputTexcoord) * colorMult;\n}";

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class ParticleEmitter extends Mesh {
	constructor( particleSystem, opt_texture, opt_clock ) {
		super();

		opt_clock = opt_clock || particleSystem.timeSource_;

		//TODO make alternative to instanced buffer
		//this.particleBuffer_ = new THREE.BufferGeometry();
		//this.indexBuffer_ = [];

		this.particleBuffer_ = new InstancedBufferGeometry();
		this.interleavedBuffer = new InterleavedBuffer();

		this.numParticles_ = 0;

		this.rampTexture_ = particleSystem.defaultRampTexture;
		this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;

		this.particleSystem = particleSystem;

		this.timeSource_ = opt_clock;

		this.setState(NormalBlending);
	}

	setTranslation ( x, y, z ) {

		this.position.x = x;
		this.position.y = y;
		this.position.z = z;

	}

	setState ( stateId ) {

		this.blendFunc_ = stateId;

	}

	setColorRamp ( colorRamp ) {

		var width = colorRamp.length / 4;
		if (width % 1 != 0) {

			throw 'colorRamp must have multiple of 4 entries';

		}

		if (this.rampTexture_ == this.particleSystem.defaultRampTexture) {

			this.rampTexture_ = null;

		}

		this.rampTexture_ = this.particleSystem.createTextureFromFloats( width, 1, colorRamp, this.rampTexture_ );

	}

	validateParameters ( parameters ) {

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

	createParticles_ ( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter ) {

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
			var pPosition = new Vector3().addVectors( new Vector3().fromArray(parameters.position), new Vector3().fromArray(plusMinusVector(parameters.positionRange)));
			var pVelocity = new Vector3().addVectors( new Vector3().fromArray(parameters.velocity), new Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
			var pAcceleration = new Vector3().addVectors( new Vector3().fromArray(parameters.acceleration), new Vector3().fromArray( plusMinusVector( parameters.accelerationRange )));
			var pColorMult = new Vector4().addVectors( new Vector4().fromArray(parameters.colorMult), new Vector4().fromArray(plusMinusVector( parameters.colorMultRange )));
			var pSpinStart = parameters.spinStart + plusMinus(parameters.spinStartRange);
			var pSpinSpeed = parameters.spinSpeed + plusMinus(parameters.spinSpeedRange);
			var pStartSize = parameters.startSize + plusMinus(parameters.startSizeRange);
			var pEndSize = parameters.endSize + plusMinus(parameters.endSizeRange);
			var pOrientation = new Vector4().fromArray(parameters.orientation);

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

		this.material.uniforms.worldVelocity.value = new Vector3(parameters.worldVelocity[0], parameters.worldVelocity[1], parameters.worldVelocity[2]);
		this.material.uniforms.worldAcceleration.value = new Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
		this.material.uniforms.timeRange.value = parameters.timeRange;
		this.material.uniforms.frameDuration.value = parameters.frameDuration;
		this.material.uniforms.numFrames.value = parameters.numFrames;
		this.material.uniforms.rampSampler.value = this.rampTexture_;
		this.material.uniforms.colorSampler.value = this.colorTexture_;

		this.material.blending = this.blendFunc_;

	}

	allocateParticles_ ( numParticles, parameters ) {

		if ( this.numParticles_ != numParticles ) {

			var numIndices = 6 * numParticles;

			if (numIndices > 65536 && BufferGeometry.MaxIndex < 65536) {

				throw "can't have more than 10922 particles per emitter";

			}

			var vertexBuffer = new InterleavedBuffer( new Float32Array([
				// Front
				0, 0, 0, 0, -0.5, -0.5, 0, 0,
				0, 0, 0, 0, 0.5, -0.5, 0, 0,
				0, 0, 0, 0, 0.5, 0.5, 0, 0,
				0, 0, 0, 0, -0.5, 0.5, 0, 0
			]), 8);


			// Use vertexBuffer, starting at offset 0, 3 items in position attribute
			var positions = new InterleavedBufferAttribute( vertexBuffer, 3, 0 );
			this.particleBuffer_.setAttribute( 'position', positions );
			// Use vertexBuffer, starting at offset 4, 2 items in uv attribute
			var uvs = new InterleavedBufferAttribute( vertexBuffer, 2, 4 );
			this.particleBuffer_.setAttribute( 'uv', uvs );

			var indices = new Uint16Array([

				0, 1, 2,
				0, 2, 3

			]);

			this.particleBuffer_.setIndex( new BufferAttribute( indices, 1 ) );

			this.numParticles_ = numParticles;
			this.interleavedBuffer = new InstancedInterleavedBuffer( new Float32Array( numParticles * singleParticleArray_.byteLength ), LAST_IDX, 1 ).setUsage( DynamicDrawUsage );

			this.particleBuffer_.setAttribute( 'position', new InterleavedBufferAttribute(this.interleavedBuffer, 3, POSITION_START_TIME_IDX));
			this.particleBuffer_.setAttribute( 'startTime', new InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
			this.particleBuffer_.setAttribute( 'uvLifeTimeFrameStart', new InterleavedBufferAttribute(this.interleavedBuffer, 4, UV_LIFE_TIME_FRAME_START_IDX));
			this.particleBuffer_.setAttribute( 'velocityStartSize', new InterleavedBufferAttribute(this.interleavedBuffer, 4, VELOCITY_START_SIZE_IDX));
			this.particleBuffer_.setAttribute( 'accelerationEndSize', new InterleavedBufferAttribute(this.interleavedBuffer, 4, ACCELERATION_END_SIZE_IDX));
			this.particleBuffer_.setAttribute( 'spinStartSpinSpeed', new InterleavedBufferAttribute(this.interleavedBuffer, 4, SPIN_START_SPIN_SPEED_IDX));
			this.particleBuffer_.setAttribute( 'orientation', new InterleavedBufferAttribute(this.interleavedBuffer, 4, ORIENTATION_IDX));
			this.particleBuffer_.setAttribute( 'colorMult', new InterleavedBufferAttribute(this.interleavedBuffer, 4, COLOR_MULT_IDX));

			this.particleBuffer_.computeBoundingSphere();

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

			var material = new ShaderMaterial({

				uniforms: uniforms,
				vertexShader: ( parameters.billboard ) ? billboardParticleInstancedVertexShader : orientedParticleInstancedVertexShader,
				fragmentShader: particleFragmentShader,
				side: (this.billboard_)? DoubleSide : FrontSide,
				blending: this.blendFunc_,
				depthTest: true,
				depthWrite: false,
				transparent: true

			});


			this.geometry = this.particleBuffer_;
			this.material = material;

		}

	}

	setParameters ( parameters, opt_perParticleParamSetter ) {

		this.validateParameters ( parameters );

		var numParticles = parameters.numParticles;

		this.allocateParticles_ ( numParticles, parameters );
		this.createParticles_ ( 0, numParticles, parameters, opt_perParticleParamSetter );

	}

	draw ( world, viewProjection, timeOffset ) {

		var uniforms = this.material.uniforms;

		uniforms.time.value = this.timeSource_();
		uniforms.timeOffset.value = timeOffset;

	}

	createOneShot () {

		return new OneShot( this, this.particleSystem.scene );

	}

	clone ( object ) {

		if ( object === undefined ) object = this.particleSystem.createParticleEmitter( this.colorTexture_, this.timeSource_);

		object.geometry = this.geometry;
		object.material = this.material.clone();
		object.material.uniforms.viewInverse.value = this.particleSystem.camera.matrixWorld;
		object.material.uniforms.rampSampler.value = this.rampTexture_;
		object.material.uniforms.colorSampler.value = this.colorTexture_;

		super.copy( object );

		return object;

	}

}

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class Trail extends ParticleEmitter {
	constructor( particleSystem, maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock )	{
		super(particleSystem, opt_texture, opt_clock);

		this.allocateParticles_(maxParticles, parameters);
		this.validateParameters(parameters);

		this.parameters = parameters;
		this.perParticleParamSetter = opt_perParticleParamSetter;
		this.birthIndex_ = 0;
		this.maxParticles_ = maxParticles;
	}

	birthParticles ( position ) {

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


	}

}

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class ParticleSystem  {
	constructor( scene, camera, opt_clock, opt_randomFunction ) {
		this.scene = scene;
		this.camera = camera;

		this.drawables_ = [];

		var pixelBase = [0, 0.20, 0.70, 1, 0.70, 0.20, 0, 0];
		var pixels = [];

		for (var yy = 0; yy < 8; ++yy) {

			for (var xx = 0; xx < 8; ++xx) {

				var pixel = pixelBase[xx] * pixelBase[yy];
				pixels.push(pixel, pixel, pixel, pixel);

			}

		}

		var colorTexture = this.createTextureFromFloats(8, 8, pixels);
		var rampTexture = this.createTextureFromFloats(2, 1, [1, 1, 1, 1, 1, 1, 1, 0]);

		this.now_ = new Date();
		this.timeBase_ = new Date();

		if (opt_clock) {

			this.timeSource_ = opt_clock;

		} else {

			this.timeSource_ = createDefaultClock_(this);

		}

		this.randomFunction_ = opt_randomFunction || function () {

			return Math.random();

		};

		this.defaultColorTexture = colorTexture;
		this.defaultRampTexture = rampTexture;
	}

	createTextureFromFloats ( width, height, pixels, opt_texture ) {

		var texture = null;
		if ( opt_texture != null ) {

			texture = opt_texture;

		} else {

			var data = new Uint8Array( pixels.length );
			var t;
			for ( var i = 0; i < pixels.length; i ++ ) {

				t = pixels[ i ] * 255.;
				data[ i ] = t;

			}

			texture = new DataTexture( data, width, height, RGBAFormat );
			texture.minFilter = LinearFilter;
			texture.magFilter = LinearFilter;
			texture.needsUpdate = true;

			return texture;

		}

		return texture;

	}

	createParticleEmitter ( opt_texture, opt_clock ) {
		var emitter = new ParticleEmitter( this, opt_texture, opt_clock );
		this.drawables_.push( emitter );

		return emitter;

	}

	createTrail ( maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock ) {

		var trail = new Trail( this, maxParticles, parameters, opt_texture, opt_perParticleParamSetter,	opt_clock );
		this.drawables_.push( trail );

		return trail;

	}

	draw ( viewProjection, world, viewInverse ) {

		this.now_ = new Date();

		for ( var ii = 0; ii < this.drawables_.length; ++ ii ) {

			this.drawables_[ ii ].draw( world, viewProjection, 0 );

		}

	}

}

export { ACCELERATION_END_SIZE_IDX, COLOR_MULT_IDX, CORNERS_, LAST_IDX, ORIENTATION_IDX, OneShot, POSITION_START_TIME_IDX, ParticleEmitter, ParticleSpec, ParticleSystem, SPIN_START_SPIN_SPEED_IDX, Trail, UV_LIFE_TIME_FRAME_START_IDX, VELOCITY_START_SIZE_IDX, createDefaultClock_, singleParticleArray_ };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtZ3B1LXBhcnRpY2xlLXN5c3RlbS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9jb25zdGFudHMuanMiLCIuLi9zcmMvanMvcGFydGljbGUtc3BlYy5qcyIsIi4uL3NyYy9qcy9vbmUtc2hvdC5qcyIsIi4uL3NyYy9qcy9lbWl0dGVyLmpzIiwiLi4vc3JjL2pzL3RyYWlsLmpzIiwiLi4vc3JjL2pzL3BhcnRpY2xlLXN5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi90ZGwvYmxvYi9tYXN0ZXIvdGRsL3BhcnRpY2xlcy5qc1xuLy8gcG9ydGVkIHRvIHRocmVlLmpzIGJ5IGZhemVhY3Rpb25cblxuZXhwb3J0IHZhciBDT1JORVJTXyA9IFtcblxuXHRbIC0gMC41LCAtIDAuNSBdLFxuXHRbICsgMC41LCAtIDAuNSBdLFxuXHRbICsgMC41LCArIDAuNSBdLFxuXHRbIC0gMC41LCArIDAuNSBdXG5cbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWZhdWx0Q2xvY2tfICggcGFydGljbGVTeXN0ZW0gKSB7XG5cblx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcblxuXHRcdHZhciBub3cgPSBwYXJ0aWNsZVN5c3RlbS5ub3dfO1xuXHRcdHZhciBiYXNlID0gcGFydGljbGVTeXN0ZW0udGltZUJhc2VfO1xuXG5cdFx0cmV0dXJuICggbm93LmdldFRpbWUoKSAtIGJhc2UuZ2V0VGltZSgpICkgLyAxMDAwLjA7XG5cblx0fVxuXG59XG5cbmV4cG9ydCB2YXIgUE9TSVRJT05fU1RBUlRfVElNRV9JRFggPSAwO1xuZXhwb3J0IHZhciBVVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYID0gNDtcbmV4cG9ydCB2YXIgVkVMT0NJVFlfU1RBUlRfU0laRV9JRFggPSA4O1xuZXhwb3J0IHZhciBBQ0NFTEVSQVRJT05fRU5EX1NJWkVfSURYID0gMTI7XG5leHBvcnQgdmFyIFNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFggPSAxNjtcbmV4cG9ydCB2YXIgT1JJRU5UQVRJT05fSURYID0gMjA7XG5leHBvcnQgdmFyIENPTE9SX01VTFRfSURYID0gMjQ7XG5leHBvcnQgdmFyIExBU1RfSURYID0gMjg7XG5leHBvcnQgdmFyIHNpbmdsZVBhcnRpY2xlQXJyYXlfID0gbmV3IEZsb2F0MzJBcnJheSggNCAqIExBU1RfSURYICk7IiwiLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vZ3JlZ2dtYW4vdGRsL2Jsb2IvbWFzdGVyL3RkbC9wYXJ0aWNsZXMuanNcbi8vIHBvcnRlZCB0byB0aHJlZS5qcyBieSBmYXplYWN0aW9uXG5cbmZ1bmN0aW9uIFBhcnRpY2xlU3BlYyAoKSB7XG5cblx0dGhpcy5udW1QYXJ0aWNsZXMgPSAxO1xuXG5cdHRoaXMubnVtRnJhbWVzID0gMTtcblxuXHR0aGlzLmZyYW1lRHVyYXRpb24gPSAxO1xuXG5cdHRoaXMuZnJhbWVTdGFydCA9IDA7XG5cblx0dGhpcy5mcmFtZVN0YXJ0UmFuZ2UgPSAwO1xuXG5cdHRoaXMudGltZVJhbmdlID0gOTk5OTk5OTk7XG5cblx0dGhpcy5zdGFydFRpbWUgPSBudWxsO1xuXG5cdHRoaXMubGlmZVRpbWUgPSAxO1xuXG5cdHRoaXMubGlmZVRpbWVSYW5nZSA9IDA7XG5cblx0dGhpcy5zdGFydFNpemUgPSAxO1xuXG5cdHRoaXMuc3RhcnRTaXplUmFuZ2UgPSAwO1xuXG5cdHRoaXMuZW5kU2l6ZSA9IDE7XG5cblx0dGhpcy5lbmRTaXplUmFuZ2UgPSAwO1xuXG5cdHRoaXMucG9zaXRpb24gPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLnBvc2l0aW9uUmFuZ2UgPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLnZlbG9jaXR5ID0gWyAwLCAwLCAwIF07XG5cblx0dGhpcy52ZWxvY2l0eVJhbmdlID0gWyAwLCAwLCAwIF07XG5cblx0dGhpcy5hY2NlbGVyYXRpb24gPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLmFjY2VsZXJhdGlvblJhbmdlID0gWyAwLCAwLCAwIF07XG5cblx0dGhpcy5zcGluU3RhcnQgPSAwO1xuXG5cdHRoaXMuc3BpblN0YXJ0UmFuZ2UgPSAwO1xuXG5cdHRoaXMuc3BpblNwZWVkID0gMDtcblxuXHR0aGlzLnNwaW5TcGVlZFJhbmdlID0gMDtcblxuXHR0aGlzLmNvbG9yTXVsdCA9IFsgMSwgMSwgMSwgMSBdO1xuXG5cdHRoaXMuY29sb3JNdWx0UmFuZ2UgPSBbIDAsIDAsIDAsIDAgXTtcblxuXHR0aGlzLndvcmxkVmVsb2NpdHkgPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLndvcmxkQWNjZWxlcmF0aW9uID0gWyAwLCAwLCAwIF07XG5cblx0dGhpcy5iaWxsYm9hcmQgPSB0cnVlO1xuXG5cdHRoaXMub3JpZW50YXRpb24gPSBbIDAsIDAsIDAsIDEgXTtcblxufVxuXG5leHBvcnQge1BhcnRpY2xlU3BlY30iLCIvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi90ZGwvYmxvYi9tYXN0ZXIvdGRsL3BhcnRpY2xlcy5qc1xuLy8gcG9ydGVkIHRvIHRocmVlLmpzIGJ5IGZhemVhY3Rpb25cbmltcG9ydCB7XG5cdE1lc2gsXG5cdE1hdHJpeDQsXG5cdFZlY3RvcjNcbn0gZnJvbSAndGhyZWUnXG5cbmNsYXNzIE9uZVNob3QgZXh0ZW5kcyBNZXNoIHtcblx0Y29uc3RydWN0b3IoZW1pdHRlciwgc2NlbmUpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZW1pdHRlcl8gPSBlbWl0dGVyLmNsb25lKCk7XG5cdFx0dGhpcy5zY2VuZSA9IHNjZW5lO1xuXG5cdFx0dGhpcy53b3JsZF8gPSBuZXcgTWF0cml4NCgpO1xuXHRcdHRoaXMudGVtcFdvcmxkXyA9IG5ldyBNYXRyaXg0KCk7XG5cdFx0dGhpcy50aW1lT2Zmc2V0XyA9IDA7XG5cdFx0dGhpcy52aXNpYmxlXyA9IGZhbHNlO1xuXG5cdFx0Ly8gUmVtb3ZlIHRoZSBwYXJlbnQgZW1pdHRlciBmcm9tIHRoZSBwYXJ0aWNsZSBzeXN0ZW0ncyBkcmF3YWJsZVxuXHRcdC8vIGxpc3QgKGlmIGl0J3Mgc3RpbGwgdGhlcmUpIGFuZCBhZGQgb3Vyc2VsdmVzIGluc3RlYWQuXG5cdFx0dmFyIHBhcnRpY2xlU3lzdGVtID0gZW1pdHRlci5wYXJ0aWNsZVN5c3RlbTtcblx0XHR2YXIgaWR4ID0gcGFydGljbGVTeXN0ZW0uZHJhd2FibGVzXy5pbmRleE9mKHRoaXMuZW1pdHRlcl8pO1xuXHRcdGlmIChpZHggPj0gMCkge1xuXG5cdFx0XHRwYXJ0aWNsZVN5c3RlbS5kcmF3YWJsZXNfLnNwbGljZShpZHgsIDEpO1xuXG5cdFx0fVxuXG5cdFx0cGFydGljbGVTeXN0ZW0uZHJhd2FibGVzXy5wdXNoKHRoaXMpO1xuXHR9XG5cblx0dHJpZ2dlciAoIG9wdF93b3JsZCApIHtcblxuXHRcdGlmICggISB0aGlzLnZpc2libGVfICkge1xuXG5cdFx0XHR0aGlzLnNjZW5lLmFkZCggdGhpcy5lbWl0dGVyXyApO1xuXG5cdFx0fVxuXHRcdGlmICggb3B0X3dvcmxkICkge1xuXG5cdFx0XHR0aGlzLmVtaXR0ZXJfLnBvc2l0aW9uLmNvcHkoIG5ldyBWZWN0b3IzKCkuZnJvbUFycmF5KCBvcHRfd29ybGQgKSApO1xuXG5cdFx0fVxuXHRcdHRoaXMudmlzaWJsZV8gPSB0cnVlO1xuXHRcdHRoaXMudGltZU9mZnNldF8gPSB0aGlzLmVtaXR0ZXJfLnRpbWVTb3VyY2VfKCk7XG5cblx0fVxuXG5cdGRyYXcgKCB3b3JsZCwgdmlld1Byb2plY3Rpb24sIHRpbWVPZmZzZXQgKSB7XG5cblx0XHRpZiAoIHRoaXMudmlzaWJsZV8gKSB7XG5cblx0XHRcdC8vdGhpcy50ZW1wV29ybGRfLm11bHRpcGx5TWF0cmljZXModGhpcy53b3JsZF8sIHdvcmxkKTtcblx0XHRcdHRoaXMuZW1pdHRlcl8uZHJhdyggdGhpcy53b3JsZF8sIHZpZXdQcm9qZWN0aW9uLCB0aGlzLnRpbWVPZmZzZXRfICk7XG5cblx0XHR9XG5cblx0fVxuXG59XG5cbmV4cG9ydCB7T25lU2hvdH1cbiIsIi8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL2dyZWdnbWFuL3RkbC9ibG9iL21hc3Rlci90ZGwvcGFydGljbGVzLmpzXG4vLyBwb3J0ZWQgdG8gdGhyZWUuanMgYnkgZmF6ZWFjdGlvblxuaW1wb3J0IHtcblx0TWVzaCxcblx0QnVmZmVyQXR0cmlidXRlLFxuXHRCdWZmZXJHZW9tZXRyeSxcblx0SW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUsXG5cdEluc3RhbmNlZEludGVybGVhdmVkQnVmZmVyLFxuXHRJbnN0YW5jZWRCdWZmZXJHZW9tZXRyeSxcblx0SW50ZXJsZWF2ZWRCdWZmZXIsXG5cdE5vcm1hbEJsZW5kaW5nLFxuXHRWZWN0b3IzLFxuXHRWZWN0b3I0LFxuXHRTcGhlcmUsXG5cdFNoYWRlck1hdGVyaWFsLFxuXHREb3VibGVTaWRlLFxuXHRGcm9udFNpZGUsXG5cdER5bmFtaWNEcmF3VXNhZ2Vcbn0gZnJvbSAndGhyZWUnXG5cbmltcG9ydCAqIGFzIENvbnN0YW50cyAgZnJvbSAnLi9jb25zdGFudHMuanMnXG5pbXBvcnQge1BhcnRpY2xlU3BlY30gZnJvbSAnLi9wYXJ0aWNsZS1zcGVjLmpzJ1xuaW1wb3J0IHtPbmVTaG90fSBmcm9tICcuL29uZS1zaG90LmpzJ1xuaW1wb3J0IGJpbGxib2FyZFBhcnRpY2xlSW5zdGFuY2VkVmVydGV4U2hhZGVyIGZyb20gJy4vLi4vc2hhZGVycy9wYXJ0aWNsZXMtYmlsbGJvYXJkLWluc3RhbmNlZF92cy5nbHNsJ1xuaW1wb3J0IG9yaWVudGVkUGFydGljbGVJbnN0YW5jZWRWZXJ0ZXhTaGFkZXIgZnJvbSAnLi8uLi9zaGFkZXJzL3BhcnRpY2xlcy1vcmllbnRlZC1pbnN0YW5jZWRfdnMuZ2xzbCdcbmltcG9ydCBwYXJ0aWNsZUZyYWdtZW50U2hhZGVyIGZyb20gJy4vLi4vc2hhZGVycy9wYXJ0aWNsZXNfZnMuZ2xzbCdcblxuY2xhc3MgUGFydGljbGVFbWl0dGVyIGV4dGVuZHMgTWVzaCB7XG5cdGNvbnN0cnVjdG9yKCBwYXJ0aWNsZVN5c3RlbSwgb3B0X3RleHR1cmUsIG9wdF9jbG9jayApIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0b3B0X2Nsb2NrID0gb3B0X2Nsb2NrIHx8IHBhcnRpY2xlU3lzdGVtLnRpbWVTb3VyY2VfO1xuXG5cdFx0Ly9UT0RPIG1ha2UgYWx0ZXJuYXRpdmUgdG8gaW5zdGFuY2VkIGJ1ZmZlclxuXHRcdC8vdGhpcy5wYXJ0aWNsZUJ1ZmZlcl8gPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHQvL3RoaXMuaW5kZXhCdWZmZXJfID0gW107XG5cblx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXyA9IG5ldyBJbnN0YW5jZWRCdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIgPSBuZXcgSW50ZXJsZWF2ZWRCdWZmZXIoKTtcblxuXHRcdHRoaXMubnVtUGFydGljbGVzXyA9IDA7XG5cblx0XHR0aGlzLnJhbXBUZXh0dXJlXyA9IHBhcnRpY2xlU3lzdGVtLmRlZmF1bHRSYW1wVGV4dHVyZTtcblx0XHR0aGlzLmNvbG9yVGV4dHVyZV8gPSBvcHRfdGV4dHVyZSB8fCBwYXJ0aWNsZVN5c3RlbS5kZWZhdWx0Q29sb3JUZXh0dXJlO1xuXG5cdFx0dGhpcy5wYXJ0aWNsZVN5c3RlbSA9IHBhcnRpY2xlU3lzdGVtO1xuXG5cdFx0dGhpcy50aW1lU291cmNlXyA9IG9wdF9jbG9jaztcblxuXHRcdHRoaXMuc2V0U3RhdGUoTm9ybWFsQmxlbmRpbmcpO1xuXHR9XG5cblx0c2V0VHJhbnNsYXRpb24gKCB4LCB5LCB6ICkge1xuXG5cdFx0dGhpcy5wb3NpdGlvbi54ID0geDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgPSB5O1xuXHRcdHRoaXMucG9zaXRpb24ueiA9IHo7XG5cblx0fVxuXG5cdHNldFN0YXRlICggc3RhdGVJZCApIHtcblxuXHRcdHRoaXMuYmxlbmRGdW5jXyA9IHN0YXRlSWQ7XG5cblx0fVxuXG5cdHNldENvbG9yUmFtcCAoIGNvbG9yUmFtcCApIHtcblxuXHRcdHZhciB3aWR0aCA9IGNvbG9yUmFtcC5sZW5ndGggLyA0O1xuXHRcdGlmICh3aWR0aCAlIDEgIT0gMCkge1xuXG5cdFx0XHR0aHJvdyAnY29sb3JSYW1wIG11c3QgaGF2ZSBtdWx0aXBsZSBvZiA0IGVudHJpZXMnO1xuXG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucmFtcFRleHR1cmVfID09IHRoaXMucGFydGljbGVTeXN0ZW0uZGVmYXVsdFJhbXBUZXh0dXJlKSB7XG5cblx0XHRcdHRoaXMucmFtcFRleHR1cmVfID0gbnVsbDtcblxuXHRcdH1cblxuXHRcdHRoaXMucmFtcFRleHR1cmVfID0gdGhpcy5wYXJ0aWNsZVN5c3RlbS5jcmVhdGVUZXh0dXJlRnJvbUZsb2F0cyggd2lkdGgsIDEsIGNvbG9yUmFtcCwgdGhpcy5yYW1wVGV4dHVyZV8gKTtcblxuXHR9XG5cblx0dmFsaWRhdGVQYXJhbWV0ZXJzICggcGFyYW1ldGVycyApIHtcblxuXHRcdHZhciBkZWZhdWx0cyA9IG5ldyBQYXJ0aWNsZVNwZWMoKTtcblxuXHRcdGZvciAoIHZhciBrZXkgaW4gcGFyYW1ldGVycyApIHtcblxuXHRcdFx0aWYgKCB0eXBlb2YgZGVmYXVsdHNbIGtleSBdID09PSAndW5kZWZpbmVkJyApIHtcblxuXHRcdFx0XHR0aHJvdyAndW5rbm93biBwYXJ0aWNsZSBwYXJhbWV0ZXIgXCInICsga2V5ICsgJ1wiJztcblxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0Zm9yICggdmFyIGtleSBpbiBkZWZhdWx0cyApIHtcblxuXHRcdFx0aWYgKCB0eXBlb2YgcGFyYW1ldGVyc1sga2V5IF0gPT09ICd1bmRlZmluZWQnICkge1xuXG5cdFx0XHRcdHBhcmFtZXRlcnNbIGtleSBdID0gZGVmYXVsdHNbIGtleSBdO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0fVxuXG5cdGNyZWF0ZVBhcnRpY2xlc18gKCBmaXJzdFBhcnRpY2xlSW5kZXgsIG51bVBhcnRpY2xlcywgcGFyYW1ldGVycywgb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKSB7XG5cblx0XHR2YXIgaW50ZXJsZWF2ZUJ1ZmZlckRhdGEgPSB0aGlzLmludGVybGVhdmVkQnVmZmVyLmFycmF5O1xuXG5cdFx0dGhpcy5iaWxsYm9hcmRfID0gcGFyYW1ldGVycy5iaWxsYm9hcmQ7XG5cblx0XHR2YXIgcmFuZG9tID0gdGhpcy5wYXJ0aWNsZVN5c3RlbS5yYW5kb21GdW5jdGlvbl87XG5cblx0XHR2YXIgcGx1c01pbnVzID0gZnVuY3Rpb24gKCByYW5nZSApIHtcblxuXHRcdFx0cmV0dXJuICggcmFuZG9tKCkgLSAwLjUgKSAqIHJhbmdlICogMjtcblxuXHRcdH07XG5cblx0XHQvLyBUT0RPOiBjaGFuZ2UgdG8gbm90IGFsbG9jYXRlLlxuXHRcdHZhciBwbHVzTWludXNWZWN0b3IgPSBmdW5jdGlvbiAoIHJhbmdlICkge1xuXG5cdFx0XHR2YXIgdiA9IFtdO1xuXG5cdFx0XHRmb3IgKHZhciBpaSA9IDA7IGlpIDwgcmFuZ2UubGVuZ3RoOyArKyBpaSkge1xuXG5cdFx0XHRcdHYucHVzaCggcGx1c01pbnVzKCByYW5nZVsgaWkgXSApICk7XG5cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHY7XG5cblx0XHR9O1xuXG5cdFx0Zm9yICggdmFyIGlpID0gMDsgaWkgPCBudW1QYXJ0aWNsZXM7ICsrIGlpICkge1xuXG5cdFx0XHRpZiAoIG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyICkge1xuXG5cdFx0XHRcdG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyKCBpaSwgcGFyYW1ldGVycyApO1xuXG5cdFx0XHR9XG5cblx0XHRcdHZhciBwTGlmZVRpbWUgPSBwYXJhbWV0ZXJzLmxpZmVUaW1lO1xuXHRcdFx0dmFyIHBTdGFydFRpbWUgPSAoIHBhcmFtZXRlcnMuc3RhcnRUaW1lID09PSBudWxsICkgPyAoIGlpICogcGFyYW1ldGVycy5saWZlVGltZSAvIG51bVBhcnRpY2xlcyApIDogcGFyYW1ldGVycy5zdGFydFRpbWU7XG5cdFx0XHR2YXIgcEZyYW1lU3RhcnQgPSBwYXJhbWV0ZXJzLmZyYW1lU3RhcnQgKyBwbHVzTWludXMocGFyYW1ldGVycy5mcmFtZVN0YXJ0UmFuZ2UpO1xuXHRcdFx0dmFyIHBQb3NpdGlvbiA9IG5ldyBWZWN0b3IzKCkuYWRkVmVjdG9ycyggbmV3IFZlY3RvcjMoKS5mcm9tQXJyYXkocGFyYW1ldGVycy5wb3NpdGlvbiksIG5ldyBWZWN0b3IzKCkuZnJvbUFycmF5KHBsdXNNaW51c1ZlY3RvcihwYXJhbWV0ZXJzLnBvc2l0aW9uUmFuZ2UpKSk7XG5cdFx0XHR2YXIgcFZlbG9jaXR5ID0gbmV3IFZlY3RvcjMoKS5hZGRWZWN0b3JzKCBuZXcgVmVjdG9yMygpLmZyb21BcnJheShwYXJhbWV0ZXJzLnZlbG9jaXR5KSwgbmV3IFZlY3RvcjMoKS5mcm9tQXJyYXkocGx1c01pbnVzVmVjdG9yKHBhcmFtZXRlcnMudmVsb2NpdHlSYW5nZSkpKTtcblx0XHRcdHZhciBwQWNjZWxlcmF0aW9uID0gbmV3IFZlY3RvcjMoKS5hZGRWZWN0b3JzKCBuZXcgVmVjdG9yMygpLmZyb21BcnJheShwYXJhbWV0ZXJzLmFjY2VsZXJhdGlvbiksIG5ldyBWZWN0b3IzKCkuZnJvbUFycmF5KCBwbHVzTWludXNWZWN0b3IoIHBhcmFtZXRlcnMuYWNjZWxlcmF0aW9uUmFuZ2UgKSkpO1xuXHRcdFx0dmFyIHBDb2xvck11bHQgPSBuZXcgVmVjdG9yNCgpLmFkZFZlY3RvcnMoIG5ldyBWZWN0b3I0KCkuZnJvbUFycmF5KHBhcmFtZXRlcnMuY29sb3JNdWx0KSwgbmV3IFZlY3RvcjQoKS5mcm9tQXJyYXkocGx1c01pbnVzVmVjdG9yKCBwYXJhbWV0ZXJzLmNvbG9yTXVsdFJhbmdlICkpKTtcblx0XHRcdHZhciBwU3BpblN0YXJ0ID0gcGFyYW1ldGVycy5zcGluU3RhcnQgKyBwbHVzTWludXMocGFyYW1ldGVycy5zcGluU3RhcnRSYW5nZSk7XG5cdFx0XHR2YXIgcFNwaW5TcGVlZCA9IHBhcmFtZXRlcnMuc3BpblNwZWVkICsgcGx1c01pbnVzKHBhcmFtZXRlcnMuc3BpblNwZWVkUmFuZ2UpO1xuXHRcdFx0dmFyIHBTdGFydFNpemUgPSBwYXJhbWV0ZXJzLnN0YXJ0U2l6ZSArIHBsdXNNaW51cyhwYXJhbWV0ZXJzLnN0YXJ0U2l6ZVJhbmdlKTtcblx0XHRcdHZhciBwRW5kU2l6ZSA9IHBhcmFtZXRlcnMuZW5kU2l6ZSArIHBsdXNNaW51cyhwYXJhbWV0ZXJzLmVuZFNpemVSYW5nZSk7XG5cdFx0XHR2YXIgcE9yaWVudGF0aW9uID0gbmV3IFZlY3RvcjQoKS5mcm9tQXJyYXkocGFyYW1ldGVycy5vcmllbnRhdGlvbik7XG5cblx0XHRcdGZvciAodmFyIGpqID0gMDsgamogPCAxOyArK2pqKSB7XG5cblx0XHRcdFx0dmFyIG9mZnNldDAgPSBDb25zdGFudHMuTEFTVF9JRFggKiBqaiArICggaWkgKiBDb25zdGFudHMuTEFTVF9JRFggKiA0ICkgKyAoIGZpcnN0UGFydGljbGVJbmRleCAqIENvbnN0YW50cy5MQVNUX0lEWCAqIDQgKTtcblx0XHRcdFx0dmFyIG9mZnNldDEgPSBvZmZzZXQwICsgMTtcblx0XHRcdFx0dmFyIG9mZnNldDIgPSBvZmZzZXQwICsgMjtcblx0XHRcdFx0dmFyIG9mZnNldDMgPSBvZmZzZXQwICsgMztcblxuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5QT1NJVElPTl9TVEFSVF9USU1FX0lEWCArIG9mZnNldDBdID0gcFBvc2l0aW9uLng7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5QT1NJVElPTl9TVEFSVF9USU1FX0lEWCArIG9mZnNldDFdID0gcFBvc2l0aW9uLnk7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5QT1NJVElPTl9TVEFSVF9USU1FX0lEWCArIG9mZnNldDJdID0gcFBvc2l0aW9uLno7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5QT1NJVElPTl9TVEFSVF9USU1FX0lEWCArIG9mZnNldDNdID0gcFN0YXJ0VGltZTtcblxuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVVZfTElGRV9USU1FX0ZSQU1FX1NUQVJUX0lEWCArIG9mZnNldDBdID0gQ29uc3RhbnRzLkNPUk5FUlNfW2pqXVswXTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlVWX0xJRkVfVElNRV9GUkFNRV9TVEFSVF9JRFggKyBvZmZzZXQxXSA9IENvbnN0YW50cy5DT1JORVJTX1tqal1bMV07XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5VVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYICsgb2Zmc2V0Ml0gPSBwTGlmZVRpbWU7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5VVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYICsgb2Zmc2V0M10gPSBwRnJhbWVTdGFydDtcblxuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVkVMT0NJVFlfU1RBUlRfU0laRV9JRFggKyBvZmZzZXQwXSA9IHBWZWxvY2l0eS54O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVkVMT0NJVFlfU1RBUlRfU0laRV9JRFggKyBvZmZzZXQxXSA9IHBWZWxvY2l0eS55O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVkVMT0NJVFlfU1RBUlRfU0laRV9JRFggKyBvZmZzZXQyXSA9IHBWZWxvY2l0eS56O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVkVMT0NJVFlfU1RBUlRfU0laRV9JRFggKyBvZmZzZXQzXSA9IHBTdGFydFNpemU7XG5cblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFggKyBvZmZzZXQwXSA9IHBBY2NlbGVyYXRpb24ueDtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFggKyBvZmZzZXQxXSA9IHBBY2NlbGVyYXRpb24ueTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFggKyBvZmZzZXQyXSA9IHBBY2NlbGVyYXRpb24uejtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFggKyBvZmZzZXQzXSA9IHBFbmRTaXplO1xuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5TUElOX1NUQVJUX1NQSU5fU1BFRURfSURYICsgb2Zmc2V0MF0gPSBwU3BpblN0YXJ0O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuU1BJTl9TVEFSVF9TUElOX1NQRUVEX0lEWCArIG9mZnNldDFdID0gcFNwaW5TcGVlZDtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFggKyBvZmZzZXQyXSA9IDA7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5TUElOX1NUQVJUX1NQSU5fU1BFRURfSURYICsgb2Zmc2V0M10gPSAwO1xuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5PUklFTlRBVElPTl9JRFggKyBvZmZzZXQwXSA9IHBPcmllbnRhdGlvbi54O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuT1JJRU5UQVRJT05fSURYICsgb2Zmc2V0MV0gPSBwT3JpZW50YXRpb24ueTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLk9SSUVOVEFUSU9OX0lEWCArIG9mZnNldDJdID0gcE9yaWVudGF0aW9uLno7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5PUklFTlRBVElPTl9JRFggKyBvZmZzZXQzXSA9IHBPcmllbnRhdGlvbi53O1xuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5DT0xPUl9NVUxUX0lEWCArIG9mZnNldDBdID0gcENvbG9yTXVsdC54O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQ09MT1JfTVVMVF9JRFggKyBvZmZzZXQxXSA9IHBDb2xvck11bHQueTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkNPTE9SX01VTFRfSURYICsgb2Zmc2V0Ml0gPSBwQ29sb3JNdWx0Lno7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5DT0xPUl9NVUxUX0lEWCArIG9mZnNldDNdID0gcENvbG9yTXVsdC53O1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHR0aGlzLmludGVybGVhdmVkQnVmZmVyLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMud29ybGRWZWxvY2l0eS52YWx1ZSA9IG5ldyBWZWN0b3IzKHBhcmFtZXRlcnMud29ybGRWZWxvY2l0eVswXSwgcGFyYW1ldGVycy53b3JsZFZlbG9jaXR5WzFdLCBwYXJhbWV0ZXJzLndvcmxkVmVsb2NpdHlbMl0pO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMud29ybGRBY2NlbGVyYXRpb24udmFsdWUgPSBuZXcgVmVjdG9yMyhwYXJhbWV0ZXJzLndvcmxkQWNjZWxlcmF0aW9uWzBdLCBwYXJhbWV0ZXJzLndvcmxkQWNjZWxlcmF0aW9uWzFdLCBwYXJhbWV0ZXJzLndvcmxkQWNjZWxlcmF0aW9uWzJdKTtcblx0XHR0aGlzLm1hdGVyaWFsLnVuaWZvcm1zLnRpbWVSYW5nZS52YWx1ZSA9IHBhcmFtZXRlcnMudGltZVJhbmdlO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMuZnJhbWVEdXJhdGlvbi52YWx1ZSA9IHBhcmFtZXRlcnMuZnJhbWVEdXJhdGlvbjtcblx0XHR0aGlzLm1hdGVyaWFsLnVuaWZvcm1zLm51bUZyYW1lcy52YWx1ZSA9IHBhcmFtZXRlcnMubnVtRnJhbWVzO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMucmFtcFNhbXBsZXIudmFsdWUgPSB0aGlzLnJhbXBUZXh0dXJlXztcblx0XHR0aGlzLm1hdGVyaWFsLnVuaWZvcm1zLmNvbG9yU2FtcGxlci52YWx1ZSA9IHRoaXMuY29sb3JUZXh0dXJlXztcblxuXHRcdHRoaXMubWF0ZXJpYWwuYmxlbmRpbmcgPSB0aGlzLmJsZW5kRnVuY187XG5cblx0fVxuXG5cdGFsbG9jYXRlUGFydGljbGVzXyAoIG51bVBhcnRpY2xlcywgcGFyYW1ldGVycyApIHtcblxuXHRcdGlmICggdGhpcy5udW1QYXJ0aWNsZXNfICE9IG51bVBhcnRpY2xlcyApIHtcblxuXHRcdFx0dmFyIG51bUluZGljZXMgPSA2ICogbnVtUGFydGljbGVzO1xuXG5cdFx0XHRpZiAobnVtSW5kaWNlcyA+IDY1NTM2ICYmIEJ1ZmZlckdlb21ldHJ5Lk1heEluZGV4IDwgNjU1MzYpIHtcblxuXHRcdFx0XHR0aHJvdyBcImNhbid0IGhhdmUgbW9yZSB0aGFuIDEwOTIyIHBhcnRpY2xlcyBwZXIgZW1pdHRlclwiO1xuXG5cdFx0XHR9XG5cblx0XHRcdHZhciB2ZXJ0ZXhCdWZmZXIgPSBuZXcgSW50ZXJsZWF2ZWRCdWZmZXIoIG5ldyBGbG9hdDMyQXJyYXkoW1xuXHRcdFx0XHQvLyBGcm9udFxuXHRcdFx0XHQwLCAwLCAwLCAwLCAtMC41LCAtMC41LCAwLCAwLFxuXHRcdFx0XHQwLCAwLCAwLCAwLCAwLjUsIC0wLjUsIDAsIDAsXG5cdFx0XHRcdDAsIDAsIDAsIDAsIDAuNSwgMC41LCAwLCAwLFxuXHRcdFx0XHQwLCAwLCAwLCAwLCAtMC41LCAwLjUsIDAsIDBcblx0XHRcdF0pLCA4KTtcblxuXG5cdFx0XHQvLyBVc2UgdmVydGV4QnVmZmVyLCBzdGFydGluZyBhdCBvZmZzZXQgMCwgMyBpdGVtcyBpbiBwb3NpdGlvbiBhdHRyaWJ1dGVcblx0XHRcdHZhciBwb3NpdGlvbnMgPSBuZXcgSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUoIHZlcnRleEJ1ZmZlciwgMywgMCApO1xuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0QXR0cmlidXRlKCAncG9zaXRpb24nLCBwb3NpdGlvbnMgKTtcblx0XHRcdC8vIFVzZSB2ZXJ0ZXhCdWZmZXIsIHN0YXJ0aW5nIGF0IG9mZnNldCA0LCAyIGl0ZW1zIGluIHV2IGF0dHJpYnV0ZVxuXHRcdFx0dmFyIHV2cyA9IG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSggdmVydGV4QnVmZmVyLCAyLCA0ICk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICd1dicsIHV2cyApO1xuXG5cdFx0XHR2YXIgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShbXG5cblx0XHRcdFx0MCwgMSwgMixcblx0XHRcdFx0MCwgMiwgM1xuXG5cdFx0XHRdKTtcblxuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0SW5kZXgoIG5ldyBCdWZmZXJBdHRyaWJ1dGUoIGluZGljZXMsIDEgKSApO1xuXG5cdFx0XHR0aGlzLm51bVBhcnRpY2xlc18gPSBudW1QYXJ0aWNsZXM7XG5cdFx0XHR0aGlzLmludGVybGVhdmVkQnVmZmVyID0gbmV3IEluc3RhbmNlZEludGVybGVhdmVkQnVmZmVyKCBuZXcgRmxvYXQzMkFycmF5KCBudW1QYXJ0aWNsZXMgKiBDb25zdGFudHMuc2luZ2xlUGFydGljbGVBcnJheV8uYnl0ZUxlbmd0aCApLCBDb25zdGFudHMuTEFTVF9JRFgsIDEgKS5zZXRVc2FnZSggRHluYW1pY0RyYXdVc2FnZSApO1xuXG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCAzLCBDb25zdGFudHMuUE9TSVRJT05fU1RBUlRfVElNRV9JRFgpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ3N0YXJ0VGltZScsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCAxLCAzKSk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICd1dkxpZmVUaW1lRnJhbWVTdGFydCcsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCA0LCBDb25zdGFudHMuVVZfTElGRV9USU1FX0ZSQU1FX1NUQVJUX0lEWCkpO1xuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0QXR0cmlidXRlKCAndmVsb2NpdHlTdGFydFNpemUnLCBuZXcgSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUodGhpcy5pbnRlcmxlYXZlZEJ1ZmZlciwgNCwgQ29uc3RhbnRzLlZFTE9DSVRZX1NUQVJUX1NJWkVfSURYKSk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICdhY2NlbGVyYXRpb25FbmRTaXplJywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDQsIENvbnN0YW50cy5BQ0NFTEVSQVRJT05fRU5EX1NJWkVfSURYKSk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICdzcGluU3RhcnRTcGluU3BlZWQnLCBuZXcgSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUodGhpcy5pbnRlcmxlYXZlZEJ1ZmZlciwgNCwgQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFgpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ29yaWVudGF0aW9uJywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDQsIENvbnN0YW50cy5PUklFTlRBVElPTl9JRFgpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ2NvbG9yTXVsdCcsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCA0LCBDb25zdGFudHMuQ09MT1JfTVVMVF9JRFgpKTtcblxuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uY29tcHV0ZUJvdW5kaW5nU3BoZXJlKCk7XG5cblx0XHRcdHZhciB1bmlmb3JtcyA9IHtcblxuXHRcdFx0XHQvL3dvcmxkOiB7IHR5cGU6ICdtNCcsIHZhbHVlOiB0aGlzLm1hdHJpeFdvcmxkIH0sXG5cdFx0XHRcdHZpZXdJbnZlcnNlOiB7IHR5cGU6ICdtNCcsIHZhbHVlOiB0aGlzLnBhcnRpY2xlU3lzdGVtLmNhbWVyYS5tYXRyaXhXb3JsZCB9LFxuXHRcdFx0XHR3b3JsZFZlbG9jaXR5OiB7IHR5cGU6ICd2MycsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdHdvcmxkQWNjZWxlcmF0aW9uOiB7IHR5cGU6ICd2MycsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdHRpbWVSYW5nZTogeyB0eXBlOiAnZicsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdHRpbWU6IHsgdHlwZTogJ2YnLCB2YWx1ZTogbnVsbCB9LFxuXHRcdFx0XHR0aW1lT2Zmc2V0OiB7IHR5cGU6ICdmJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0ZnJhbWVEdXJhdGlvbjogeyB0eXBlOiAnZicsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdG51bUZyYW1lczogeyB0eXBlOiAnZicsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdHJhbXBTYW1wbGVyOiB7IHR5cGU6IFwidFwiLCB2YWx1ZTogdGhpcy5yYW1wVGV4dHVyZV8gfSxcblx0XHRcdFx0Y29sb3JTYW1wbGVyOiB7IHR5cGU6IFwidFwiLCB2YWx1ZTogdGhpcy5jb2xvclRleHR1cmVfIH1cblxuXHRcdFx0fTtcblxuXHRcdFx0dmFyIG1hdGVyaWFsID0gbmV3IFNoYWRlck1hdGVyaWFsKHtcblxuXHRcdFx0XHR1bmlmb3JtczogdW5pZm9ybXMsXG5cdFx0XHRcdHZlcnRleFNoYWRlcjogKCBwYXJhbWV0ZXJzLmJpbGxib2FyZCApID8gYmlsbGJvYXJkUGFydGljbGVJbnN0YW5jZWRWZXJ0ZXhTaGFkZXIgOiBvcmllbnRlZFBhcnRpY2xlSW5zdGFuY2VkVmVydGV4U2hhZGVyLFxuXHRcdFx0XHRmcmFnbWVudFNoYWRlcjogcGFydGljbGVGcmFnbWVudFNoYWRlcixcblx0XHRcdFx0c2lkZTogKHRoaXMuYmlsbGJvYXJkXyk/IERvdWJsZVNpZGUgOiBGcm9udFNpZGUsXG5cdFx0XHRcdGJsZW5kaW5nOiB0aGlzLmJsZW5kRnVuY18sXG5cdFx0XHRcdGRlcHRoVGVzdDogdHJ1ZSxcblx0XHRcdFx0ZGVwdGhXcml0ZTogZmFsc2UsXG5cdFx0XHRcdHRyYW5zcGFyZW50OiB0cnVlXG5cblx0XHRcdH0pO1xuXG5cblx0XHRcdHRoaXMuZ2VvbWV0cnkgPSB0aGlzLnBhcnRpY2xlQnVmZmVyXztcblx0XHRcdHRoaXMubWF0ZXJpYWwgPSBtYXRlcmlhbDtcblxuXHRcdH1cblxuXHR9XG5cblx0c2V0UGFyYW1ldGVycyAoIHBhcmFtZXRlcnMsIG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyICkge1xuXG5cdFx0dGhpcy52YWxpZGF0ZVBhcmFtZXRlcnMgKCBwYXJhbWV0ZXJzICk7XG5cblx0XHR2YXIgbnVtUGFydGljbGVzID0gcGFyYW1ldGVycy5udW1QYXJ0aWNsZXM7XG5cblx0XHR0aGlzLmFsbG9jYXRlUGFydGljbGVzXyAoIG51bVBhcnRpY2xlcywgcGFyYW1ldGVycyApO1xuXHRcdHRoaXMuY3JlYXRlUGFydGljbGVzXyAoIDAsIG51bVBhcnRpY2xlcywgcGFyYW1ldGVycywgb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKTtcblxuXHR9XG5cblx0ZHJhdyAoIHdvcmxkLCB2aWV3UHJvamVjdGlvbiwgdGltZU9mZnNldCApIHtcblxuXHRcdHZhciB1bmlmb3JtcyA9IHRoaXMubWF0ZXJpYWwudW5pZm9ybXM7XG5cblx0XHR1bmlmb3Jtcy50aW1lLnZhbHVlID0gdGhpcy50aW1lU291cmNlXygpO1xuXHRcdHVuaWZvcm1zLnRpbWVPZmZzZXQudmFsdWUgPSB0aW1lT2Zmc2V0O1xuXG5cdH1cblxuXHRjcmVhdGVPbmVTaG90ICgpIHtcblxuXHRcdHJldHVybiBuZXcgT25lU2hvdCggdGhpcywgdGhpcy5wYXJ0aWNsZVN5c3RlbS5zY2VuZSApO1xuXG5cdH1cblxuXHRjbG9uZSAoIG9iamVjdCApIHtcblxuXHRcdGlmICggb2JqZWN0ID09PSB1bmRlZmluZWQgKSBvYmplY3QgPSB0aGlzLnBhcnRpY2xlU3lzdGVtLmNyZWF0ZVBhcnRpY2xlRW1pdHRlciggdGhpcy5jb2xvclRleHR1cmVfLCB0aGlzLnRpbWVTb3VyY2VfKTtcblxuXHRcdG9iamVjdC5nZW9tZXRyeSA9IHRoaXMuZ2VvbWV0cnk7XG5cdFx0b2JqZWN0Lm1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbC5jbG9uZSgpO1xuXHRcdG9iamVjdC5tYXRlcmlhbC51bmlmb3Jtcy52aWV3SW52ZXJzZS52YWx1ZSA9IHRoaXMucGFydGljbGVTeXN0ZW0uY2FtZXJhLm1hdHJpeFdvcmxkO1xuXHRcdG9iamVjdC5tYXRlcmlhbC51bmlmb3Jtcy5yYW1wU2FtcGxlci52YWx1ZSA9IHRoaXMucmFtcFRleHR1cmVfO1xuXHRcdG9iamVjdC5tYXRlcmlhbC51bmlmb3Jtcy5jb2xvclNhbXBsZXIudmFsdWUgPSB0aGlzLmNvbG9yVGV4dHVyZV87XG5cblx0XHRzdXBlci5jb3B5KCBvYmplY3QgKTtcblxuXHRcdHJldHVybiBvYmplY3Q7XG5cblx0fVxuXG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IiwiLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vZ3JlZ2dtYW4vdGRsL2Jsb2IvbWFzdGVyL3RkbC9wYXJ0aWNsZXMuanNcbi8vIHBvcnRlZCB0byB0aHJlZS5qcyBieSBmYXplYWN0aW9uXG5cbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4vZW1pdHRlci5qcydcblxuY2xhc3MgVHJhaWwgZXh0ZW5kcyBQYXJ0aWNsZUVtaXR0ZXIge1xuXHRjb25zdHJ1Y3RvciggcGFydGljbGVTeXN0ZW0sIG1heFBhcnRpY2xlcywgcGFyYW1ldGVycywgb3B0X3RleHR1cmUsIG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyLCBvcHRfY2xvY2sgKVx0e1xuXHRcdHN1cGVyKHBhcnRpY2xlU3lzdGVtLCBvcHRfdGV4dHVyZSwgb3B0X2Nsb2NrKTtcblxuXHRcdHRoaXMuYWxsb2NhdGVQYXJ0aWNsZXNfKG1heFBhcnRpY2xlcywgcGFyYW1ldGVycyk7XG5cdFx0dGhpcy52YWxpZGF0ZVBhcmFtZXRlcnMocGFyYW1ldGVycyk7XG5cblx0XHR0aGlzLnBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzO1xuXHRcdHRoaXMucGVyUGFydGljbGVQYXJhbVNldHRlciA9IG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyO1xuXHRcdHRoaXMuYmlydGhJbmRleF8gPSAwO1xuXHRcdHRoaXMubWF4UGFydGljbGVzXyA9IG1heFBhcnRpY2xlcztcblx0fVxuXG5cdGJpcnRoUGFydGljbGVzICggcG9zaXRpb24gKSB7XG5cblx0XHR2YXIgbnVtUGFydGljbGVzID0gdGhpcy5wYXJhbWV0ZXJzLm51bVBhcnRpY2xlcztcblx0XHR0aGlzLnBhcmFtZXRlcnMuc3RhcnRUaW1lID0gdGhpcy50aW1lU291cmNlXygpO1xuXHRcdHRoaXMucGFyYW1ldGVycy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXG5cdFx0d2hpbGUgKCB0aGlzLmJpcnRoSW5kZXhfICsgbnVtUGFydGljbGVzID49IHRoaXMubWF4UGFydGljbGVzXyApIHtcblxuXHRcdFx0dmFyIG51bVBhcnRpY2xlc1RvRW5kID0gdGhpcy5tYXhQYXJ0aWNsZXNfIC0gdGhpcy5iaXJ0aEluZGV4XztcblxuXHRcdFx0dGhpcy5jcmVhdGVQYXJ0aWNsZXNfKCB0aGlzLmJpcnRoSW5kZXhfLCBudW1QYXJ0aWNsZXNUb0VuZCxcdHRoaXMucGFyYW1ldGVycywgdGhpcy5wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyICk7XG5cdFx0XHRudW1QYXJ0aWNsZXMgLT0gbnVtUGFydGljbGVzVG9FbmQ7XG5cblx0XHRcdHRoaXMuYmlydGhJbmRleF8gPSAwO1xuXG5cdFx0fVxuXG5cdFx0dGhpcy5jcmVhdGVQYXJ0aWNsZXNfKCB0aGlzLmJpcnRoSW5kZXhfLCBudW1QYXJ0aWNsZXMsIHRoaXMucGFyYW1ldGVycywgdGhpcy5wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyICk7XG5cblx0XHRpZiAoIHRoaXMuYmlydGhJbmRleF8gPT09IDAgKSB7XG5cblx0XHRcdHRoaXMucGFydGljbGVTeXN0ZW0uc2NlbmUuYWRkKCB0aGlzICk7XG5cblx0XHR9XG5cblx0XHR0aGlzLmJpcnRoSW5kZXhfICs9IG51bVBhcnRpY2xlcztcblxuXG5cdH1cblxufVxuXG5leHBvcnQgeyBUcmFpbCB9IiwiLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vZ3JlZ2dtYW4vdGRsL2Jsb2IvbWFzdGVyL3RkbC9wYXJ0aWNsZXMuanNcbi8vIHBvcnRlZCB0byB0aHJlZS5qcyBieSBmYXplYWN0aW9uXG5pbXBvcnR7XG5cdERhdGFUZXh0dXJlLFxuXHRSR0JBRm9ybWF0LFxuXHRMaW5lYXJGaWx0ZXJcbn0gZnJvbSAndGhyZWUnXG5pbXBvcnQgeyBjcmVhdGVEZWZhdWx0Q2xvY2tfIH0gZnJvbSAnLi9jb25zdGFudHMuanMnXG5pbXBvcnQgeyBQYXJ0aWNsZUVtaXR0ZXIgfSBmcm9tICcuL2VtaXR0ZXInXG5pbXBvcnQgeyBUcmFpbCB9IGZyb20gJy4vdHJhaWwnXG5cbmNsYXNzIFBhcnRpY2xlU3lzdGVtICB7XG5cdGNvbnN0cnVjdG9yKCBzY2VuZSwgY2FtZXJhLCBvcHRfY2xvY2ssIG9wdF9yYW5kb21GdW5jdGlvbiApIHtcblx0XHR0aGlzLnNjZW5lID0gc2NlbmU7XG5cdFx0dGhpcy5jYW1lcmEgPSBjYW1lcmE7XG5cblx0XHR0aGlzLmRyYXdhYmxlc18gPSBbXTtcblxuXHRcdHZhciBwaXhlbEJhc2UgPSBbMCwgMC4yMCwgMC43MCwgMSwgMC43MCwgMC4yMCwgMCwgMF07XG5cdFx0dmFyIHBpeGVscyA9IFtdO1xuXG5cdFx0Zm9yICh2YXIgeXkgPSAwOyB5eSA8IDg7ICsreXkpIHtcblxuXHRcdFx0Zm9yICh2YXIgeHggPSAwOyB4eCA8IDg7ICsreHgpIHtcblxuXHRcdFx0XHR2YXIgcGl4ZWwgPSBwaXhlbEJhc2VbeHhdICogcGl4ZWxCYXNlW3l5XTtcblx0XHRcdFx0cGl4ZWxzLnB1c2gocGl4ZWwsIHBpeGVsLCBwaXhlbCwgcGl4ZWwpO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHR2YXIgY29sb3JUZXh0dXJlID0gdGhpcy5jcmVhdGVUZXh0dXJlRnJvbUZsb2F0cyg4LCA4LCBwaXhlbHMpO1xuXHRcdHZhciByYW1wVGV4dHVyZSA9IHRoaXMuY3JlYXRlVGV4dHVyZUZyb21GbG9hdHMoMiwgMSwgWzEsIDEsIDEsIDEsIDEsIDEsIDEsIDBdKTtcblxuXHRcdHRoaXMubm93XyA9IG5ldyBEYXRlKCk7XG5cdFx0dGhpcy50aW1lQmFzZV8gPSBuZXcgRGF0ZSgpO1xuXG5cdFx0aWYgKG9wdF9jbG9jaykge1xuXG5cdFx0XHR0aGlzLnRpbWVTb3VyY2VfID0gb3B0X2Nsb2NrO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0dGhpcy50aW1lU291cmNlXyA9IGNyZWF0ZURlZmF1bHRDbG9ja18odGhpcyk7XG5cblx0XHR9XG5cblx0XHR0aGlzLnJhbmRvbUZ1bmN0aW9uXyA9IG9wdF9yYW5kb21GdW5jdGlvbiB8fCBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHJldHVybiBNYXRoLnJhbmRvbSgpO1xuXG5cdFx0fTtcblxuXHRcdHRoaXMuZGVmYXVsdENvbG9yVGV4dHVyZSA9IGNvbG9yVGV4dHVyZTtcblx0XHR0aGlzLmRlZmF1bHRSYW1wVGV4dHVyZSA9IHJhbXBUZXh0dXJlO1xuXHR9XG5cblx0Y3JlYXRlVGV4dHVyZUZyb21GbG9hdHMgKCB3aWR0aCwgaGVpZ2h0LCBwaXhlbHMsIG9wdF90ZXh0dXJlICkge1xuXG5cdFx0dmFyIHRleHR1cmUgPSBudWxsO1xuXHRcdGlmICggb3B0X3RleHR1cmUgIT0gbnVsbCApIHtcblxuXHRcdFx0dGV4dHVyZSA9IG9wdF90ZXh0dXJlO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0dmFyIGRhdGEgPSBuZXcgVWludDhBcnJheSggcGl4ZWxzLmxlbmd0aCApO1xuXHRcdFx0dmFyIHQ7XG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBwaXhlbHMubGVuZ3RoOyBpICsrICkge1xuXG5cdFx0XHRcdHQgPSBwaXhlbHNbIGkgXSAqIDI1NS47XG5cdFx0XHRcdGRhdGFbIGkgXSA9IHQ7XG5cblx0XHRcdH1cblxuXHRcdFx0dGV4dHVyZSA9IG5ldyBEYXRhVGV4dHVyZSggZGF0YSwgd2lkdGgsIGhlaWdodCwgUkdCQUZvcm1hdCApO1xuXHRcdFx0dGV4dHVyZS5taW5GaWx0ZXIgPSBMaW5lYXJGaWx0ZXI7XG5cdFx0XHR0ZXh0dXJlLm1hZ0ZpbHRlciA9IExpbmVhckZpbHRlcjtcblx0XHRcdHRleHR1cmUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0XHRyZXR1cm4gdGV4dHVyZTtcblxuXHRcdH1cblxuXHRcdHJldHVybiB0ZXh0dXJlO1xuXG5cdH1cblxuXHRjcmVhdGVQYXJ0aWNsZUVtaXR0ZXIgKCBvcHRfdGV4dHVyZSwgb3B0X2Nsb2NrICkge1xuXHRcdHZhciBlbWl0dGVyID0gbmV3IFBhcnRpY2xlRW1pdHRlciggdGhpcywgb3B0X3RleHR1cmUsIG9wdF9jbG9jayApO1xuXHRcdHRoaXMuZHJhd2FibGVzXy5wdXNoKCBlbWl0dGVyICk7XG5cblx0XHRyZXR1cm4gZW1pdHRlcjtcblxuXHR9XG5cblx0Y3JlYXRlVHJhaWwgKCBtYXhQYXJ0aWNsZXMsIHBhcmFtZXRlcnMsIG9wdF90ZXh0dXJlLCBvcHRfcGVyUGFydGljbGVQYXJhbVNldHRlciwgb3B0X2Nsb2NrICkge1xuXG5cdFx0dmFyIHRyYWlsID0gbmV3IFRyYWlsKCB0aGlzLCBtYXhQYXJ0aWNsZXMsIHBhcmFtZXRlcnMsIG9wdF90ZXh0dXJlLCBvcHRfcGVyUGFydGljbGVQYXJhbVNldHRlcixcdG9wdF9jbG9jayApO1xuXHRcdHRoaXMuZHJhd2FibGVzXy5wdXNoKCB0cmFpbCApO1xuXG5cdFx0cmV0dXJuIHRyYWlsO1xuXG5cdH1cblxuXHRkcmF3ICggdmlld1Byb2plY3Rpb24sIHdvcmxkLCB2aWV3SW52ZXJzZSApIHtcblxuXHRcdHRoaXMubm93XyA9IG5ldyBEYXRlKCk7XG5cblx0XHRmb3IgKCB2YXIgaWkgPSAwOyBpaSA8IHRoaXMuZHJhd2FibGVzXy5sZW5ndGg7ICsrIGlpICkge1xuXG5cdFx0XHR0aGlzLmRyYXdhYmxlc19bIGlpIF0uZHJhdyggd29ybGQsIHZpZXdQcm9qZWN0aW9uLCAwICk7XG5cblx0XHR9XG5cblx0fVxuXG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlU3lzdGVtIH1cbiJdLCJuYW1lcyI6WyJDb25zdGFudHMuTEFTVF9JRFgiLCJDb25zdGFudHMuUE9TSVRJT05fU1RBUlRfVElNRV9JRFgiLCJDb25zdGFudHMuVVZfTElGRV9USU1FX0ZSQU1FX1NUQVJUX0lEWCIsIkNvbnN0YW50cy5DT1JORVJTXyIsIkNvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCIsIkNvbnN0YW50cy5BQ0NFTEVSQVRJT05fRU5EX1NJWkVfSURYIiwiQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFgiLCJDb25zdGFudHMuT1JJRU5UQVRJT05fSURYIiwiQ29uc3RhbnRzLkNPTE9SX01VTFRfSURYIiwiQ29uc3RhbnRzLnNpbmdsZVBhcnRpY2xlQXJyYXlfIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNVLElBQUMsUUFBUSxHQUFHO0FBQ3RCO0FBQ0EsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFO0FBQ2pCLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsRUFBRTtBQUNqQixDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxH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LENBQUM7QUFDckIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztBQUN2QjtBQUNBLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDdkI7QUFDQSxFQUFFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELEVBQUUsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2xCO0FBQ0EsRUFBRSxLQUFLLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0FBQ2pDO0FBQ0EsR0FBRyxLQUFLLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0FBQ2xDO0FBQ0EsSUFBSSxJQUFJLEtBQUssR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzlDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUM1QztBQUNBLElBQUk7QUFDSjtBQUNBLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDaEUsRUFBRSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pGO0FBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFF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
