(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE_GPU_ParticleSystem = {}, global.THREE));
}(this, (function (exports, three) { 'use strict';

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
	// ported to three.js by fazeaction
	var CORNERS_ = [[-0.5, -0.5], [+0.5, -0.5], [+0.5, +0.5], [-0.5, +0.5]];
	function createDefaultClock_(particleSystem) {
		return function () {
			var now = particleSystem.now_;
			var base = particleSystem.timeBase_;
			return (now.getTime() - base.getTime()) / 1000.0;
		};
	}
	var POSITION_START_TIME_IDX = 0;
	var UV_LIFE_TIME_FRAME_START_IDX = 4;
	var VELOCITY_START_SIZE_IDX = 8;
	var ACCELERATION_END_SIZE_IDX = 12;
	var SPIN_START_SPIN_SPEED_IDX = 16;
	var ORIENTATION_IDX = 20;
	var COLOR_MULT_IDX = 24;
	var LAST_IDX = 28;
	var singleParticleArray_ = new Float32Array(4 * LAST_IDX);

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
	// ported to three.js by fazeaction
	function ParticleSpec() {
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
		this.position = [0, 0, 0];
		this.positionRange = [0, 0, 0];
		this.velocity = [0, 0, 0];
		this.velocityRange = [0, 0, 0];
		this.acceleration = [0, 0, 0];
		this.accelerationRange = [0, 0, 0];
		this.spinStart = 0;
		this.spinStartRange = 0;
		this.spinSpeed = 0;
		this.spinSpeedRange = 0;
		this.colorMult = [1, 1, 1, 1];
		this.colorMultRange = [0, 0, 0, 0];
		this.worldVelocity = [0, 0, 0];
		this.worldAcceleration = [0, 0, 0];
		this.billboard = true;
		this.orientation = [0, 0, 0, 1];
	}

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

	class OneShot extends three.Mesh {
		constructor(emitter, scene) {
			super();
			this.emitter_ = emitter.clone();
			this.scene = scene;
			this.world_ = new three.Matrix4();
			this.tempWorld_ = new three.Matrix4();
			this.timeOffset_ = 0;
			this.visible_ = false; // Remove the parent emitter from the particle system's drawable
			// list (if it's still there) and add ourselves instead.

			var particleSystem = emitter.particleSystem;
			var idx = particleSystem.drawables_.indexOf(this.emitter_);

			if (idx >= 0) {
				particleSystem.drawables_.splice(idx, 1);
			}

			particleSystem.drawables_.push(this);
		}

		trigger(opt_world) {
			if (!this.visible_) {
				this.scene.add(this.emitter_);
			}

			if (opt_world) {
				this.emitter_.position.copy(new three.Vector3().fromArray(opt_world));
			}

			this.visible_ = true;
			this.timeOffset_ = this.emitter_.timeSource_();
		}

		draw(world, viewProjection, timeOffset) {
			if (this.visible_) {
				//this.tempWorld_.multiplyMatrices(this.world_, world);
				this.emitter_.draw(this.world_, viewProjection, this.timeOffset_);
			}
		}

	}

	var billboardParticleInstancedVertexShader = "\nuniform mat4 viewInverse;\nuniform vec3 worldVelocity;\nuniform vec3 worldAcceleration;\nuniform float timeRange;\nuniform float time;\nuniform float timeOffset;\nuniform float frameDuration;\nuniform float numFrames;\nattribute vec4 uvLifeTimeFrameStart;\nattribute float startTime;\nattribute vec4 velocityStartSize;\nattribute vec4 accelerationEndSize;\nattribute vec4 spinStartSpinSpeed;\nattribute vec4 colorMult;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\n		float lifeTime = uvLifeTimeFrameStart.z;\n		float frameStart = uvLifeTimeFrameStart.w;\n		vec3 velocity = (modelMatrix * vec4(velocityStartSize.xyz,\n																 0.)).xyz + worldVelocity;\n		float startSize = velocityStartSize.w;\n		vec3 acceleration = (modelMatrix * vec4(accelerationEndSize.xyz,\n																		 0)).xyz + worldAcceleration;\n		float endSize = accelerationEndSize.w;\n		float spinStart = spinStartSpinSpeed.x;\n		float spinSpeed = spinStartSpinSpeed.y;\n		float localTime = mod((time - timeOffset - startTime), timeRange);\n		float percentLife = localTime / lifeTime;\n		float frame = mod(floor(localTime / frameDuration + frameStart),\n										 numFrames);\n		float uOffset = frame / numFrames;\n		float u = uOffset + (uv.x + 0.5) * (1. / numFrames);\n		outputTexcoord = vec2(u, uv.y + 0.5);\n		outputColorMult = colorMult;\n		vec3 basisX = viewInverse[0].xyz;\n		vec3 basisZ = viewInverse[1].xyz;\n		vec4 vertexWorld = modelMatrix * vec4(position, 1.0);\n		float size = mix(startSize, endSize, percentLife);\n		size = (percentLife < 0. || percentLife > 1.) ? 0. : size;\n		float s = sin(spinStart + spinSpeed * localTime);\n		float c = cos(spinStart + spinSpeed * localTime);\n		vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, -uv.x * s + uv.y * c);\n		vec3 localPosition = vec3(basisX * rotatedPoint.x + basisZ * rotatedPoint.y) * size +\n												velocity * localTime +\n												acceleration * localTime * localTime +\n												vertexWorld.xyz;\n		outputPercentLife = percentLife;\n		gl_Position = projectionMatrix * viewMatrix * vec4(localPosition, 1.);\n}";

	var orientedParticleInstancedVertexShader = "\nuniform mat4 worldViewProjection;\nuniform mat4 world;\nuniform vec3 worldVelocity;\nuniform vec3 worldAcceleration;\nuniform float timeRange;\nuniform float time;\nuniform float timeOffset;\nuniform float frameDuration;\nuniform float numFrames;\nattribute vec3 offset;\nattribute vec4 uvLifeTimeFrameStart;attribute float startTime;attribute vec4 velocityStartSize;attribute vec4 accelerationEndSize;attribute vec4 spinStartSpinSpeed;attribute vec4 orientation;attribute vec4 colorMult;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\nfloat lifeTime = uvLifeTimeFrameStart.z;\nfloat frameStart = uvLifeTimeFrameStart.w;\nvec3 velocity = (world * vec4(velocityStartSize.xyz,\n															0.)).xyz + worldVelocity;\nfloat startSize = velocityStartSize.w;\nvec3 acceleration = (world * vec4(accelerationEndSize.xyz,\n																	0)).xyz + worldAcceleration;\nfloat endSize = accelerationEndSize.w;\nfloat spinStart = spinStartSpinSpeed.x;\nfloat spinSpeed = spinStartSpinSpeed.y;\nfloat localTime = mod((time - timeOffset - startTime), timeRange);\nfloat percentLife = localTime / lifeTime;\nfloat frame = mod(floor(localTime / frameDuration + frameStart),\n									numFrames);\nfloat uOffset = frame / numFrames;\nfloat u = uOffset + (uv.x + 0.5) * (1. / numFrames);\noutputTexcoord = vec2(u, uv.y + 0.5);\noutputColorMult = colorMult;\nfloat size = mix(startSize, endSize, percentLife);\nsize = (percentLife < 0. || percentLife > 1.) ? 0. : size;\nfloat s = sin(spinStart + spinSpeed * localTime);\nfloat c = cos(spinStart + spinSpeed * localTime);\nvec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.,\n												 (uv.x * s - uv.y * c) * size, 1.);\nvec3 center = velocity * localTime +\n							acceleration * localTime * localTime +\n							position +offset;\nvec4 q2 = orientation + orientation;\nvec4 qx = orientation.xxxw * q2.xyzx;\nvec4 qy = orientation.xyyw * q2.xyzy;\nvec4 qz = orientation.xxzw * q2.xxzz;\nmat4 localMatrix = mat4(\n		(1.0 - qy.y) - qz.z,\n		qx.y + qz.w,\n		qx.z - qy.w,\n		0,\n		qx.y - qz.w,\n		(1.0 - qx.x) - qz.z,\n		qy.z + qx.w,\n		0,\n		qx.z + qy.w,\n		qy.z - qx.w,\n		(1.0 - qx.x) - qy.y,\n		0,\n		center.x, center.y, center.z, 1);\nrotatedPoint = localMatrix * rotatedPoint;\noutputPercentLife = percentLife;\ngl_Position = projectionMatrix * modelViewMatrix * rotatedPoint;\n}";

	var particleFragmentShader = "\n#ifdef GL_ES\nprecision mediump float;\n#endif\nuniform sampler2D rampSampler;\nuniform sampler2D colorSampler;\nvarying vec2 outputTexcoord;\nvarying float outputPercentLife;\nvarying vec4 outputColorMult;\nvoid main() {\n		vec4 colorMult = texture2D(rampSampler, vec2(outputPercentLife, 0.5)) * outputColorMult;\n		gl_FragColor = texture2D(colorSampler, outputTexcoord) * colorMult;\n}";

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

	class ParticleEmitter extends three.Mesh {
		constructor(particleSystem, opt_texture, opt_clock) {
			super();
			opt_clock = opt_clock || particleSystem.timeSource_; //TODO make alternative to instanced buffer
			//this.particleBuffer_ = new THREE.BufferGeometry();
			//this.indexBuffer_ = [];

			this.particleBuffer_ = new three.InstancedBufferGeometry();
			this.interleavedBuffer = new three.InterleavedBuffer();
			this.numParticles_ = 0;
			this.rampTexture_ = particleSystem.defaultRampTexture;
			this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;
			this.particleSystem = particleSystem;
			this.timeSource_ = opt_clock;
			this.setState(three.NormalBlending);
		}

		setTranslation(x, y, z) {
			this.position.x = x;
			this.position.y = y;
			this.position.z = z;
		}

		setState(stateId) {
			this.blendFunc_ = stateId;
		}

		setColorRamp(colorRamp) {
			var width = colorRamp.length / 4;

			if (width % 1 != 0) {
				throw 'colorRamp must have multiple of 4 entries';
			}

			if (this.rampTexture_ == this.particleSystem.defaultRampTexture) {
				this.rampTexture_ = null;
			}

			this.rampTexture_ = this.particleSystem.createTextureFromFloats(width, 1, colorRamp, this.rampTexture_);
		}

		validateParameters(parameters) {
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

		createParticles_(firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter) {
			var interleaveBufferData = this.interleavedBuffer.array;
			this.billboard_ = parameters.billboard;
			var random = this.particleSystem.randomFunction_;

			var plusMinus = function (range) {
				return (random() - 0.5) * range * 2;
			}; // TODO: change to not allocate.


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
				var pStartTime = parameters.startTime === null ? ii * parameters.lifeTime / numParticles : parameters.startTime;
				var pFrameStart = parameters.frameStart + plusMinus(parameters.frameStartRange);
				var pPosition = new three.Vector3().addVectors(new three.Vector3().fromArray(parameters.position), new three.Vector3().fromArray(plusMinusVector(parameters.positionRange)));
				var pVelocity = new three.Vector3().addVectors(new three.Vector3().fromArray(parameters.velocity), new three.Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
				var pAcceleration = new three.Vector3().addVectors(new three.Vector3().fromArray(parameters.acceleration), new three.Vector3().fromArray(plusMinusVector(parameters.accelerationRange)));
				var pColorMult = new three.Vector4().addVectors(new three.Vector4().fromArray(parameters.colorMult), new three.Vector4().fromArray(plusMinusVector(parameters.colorMultRange)));
				var pSpinStart = parameters.spinStart + plusMinus(parameters.spinStartRange);
				var pSpinSpeed = parameters.spinSpeed + plusMinus(parameters.spinSpeedRange);
				var pStartSize = parameters.startSize + plusMinus(parameters.startSizeRange);
				var pEndSize = parameters.endSize + plusMinus(parameters.endSizeRange);
				var pOrientation = new three.Vector4().fromArray(parameters.orientation);

				for (var jj = 0; jj < 1; ++jj) {
					var offset0 = LAST_IDX * jj + ii * LAST_IDX * 4 + firstParticleIndex * LAST_IDX * 4;
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
			this.material.uniforms.worldVelocity.value = new three.Vector3(parameters.worldVelocity[0], parameters.worldVelocity[1], parameters.worldVelocity[2]);
			this.material.uniforms.worldAcceleration.value = new three.Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
			this.material.uniforms.timeRange.value = parameters.timeRange;
			this.material.uniforms.frameDuration.value = parameters.frameDuration;
			this.material.uniforms.numFrames.value = parameters.numFrames;
			this.material.uniforms.rampSampler.value = this.rampTexture_;
			this.material.uniforms.colorSampler.value = this.colorTexture_;
			this.material.blending = this.blendFunc_;
		}

		allocateParticles_(numParticles, parameters) {
			if (this.numParticles_ != numParticles) {
				var numIndices = 6 * numParticles;

				if (numIndices > 65536 && three.BufferGeometry.MaxIndex < 65536) {
					throw "can't have more than 10922 particles per emitter";
				}

				var vertexBuffer = new three.InterleavedBuffer(new Float32Array([// Front
				0, 0, 0, 0, -0.5, -0.5, 0, 0, 0, 0, 0, 0, 0.5, -0.5, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, -0.5, 0.5, 0, 0]), 8); // Use vertexBuffer, starting at offset 0, 3 items in position attribute

				var positions = new three.InterleavedBufferAttribute(vertexBuffer, 3, 0);
				this.particleBuffer_.setAttribute('position', positions); // Use vertexBuffer, starting at offset 4, 2 items in uv attribute

				var uvs = new three.InterleavedBufferAttribute(vertexBuffer, 2, 4);
				this.particleBuffer_.setAttribute('uv', uvs);
				var indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
				this.particleBuffer_.setIndex(new three.BufferAttribute(indices, 1));
				this.numParticles_ = numParticles;
				this.interleavedBuffer = new three.InstancedInterleavedBuffer(new Float32Array(numParticles * singleParticleArray_.byteLength), LAST_IDX, 1).setUsage(three.DynamicDrawUsage);
				this.particleBuffer_.setAttribute('position', new three.InterleavedBufferAttribute(this.interleavedBuffer, 3, POSITION_START_TIME_IDX));
				this.particleBuffer_.setAttribute('startTime', new three.InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
				this.particleBuffer_.setAttribute('uvLifeTimeFrameStart', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, UV_LIFE_TIME_FRAME_START_IDX));
				this.particleBuffer_.setAttribute('velocityStartSize', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, VELOCITY_START_SIZE_IDX));
				this.particleBuffer_.setAttribute('accelerationEndSize', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, ACCELERATION_END_SIZE_IDX));
				this.particleBuffer_.setAttribute('spinStartSpinSpeed', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, SPIN_START_SPIN_SPEED_IDX));
				this.particleBuffer_.setAttribute('orientation', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, ORIENTATION_IDX));
				this.particleBuffer_.setAttribute('colorMult', new three.InterleavedBufferAttribute(this.interleavedBuffer, 4, COLOR_MULT_IDX));
				this.particleBuffer_.computeBoundingSphere();
				var uniforms = {
					//world: { type: 'm4', value: this.matrixWorld },
					viewInverse: {
						type: 'm4',
						value: this.particleSystem.camera.matrixWorld
					},
					worldVelocity: {
						type: 'v3',
						value: null
					},
					worldAcceleration: {
						type: 'v3',
						value: null
					},
					timeRange: {
						type: 'f',
						value: null
					},
					time: {
						type: 'f',
						value: null
					},
					timeOffset: {
						type: 'f',
						value: null
					},
					frameDuration: {
						type: 'f',
						value: null
					},
					numFrames: {
						type: 'f',
						value: null
					},
					rampSampler: {
						type: "t",
						value: this.rampTexture_
					},
					colorSampler: {
						type: "t",
						value: this.colorTexture_
					}
				};
				var material = new three.ShaderMaterial({
					uniforms: uniforms,
					vertexShader: parameters.billboard ? billboardParticleInstancedVertexShader : orientedParticleInstancedVertexShader,
					fragmentShader: particleFragmentShader,
					side: this.billboard_ ? three.DoubleSide : three.FrontSide,
					blending: this.blendFunc_,
					depthTest: true,
					depthWrite: false,
					transparent: true
				});
				this.geometry = this.particleBuffer_;
				this.material = material;
			}
		}

		setParameters(parameters, opt_perParticleParamSetter) {
			this.validateParameters(parameters);
			var numParticles = parameters.numParticles;
			this.allocateParticles_(numParticles, parameters);
			this.createParticles_(0, numParticles, parameters, opt_perParticleParamSetter);
		}

		draw(world, viewProjection, timeOffset) {
			var uniforms = this.material.uniforms;
			uniforms.time.value = this.timeSource_();
			uniforms.timeOffset.value = timeOffset;
		}

		createOneShot() {
			return new OneShot(this, this.particleSystem.scene);
		}

		clone(object) {
			if (object === undefined) object = this.particleSystem.createParticleEmitter(this.colorTexture_, this.timeSource_);
			object.geometry = this.geometry;
			object.material = this.material.clone();
			object.material.uniforms.viewInverse.value = this.particleSystem.camera.matrixWorld;
			object.material.uniforms.rampSampler.value = this.rampTexture_;
			object.material.uniforms.colorSampler.value = this.colorTexture_;
			super.copy(object);
			return object;
		}

	}

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

	class Trail extends ParticleEmitter {
		constructor(particleSystem, maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock) {
			super(particleSystem, opt_texture, opt_clock);
			this.allocateParticles_(maxParticles, parameters);
			this.validateParameters(parameters);
			this.parameters = parameters;
			this.perParticleParamSetter = opt_perParticleParamSetter;
			this.birthIndex_ = 0;
			this.maxParticles_ = maxParticles;
		}

		birthParticles(position) {
			var numParticles = this.parameters.numParticles;
			this.parameters.startTime = this.timeSource_();
			this.parameters.position = position;

			while (this.birthIndex_ + numParticles >= this.maxParticles_) {
				var numParticlesToEnd = this.maxParticles_ - this.birthIndex_;
				this.createParticles_(this.birthIndex_, numParticlesToEnd, this.parameters, this.perParticleParamSetter);
				numParticles -= numParticlesToEnd;
				this.birthIndex_ = 0;
			}

			this.createParticles_(this.birthIndex_, numParticles, this.parameters, this.perParticleParamSetter);

			if (this.birthIndex_ === 0) {
				this.particleSystem.scene.add(this);
			}

			this.birthIndex_ += numParticles;
		}

	}

	// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

	class ParticleSystem {
		constructor(scene, camera, opt_clock, opt_randomFunction) {
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

		createTextureFromFloats(width, height, pixels, opt_texture) {
			var texture = null;

			if (opt_texture != null) {
				texture = opt_texture;
			} else {
				var data = new Uint8Array(pixels.length);
				var t;

				for (var i = 0; i < pixels.length; i++) {
					t = pixels[i] * 255.;
					data[i] = t;
				}

				texture = new three.DataTexture(data, width, height, three.RGBAFormat);
				texture.minFilter = three.LinearFilter;
				texture.magFilter = three.LinearFilter;
				texture.needsUpdate = true;
				return texture;
			}

			return texture;
		}

		createParticleEmitter(opt_texture, opt_clock) {
			var emitter = new ParticleEmitter(this, opt_texture, opt_clock);
			this.drawables_.push(emitter);
			return emitter;
		}

		createTrail(maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock) {
			var trail = new Trail(this, maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock);
			this.drawables_.push(trail);
			return trail;
		}

		draw(viewProjection, world, viewInverse) {
			this.now_ = new Date();

			for (var ii = 0; ii < this.drawables_.length; ++ii) {
				this.drawables_[ii].draw(world, viewProjection, 0);
			}
		}

	}

	exports.ACCELERATION_END_SIZE_IDX = ACCELERATION_END_SIZE_IDX;
	exports.COLOR_MULT_IDX = COLOR_MULT_IDX;
	exports.CORNERS_ = CORNERS_;
	exports.LAST_IDX = LAST_IDX;
	exports.ORIENTATION_IDX = ORIENTATION_IDX;
	exports.OneShot = OneShot;
	exports.POSITION_START_TIME_IDX = POSITION_START_TIME_IDX;
	exports.ParticleEmitter = ParticleEmitter;
	exports.ParticleSpec = ParticleSpec;
	exports.ParticleSystem = ParticleSystem;
	exports.SPIN_START_SPIN_SPEED_IDX = SPIN_START_SPIN_SPEED_IDX;
	exports.Trail = Trail;
	exports.UV_LIFE_TIME_FRAME_START_IDX = UV_LIFE_TIME_FRAME_START_IDX;
	exports.VELOCITY_START_SIZE_IDX = VELOCITY_START_SIZE_IDX;
	exports.createDefaultClock_ = createDefaultClock_;
	exports.singleParticleArray_ = singleParticleArray_;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtZ3B1LXBhcnRpY2xlLXN5c3RlbS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL2pzL2NvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9wYXJ0aWNsZS1zcGVjLmpzIiwiLi4vc3JjL2pzL29uZS1zaG90LmpzIiwiLi4vc3JjL2pzL2VtaXR0ZXIuanMiLCIuLi9zcmMvanMvdHJhaWwuanMiLCIuLi9zcmMvanMvcGFydGljbGUtc3lzdGVtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL2dyZWdnbWFuL3RkbC9ibG9iL21hc3Rlci90ZGwvcGFydGljbGVzLmpzXG4vLyBwb3J0ZWQgdG8gdGhyZWUuanMgYnkgZmF6ZWFjdGlvblxuXG5leHBvcnQgdmFyIENPUk5FUlNfID0gW1xuXG5cdFsgLSAwLjUsIC0gMC41IF0sXG5cdFsgKyAwLjUsIC0gMC41IF0sXG5cdFsgKyAwLjUsICsgMC41IF0sXG5cdFsgLSAwLjUsICsgMC41IF1cblxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRDbG9ja18gKCBwYXJ0aWNsZVN5c3RlbSApIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gKCkge1xuXG5cdFx0dmFyIG5vdyA9IHBhcnRpY2xlU3lzdGVtLm5vd187XG5cdFx0dmFyIGJhc2UgPSBwYXJ0aWNsZVN5c3RlbS50aW1lQmFzZV87XG5cblx0XHRyZXR1cm4gKCBub3cuZ2V0VGltZSgpIC0gYmFzZS5nZXRUaW1lKCkgKSAvIDEwMDAuMDtcblxuXHR9XG5cbn1cblxuZXhwb3J0IHZhciBQT1NJVElPTl9TVEFSVF9USU1FX0lEWCA9IDA7XG5leHBvcnQgdmFyIFVWX0xJRkVfVElNRV9GUkFNRV9TVEFSVF9JRFggPSA0O1xuZXhwb3J0IHZhciBWRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCA9IDg7XG5leHBvcnQgdmFyIEFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFggPSAxMjtcbmV4cG9ydCB2YXIgU1BJTl9TVEFSVF9TUElOX1NQRUVEX0lEWCA9IDE2O1xuZXhwb3J0IHZhciBPUklFTlRBVElPTl9JRFggPSAyMDtcbmV4cG9ydCB2YXIgQ09MT1JfTVVMVF9JRFggPSAyNDtcbmV4cG9ydCB2YXIgTEFTVF9JRFggPSAyODtcbmV4cG9ydCB2YXIgc2luZ2xlUGFydGljbGVBcnJheV8gPSBuZXcgRmxvYXQzMkFycmF5KCA0ICogTEFTVF9JRFggKTsiLCIvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi90ZGwvYmxvYi9tYXN0ZXIvdGRsL3BhcnRpY2xlcy5qc1xuLy8gcG9ydGVkIHRvIHRocmVlLmpzIGJ5IGZhemVhY3Rpb25cblxuZnVuY3Rpb24gUGFydGljbGVTcGVjICgpIHtcblxuXHR0aGlzLm51bVBhcnRpY2xlcyA9IDE7XG5cblx0dGhpcy5udW1GcmFtZXMgPSAxO1xuXG5cdHRoaXMuZnJhbWVEdXJhdGlvbiA9IDE7XG5cblx0dGhpcy5mcmFtZVN0YXJ0ID0gMDtcblxuXHR0aGlzLmZyYW1lU3RhcnRSYW5nZSA9IDA7XG5cblx0dGhpcy50aW1lUmFuZ2UgPSA5OTk5OTk5OTtcblxuXHR0aGlzLnN0YXJ0VGltZSA9IG51bGw7XG5cblx0dGhpcy5saWZlVGltZSA9IDE7XG5cblx0dGhpcy5saWZlVGltZVJhbmdlID0gMDtcblxuXHR0aGlzLnN0YXJ0U2l6ZSA9IDE7XG5cblx0dGhpcy5zdGFydFNpemVSYW5nZSA9IDA7XG5cblx0dGhpcy5lbmRTaXplID0gMTtcblxuXHR0aGlzLmVuZFNpemVSYW5nZSA9IDA7XG5cblx0dGhpcy5wb3NpdGlvbiA9IFsgMCwgMCwgMCBdO1xuXG5cdHRoaXMucG9zaXRpb25SYW5nZSA9IFsgMCwgMCwgMCBdO1xuXG5cdHRoaXMudmVsb2NpdHkgPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLnZlbG9jaXR5UmFuZ2UgPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLmFjY2VsZXJhdGlvbiA9IFsgMCwgMCwgMCBdO1xuXG5cdHRoaXMuYWNjZWxlcmF0aW9uUmFuZ2UgPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLnNwaW5TdGFydCA9IDA7XG5cblx0dGhpcy5zcGluU3RhcnRSYW5nZSA9IDA7XG5cblx0dGhpcy5zcGluU3BlZWQgPSAwO1xuXG5cdHRoaXMuc3BpblNwZWVkUmFuZ2UgPSAwO1xuXG5cdHRoaXMuY29sb3JNdWx0ID0gWyAxLCAxLCAxLCAxIF07XG5cblx0dGhpcy5jb2xvck11bHRSYW5nZSA9IFsgMCwgMCwgMCwgMCBdO1xuXG5cdHRoaXMud29ybGRWZWxvY2l0eSA9IFsgMCwgMCwgMCBdO1xuXG5cdHRoaXMud29ybGRBY2NlbGVyYXRpb24gPSBbIDAsIDAsIDAgXTtcblxuXHR0aGlzLmJpbGxib2FyZCA9IHRydWU7XG5cblx0dGhpcy5vcmllbnRhdGlvbiA9IFsgMCwgMCwgMCwgMSBdO1xuXG59XG5cbmV4cG9ydCB7UGFydGljbGVTcGVjfSIsIi8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL2dyZWdnbWFuL3RkbC9ibG9iL21hc3Rlci90ZGwvcGFydGljbGVzLmpzXG4vLyBwb3J0ZWQgdG8gdGhyZWUuanMgYnkgZmF6ZWFjdGlvblxuaW1wb3J0IHtcblx0TWVzaCxcblx0TWF0cml4NCxcblx0VmVjdG9yM1xufSBmcm9tICd0aHJlZSdcblxuY2xhc3MgT25lU2hvdCBleHRlbmRzIE1lc2gge1xuXHRjb25zdHJ1Y3RvcihlbWl0dGVyLCBzY2VuZSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5lbWl0dGVyXyA9IGVtaXR0ZXIuY2xvbmUoKTtcblx0XHR0aGlzLnNjZW5lID0gc2NlbmU7XG5cblx0XHR0aGlzLndvcmxkXyA9IG5ldyBNYXRyaXg0KCk7XG5cdFx0dGhpcy50ZW1wV29ybGRfID0gbmV3IE1hdHJpeDQoKTtcblx0XHR0aGlzLnRpbWVPZmZzZXRfID0gMDtcblx0XHR0aGlzLnZpc2libGVfID0gZmFsc2U7XG5cblx0XHQvLyBSZW1vdmUgdGhlIHBhcmVudCBlbWl0dGVyIGZyb20gdGhlIHBhcnRpY2xlIHN5c3RlbSdzIGRyYXdhYmxlXG5cdFx0Ly8gbGlzdCAoaWYgaXQncyBzdGlsbCB0aGVyZSkgYW5kIGFkZCBvdXJzZWx2ZXMgaW5zdGVhZC5cblx0XHR2YXIgcGFydGljbGVTeXN0ZW0gPSBlbWl0dGVyLnBhcnRpY2xlU3lzdGVtO1xuXHRcdHZhciBpZHggPSBwYXJ0aWNsZVN5c3RlbS5kcmF3YWJsZXNfLmluZGV4T2YodGhpcy5lbWl0dGVyXyk7XG5cdFx0aWYgKGlkeCA+PSAwKSB7XG5cblx0XHRcdHBhcnRpY2xlU3lzdGVtLmRyYXdhYmxlc18uc3BsaWNlKGlkeCwgMSk7XG5cblx0XHR9XG5cblx0XHRwYXJ0aWNsZVN5c3RlbS5kcmF3YWJsZXNfLnB1c2godGhpcyk7XG5cdH1cblxuXHR0cmlnZ2VyICggb3B0X3dvcmxkICkge1xuXG5cdFx0aWYgKCAhIHRoaXMudmlzaWJsZV8gKSB7XG5cblx0XHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLmVtaXR0ZXJfICk7XG5cblx0XHR9XG5cdFx0aWYgKCBvcHRfd29ybGQgKSB7XG5cblx0XHRcdHRoaXMuZW1pdHRlcl8ucG9zaXRpb24uY29weSggbmV3IFZlY3RvcjMoKS5mcm9tQXJyYXkoIG9wdF93b3JsZCApICk7XG5cblx0XHR9XG5cdFx0dGhpcy52aXNpYmxlXyA9IHRydWU7XG5cdFx0dGhpcy50aW1lT2Zmc2V0XyA9IHRoaXMuZW1pdHRlcl8udGltZVNvdXJjZV8oKTtcblxuXHR9XG5cblx0ZHJhdyAoIHdvcmxkLCB2aWV3UHJvamVjdGlvbiwgdGltZU9mZnNldCApIHtcblxuXHRcdGlmICggdGhpcy52aXNpYmxlXyApIHtcblxuXHRcdFx0Ly90aGlzLnRlbXBXb3JsZF8ubXVsdGlwbHlNYXRyaWNlcyh0aGlzLndvcmxkXywgd29ybGQpO1xuXHRcdFx0dGhpcy5lbWl0dGVyXy5kcmF3KCB0aGlzLndvcmxkXywgdmlld1Byb2plY3Rpb24sIHRoaXMudGltZU9mZnNldF8gKTtcblxuXHRcdH1cblxuXHR9XG5cbn1cblxuZXhwb3J0IHtPbmVTaG90fVxuIiwiLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vZ3JlZ2dtYW4vdGRsL2Jsb2IvbWFzdGVyL3RkbC9wYXJ0aWNsZXMuanNcbi8vIHBvcnRlZCB0byB0aHJlZS5qcyBieSBmYXplYWN0aW9uXG5pbXBvcnQge1xuXHRNZXNoLFxuXHRCdWZmZXJBdHRyaWJ1dGUsXG5cdEJ1ZmZlckdlb21ldHJ5LFxuXHRJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSxcblx0SW5zdGFuY2VkSW50ZXJsZWF2ZWRCdWZmZXIsXG5cdEluc3RhbmNlZEJ1ZmZlckdlb21ldHJ5LFxuXHRJbnRlcmxlYXZlZEJ1ZmZlcixcblx0Tm9ybWFsQmxlbmRpbmcsXG5cdFZlY3RvcjMsXG5cdFZlY3RvcjQsXG5cdFNwaGVyZSxcblx0U2hhZGVyTWF0ZXJpYWwsXG5cdERvdWJsZVNpZGUsXG5cdEZyb250U2lkZSxcblx0RHluYW1pY0RyYXdVc2FnZVxufSBmcm9tICd0aHJlZSdcblxuaW1wb3J0ICogYXMgQ29uc3RhbnRzICBmcm9tICcuL2NvbnN0YW50cy5qcydcbmltcG9ydCB7UGFydGljbGVTcGVjfSBmcm9tICcuL3BhcnRpY2xlLXNwZWMuanMnXG5pbXBvcnQge09uZVNob3R9IGZyb20gJy4vb25lLXNob3QuanMnXG5pbXBvcnQgYmlsbGJvYXJkUGFydGljbGVJbnN0YW5jZWRWZXJ0ZXhTaGFkZXIgZnJvbSAnLi8uLi9zaGFkZXJzL3BhcnRpY2xlcy1iaWxsYm9hcmQtaW5zdGFuY2VkX3ZzLmdsc2wnXG5pbXBvcnQgb3JpZW50ZWRQYXJ0aWNsZUluc3RhbmNlZFZlcnRleFNoYWRlciBmcm9tICcuLy4uL3NoYWRlcnMvcGFydGljbGVzLW9yaWVudGVkLWluc3RhbmNlZF92cy5nbHNsJ1xuaW1wb3J0IHBhcnRpY2xlRnJhZ21lbnRTaGFkZXIgZnJvbSAnLi8uLi9zaGFkZXJzL3BhcnRpY2xlc19mcy5nbHNsJ1xuXG5jbGFzcyBQYXJ0aWNsZUVtaXR0ZXIgZXh0ZW5kcyBNZXNoIHtcblx0Y29uc3RydWN0b3IoIHBhcnRpY2xlU3lzdGVtLCBvcHRfdGV4dHVyZSwgb3B0X2Nsb2NrICkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRvcHRfY2xvY2sgPSBvcHRfY2xvY2sgfHwgcGFydGljbGVTeXN0ZW0udGltZVNvdXJjZV87XG5cblx0XHQvL1RPRE8gbWFrZSBhbHRlcm5hdGl2ZSB0byBpbnN0YW5jZWQgYnVmZmVyXG5cdFx0Ly90aGlzLnBhcnRpY2xlQnVmZmVyXyA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdC8vdGhpcy5pbmRleEJ1ZmZlcl8gPSBbXTtcblxuXHRcdHRoaXMucGFydGljbGVCdWZmZXJfID0gbmV3IEluc3RhbmNlZEJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5pbnRlcmxlYXZlZEJ1ZmZlciA9IG5ldyBJbnRlcmxlYXZlZEJ1ZmZlcigpO1xuXG5cdFx0dGhpcy5udW1QYXJ0aWNsZXNfID0gMDtcblxuXHRcdHRoaXMucmFtcFRleHR1cmVfID0gcGFydGljbGVTeXN0ZW0uZGVmYXVsdFJhbXBUZXh0dXJlO1xuXHRcdHRoaXMuY29sb3JUZXh0dXJlXyA9IG9wdF90ZXh0dXJlIHx8IHBhcnRpY2xlU3lzdGVtLmRlZmF1bHRDb2xvclRleHR1cmU7XG5cblx0XHR0aGlzLnBhcnRpY2xlU3lzdGVtID0gcGFydGljbGVTeXN0ZW07XG5cblx0XHR0aGlzLnRpbWVTb3VyY2VfID0gb3B0X2Nsb2NrO1xuXG5cdFx0dGhpcy5zZXRTdGF0ZShOb3JtYWxCbGVuZGluZyk7XG5cdH1cblxuXHRzZXRUcmFuc2xhdGlvbiAoIHgsIHksIHogKSB7XG5cblx0XHR0aGlzLnBvc2l0aW9uLnggPSB4O1xuXHRcdHRoaXMucG9zaXRpb24ueSA9IHk7XG5cdFx0dGhpcy5wb3NpdGlvbi56ID0gejtcblxuXHR9XG5cblx0c2V0U3RhdGUgKCBzdGF0ZUlkICkge1xuXG5cdFx0dGhpcy5ibGVuZEZ1bmNfID0gc3RhdGVJZDtcblxuXHR9XG5cblx0c2V0Q29sb3JSYW1wICggY29sb3JSYW1wICkge1xuXG5cdFx0dmFyIHdpZHRoID0gY29sb3JSYW1wLmxlbmd0aCAvIDQ7XG5cdFx0aWYgKHdpZHRoICUgMSAhPSAwKSB7XG5cblx0XHRcdHRocm93ICdjb2xvclJhbXAgbXVzdCBoYXZlIG11bHRpcGxlIG9mIDQgZW50cmllcyc7XG5cblx0XHR9XG5cblx0XHRpZiAodGhpcy5yYW1wVGV4dHVyZV8gPT0gdGhpcy5wYXJ0aWNsZVN5c3RlbS5kZWZhdWx0UmFtcFRleHR1cmUpIHtcblxuXHRcdFx0dGhpcy5yYW1wVGV4dHVyZV8gPSBudWxsO1xuXG5cdFx0fVxuXG5cdFx0dGhpcy5yYW1wVGV4dHVyZV8gPSB0aGlzLnBhcnRpY2xlU3lzdGVtLmNyZWF0ZVRleHR1cmVGcm9tRmxvYXRzKCB3aWR0aCwgMSwgY29sb3JSYW1wLCB0aGlzLnJhbXBUZXh0dXJlXyApO1xuXG5cdH1cblxuXHR2YWxpZGF0ZVBhcmFtZXRlcnMgKCBwYXJhbWV0ZXJzICkge1xuXG5cdFx0dmFyIGRlZmF1bHRzID0gbmV3IFBhcnRpY2xlU3BlYygpO1xuXG5cdFx0Zm9yICggdmFyIGtleSBpbiBwYXJhbWV0ZXJzICkge1xuXG5cdFx0XHRpZiAoIHR5cGVvZiBkZWZhdWx0c1sga2V5IF0gPT09ICd1bmRlZmluZWQnICkge1xuXG5cdFx0XHRcdHRocm93ICd1bmtub3duIHBhcnRpY2xlIHBhcmFtZXRlciBcIicgKyBrZXkgKyAnXCInO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRmb3IgKCB2YXIga2V5IGluIGRlZmF1bHRzICkge1xuXG5cdFx0XHRpZiAoIHR5cGVvZiBwYXJhbWV0ZXJzWyBrZXkgXSA9PT0gJ3VuZGVmaW5lZCcgKSB7XG5cblx0XHRcdFx0cGFyYW1ldGVyc1sga2V5IF0gPSBkZWZhdWx0c1sga2V5IF07XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHR9XG5cblx0Y3JlYXRlUGFydGljbGVzXyAoIGZpcnN0UGFydGljbGVJbmRleCwgbnVtUGFydGljbGVzLCBwYXJhbWV0ZXJzLCBvcHRfcGVyUGFydGljbGVQYXJhbVNldHRlciApIHtcblxuXHRcdHZhciBpbnRlcmxlYXZlQnVmZmVyRGF0YSA9IHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIuYXJyYXk7XG5cblx0XHR0aGlzLmJpbGxib2FyZF8gPSBwYXJhbWV0ZXJzLmJpbGxib2FyZDtcblxuXHRcdHZhciByYW5kb20gPSB0aGlzLnBhcnRpY2xlU3lzdGVtLnJhbmRvbUZ1bmN0aW9uXztcblxuXHRcdHZhciBwbHVzTWludXMgPSBmdW5jdGlvbiAoIHJhbmdlICkge1xuXG5cdFx0XHRyZXR1cm4gKCByYW5kb20oKSAtIDAuNSApICogcmFuZ2UgKiAyO1xuXG5cdFx0fTtcblxuXHRcdC8vIFRPRE86IGNoYW5nZSB0byBub3QgYWxsb2NhdGUuXG5cdFx0dmFyIHBsdXNNaW51c1ZlY3RvciA9IGZ1bmN0aW9uICggcmFuZ2UgKSB7XG5cblx0XHRcdHZhciB2ID0gW107XG5cblx0XHRcdGZvciAodmFyIGlpID0gMDsgaWkgPCByYW5nZS5sZW5ndGg7ICsrIGlpKSB7XG5cblx0XHRcdFx0di5wdXNoKCBwbHVzTWludXMoIHJhbmdlWyBpaSBdICkgKTtcblxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdjtcblxuXHRcdH07XG5cblx0XHRmb3IgKCB2YXIgaWkgPSAwOyBpaSA8IG51bVBhcnRpY2xlczsgKysgaWkgKSB7XG5cblx0XHRcdGlmICggb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKSB7XG5cblx0XHRcdFx0b3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIoIGlpLCBwYXJhbWV0ZXJzICk7XG5cblx0XHRcdH1cblxuXHRcdFx0dmFyIHBMaWZlVGltZSA9IHBhcmFtZXRlcnMubGlmZVRpbWU7XG5cdFx0XHR2YXIgcFN0YXJ0VGltZSA9ICggcGFyYW1ldGVycy5zdGFydFRpbWUgPT09IG51bGwgKSA/ICggaWkgKiBwYXJhbWV0ZXJzLmxpZmVUaW1lIC8gbnVtUGFydGljbGVzICkgOiBwYXJhbWV0ZXJzLnN0YXJ0VGltZTtcblx0XHRcdHZhciBwRnJhbWVTdGFydCA9IHBhcmFtZXRlcnMuZnJhbWVTdGFydCArIHBsdXNNaW51cyhwYXJhbWV0ZXJzLmZyYW1lU3RhcnRSYW5nZSk7XG5cdFx0XHR2YXIgcFBvc2l0aW9uID0gbmV3IFZlY3RvcjMoKS5hZGRWZWN0b3JzKCBuZXcgVmVjdG9yMygpLmZyb21BcnJheShwYXJhbWV0ZXJzLnBvc2l0aW9uKSwgbmV3IFZlY3RvcjMoKS5mcm9tQXJyYXkocGx1c01pbnVzVmVjdG9yKHBhcmFtZXRlcnMucG9zaXRpb25SYW5nZSkpKTtcblx0XHRcdHZhciBwVmVsb2NpdHkgPSBuZXcgVmVjdG9yMygpLmFkZFZlY3RvcnMoIG5ldyBWZWN0b3IzKCkuZnJvbUFycmF5KHBhcmFtZXRlcnMudmVsb2NpdHkpLCBuZXcgVmVjdG9yMygpLmZyb21BcnJheShwbHVzTWludXNWZWN0b3IocGFyYW1ldGVycy52ZWxvY2l0eVJhbmdlKSkpO1xuXHRcdFx0dmFyIHBBY2NlbGVyYXRpb24gPSBuZXcgVmVjdG9yMygpLmFkZFZlY3RvcnMoIG5ldyBWZWN0b3IzKCkuZnJvbUFycmF5KHBhcmFtZXRlcnMuYWNjZWxlcmF0aW9uKSwgbmV3IFZlY3RvcjMoKS5mcm9tQXJyYXkoIHBsdXNNaW51c1ZlY3RvciggcGFyYW1ldGVycy5hY2NlbGVyYXRpb25SYW5nZSApKSk7XG5cdFx0XHR2YXIgcENvbG9yTXVsdCA9IG5ldyBWZWN0b3I0KCkuYWRkVmVjdG9ycyggbmV3IFZlY3RvcjQoKS5mcm9tQXJyYXkocGFyYW1ldGVycy5jb2xvck11bHQpLCBuZXcgVmVjdG9yNCgpLmZyb21BcnJheShwbHVzTWludXNWZWN0b3IoIHBhcmFtZXRlcnMuY29sb3JNdWx0UmFuZ2UgKSkpO1xuXHRcdFx0dmFyIHBTcGluU3RhcnQgPSBwYXJhbWV0ZXJzLnNwaW5TdGFydCArIHBsdXNNaW51cyhwYXJhbWV0ZXJzLnNwaW5TdGFydFJhbmdlKTtcblx0XHRcdHZhciBwU3BpblNwZWVkID0gcGFyYW1ldGVycy5zcGluU3BlZWQgKyBwbHVzTWludXMocGFyYW1ldGVycy5zcGluU3BlZWRSYW5nZSk7XG5cdFx0XHR2YXIgcFN0YXJ0U2l6ZSA9IHBhcmFtZXRlcnMuc3RhcnRTaXplICsgcGx1c01pbnVzKHBhcmFtZXRlcnMuc3RhcnRTaXplUmFuZ2UpO1xuXHRcdFx0dmFyIHBFbmRTaXplID0gcGFyYW1ldGVycy5lbmRTaXplICsgcGx1c01pbnVzKHBhcmFtZXRlcnMuZW5kU2l6ZVJhbmdlKTtcblx0XHRcdHZhciBwT3JpZW50YXRpb24gPSBuZXcgVmVjdG9yNCgpLmZyb21BcnJheShwYXJhbWV0ZXJzLm9yaWVudGF0aW9uKTtcblxuXHRcdFx0Zm9yICh2YXIgamogPSAwOyBqaiA8IDE7ICsramopIHtcblxuXHRcdFx0XHR2YXIgb2Zmc2V0MCA9IENvbnN0YW50cy5MQVNUX0lEWCAqIGpqICsgKCBpaSAqIENvbnN0YW50cy5MQVNUX0lEWCAqIDQgKSArICggZmlyc3RQYXJ0aWNsZUluZGV4ICogQ29uc3RhbnRzLkxBU1RfSURYICogNCApO1xuXHRcdFx0XHR2YXIgb2Zmc2V0MSA9IG9mZnNldDAgKyAxO1xuXHRcdFx0XHR2YXIgb2Zmc2V0MiA9IG9mZnNldDAgKyAyO1xuXHRcdFx0XHR2YXIgb2Zmc2V0MyA9IG9mZnNldDAgKyAzO1xuXG5cblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlBPU0lUSU9OX1NUQVJUX1RJTUVfSURYICsgb2Zmc2V0MF0gPSBwUG9zaXRpb24ueDtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlBPU0lUSU9OX1NUQVJUX1RJTUVfSURYICsgb2Zmc2V0MV0gPSBwUG9zaXRpb24ueTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlBPU0lUSU9OX1NUQVJUX1RJTUVfSURYICsgb2Zmc2V0Ml0gPSBwUG9zaXRpb24uejtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlBPU0lUSU9OX1NUQVJUX1RJTUVfSURYICsgb2Zmc2V0M10gPSBwU3RhcnRUaW1lO1xuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5VVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYICsgb2Zmc2V0MF0gPSBDb25zdGFudHMuQ09STkVSU19bampdWzBdO1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuVVZfTElGRV9USU1FX0ZSQU1FX1NUQVJUX0lEWCArIG9mZnNldDFdID0gQ29uc3RhbnRzLkNPUk5FUlNfW2pqXVsxXTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlVWX0xJRkVfVElNRV9GUkFNRV9TVEFSVF9JRFggKyBvZmZzZXQyXSA9IHBMaWZlVGltZTtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlVWX0xJRkVfVElNRV9GUkFNRV9TVEFSVF9JRFggKyBvZmZzZXQzXSA9IHBGcmFtZVN0YXJ0O1xuXG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCArIG9mZnNldDBdID0gcFZlbG9jaXR5Lng7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCArIG9mZnNldDFdID0gcFZlbG9jaXR5Lnk7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCArIG9mZnNldDJdID0gcFZlbG9jaXR5Lno7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCArIG9mZnNldDNdID0gcFN0YXJ0U2l6ZTtcblxuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQUNDRUxFUkFUSU9OX0VORF9TSVpFX0lEWCArIG9mZnNldDBdID0gcEFjY2VsZXJhdGlvbi54O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQUNDRUxFUkFUSU9OX0VORF9TSVpFX0lEWCArIG9mZnNldDFdID0gcEFjY2VsZXJhdGlvbi55O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQUNDRUxFUkFUSU9OX0VORF9TSVpFX0lEWCArIG9mZnNldDJdID0gcEFjY2VsZXJhdGlvbi56O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQUNDRUxFUkFUSU9OX0VORF9TSVpFX0lEWCArIG9mZnNldDNdID0gcEVuZFNpemU7XG5cblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFggKyBvZmZzZXQwXSA9IHBTcGluU3RhcnQ7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5TUElOX1NUQVJUX1NQSU5fU1BFRURfSURYICsgb2Zmc2V0MV0gPSBwU3BpblNwZWVkO1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuU1BJTl9TVEFSVF9TUElOX1NQRUVEX0lEWCArIG9mZnNldDJdID0gMDtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFggKyBvZmZzZXQzXSA9IDA7XG5cblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLk9SSUVOVEFUSU9OX0lEWCArIG9mZnNldDBdID0gcE9yaWVudGF0aW9uLng7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5PUklFTlRBVElPTl9JRFggKyBvZmZzZXQxXSA9IHBPcmllbnRhdGlvbi55O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuT1JJRU5UQVRJT05fSURYICsgb2Zmc2V0Ml0gPSBwT3JpZW50YXRpb24uejtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLk9SSUVOVEFUSU9OX0lEWCArIG9mZnNldDNdID0gcE9yaWVudGF0aW9uLnc7XG5cblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkNPTE9SX01VTFRfSURYICsgb2Zmc2V0MF0gPSBwQ29sb3JNdWx0Lng7XG5cdFx0XHRcdGludGVybGVhdmVCdWZmZXJEYXRhW0NvbnN0YW50cy5DT0xPUl9NVUxUX0lEWCArIG9mZnNldDFdID0gcENvbG9yTXVsdC55O1xuXHRcdFx0XHRpbnRlcmxlYXZlQnVmZmVyRGF0YVtDb25zdGFudHMuQ09MT1JfTVVMVF9JRFggKyBvZmZzZXQyXSA9IHBDb2xvck11bHQuejtcblx0XHRcdFx0aW50ZXJsZWF2ZUJ1ZmZlckRhdGFbQ29uc3RhbnRzLkNPTE9SX01VTFRfSURYICsgb2Zmc2V0M10gPSBwQ29sb3JNdWx0Lnc7XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5tYXRlcmlhbC51bmlmb3Jtcy53b3JsZFZlbG9jaXR5LnZhbHVlID0gbmV3IFZlY3RvcjMocGFyYW1ldGVycy53b3JsZFZlbG9jaXR5WzBdLCBwYXJhbWV0ZXJzLndvcmxkVmVsb2NpdHlbMV0sIHBhcmFtZXRlcnMud29ybGRWZWxvY2l0eVsyXSk7XG5cdFx0dGhpcy5tYXRlcmlhbC51bmlmb3Jtcy53b3JsZEFjY2VsZXJhdGlvbi52YWx1ZSA9IG5ldyBWZWN0b3IzKHBhcmFtZXRlcnMud29ybGRBY2NlbGVyYXRpb25bMF0sIHBhcmFtZXRlcnMud29ybGRBY2NlbGVyYXRpb25bMV0sIHBhcmFtZXRlcnMud29ybGRBY2NlbGVyYXRpb25bMl0pO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMudGltZVJhbmdlLnZhbHVlID0gcGFyYW1ldGVycy50aW1lUmFuZ2U7XG5cdFx0dGhpcy5tYXRlcmlhbC51bmlmb3Jtcy5mcmFtZUR1cmF0aW9uLnZhbHVlID0gcGFyYW1ldGVycy5mcmFtZUR1cmF0aW9uO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMubnVtRnJhbWVzLnZhbHVlID0gcGFyYW1ldGVycy5udW1GcmFtZXM7XG5cdFx0dGhpcy5tYXRlcmlhbC51bmlmb3Jtcy5yYW1wU2FtcGxlci52YWx1ZSA9IHRoaXMucmFtcFRleHR1cmVfO1xuXHRcdHRoaXMubWF0ZXJpYWwudW5pZm9ybXMuY29sb3JTYW1wbGVyLnZhbHVlID0gdGhpcy5jb2xvclRleHR1cmVfO1xuXG5cdFx0dGhpcy5tYXRlcmlhbC5ibGVuZGluZyA9IHRoaXMuYmxlbmRGdW5jXztcblxuXHR9XG5cblx0YWxsb2NhdGVQYXJ0aWNsZXNfICggbnVtUGFydGljbGVzLCBwYXJhbWV0ZXJzICkge1xuXG5cdFx0aWYgKCB0aGlzLm51bVBhcnRpY2xlc18gIT0gbnVtUGFydGljbGVzICkge1xuXG5cdFx0XHR2YXIgbnVtSW5kaWNlcyA9IDYgKiBudW1QYXJ0aWNsZXM7XG5cblx0XHRcdGlmIChudW1JbmRpY2VzID4gNjU1MzYgJiYgQnVmZmVyR2VvbWV0cnkuTWF4SW5kZXggPCA2NTUzNikge1xuXG5cdFx0XHRcdHRocm93IFwiY2FuJ3QgaGF2ZSBtb3JlIHRoYW4gMTA5MjIgcGFydGljbGVzIHBlciBlbWl0dGVyXCI7XG5cblx0XHRcdH1cblxuXHRcdFx0dmFyIHZlcnRleEJ1ZmZlciA9IG5ldyBJbnRlcmxlYXZlZEJ1ZmZlciggbmV3IEZsb2F0MzJBcnJheShbXG5cdFx0XHRcdC8vIEZyb250XG5cdFx0XHRcdDAsIDAsIDAsIDAsIC0wLjUsIC0wLjUsIDAsIDAsXG5cdFx0XHRcdDAsIDAsIDAsIDAsIDAuNSwgLTAuNSwgMCwgMCxcblx0XHRcdFx0MCwgMCwgMCwgMCwgMC41LCAwLjUsIDAsIDAsXG5cdFx0XHRcdDAsIDAsIDAsIDAsIC0wLjUsIDAuNSwgMCwgMFxuXHRcdFx0XSksIDgpO1xuXG5cblx0XHRcdC8vIFVzZSB2ZXJ0ZXhCdWZmZXIsIHN0YXJ0aW5nIGF0IG9mZnNldCAwLCAzIGl0ZW1zIGluIHBvc2l0aW9uIGF0dHJpYnV0ZVxuXHRcdFx0dmFyIHBvc2l0aW9ucyA9IG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSggdmVydGV4QnVmZmVyLCAzLCAwICk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIHBvc2l0aW9ucyApO1xuXHRcdFx0Ly8gVXNlIHZlcnRleEJ1ZmZlciwgc3RhcnRpbmcgYXQgb2Zmc2V0IDQsIDIgaXRlbXMgaW4gdXYgYXR0cmlidXRlXG5cdFx0XHR2YXIgdXZzID0gbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKCB2ZXJ0ZXhCdWZmZXIsIDIsIDQgKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ3V2JywgdXZzICk7XG5cblx0XHRcdHZhciBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KFtcblxuXHRcdFx0XHQwLCAxLCAyLFxuXHRcdFx0XHQwLCAyLCAzXG5cblx0XHRcdF0pO1xuXG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRJbmRleCggbmV3IEJ1ZmZlckF0dHJpYnV0ZSggaW5kaWNlcywgMSApICk7XG5cblx0XHRcdHRoaXMubnVtUGFydGljbGVzXyA9IG51bVBhcnRpY2xlcztcblx0XHRcdHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIgPSBuZXcgSW5zdGFuY2VkSW50ZXJsZWF2ZWRCdWZmZXIoIG5ldyBGbG9hdDMyQXJyYXkoIG51bVBhcnRpY2xlcyAqIENvbnN0YW50cy5zaW5nbGVQYXJ0aWNsZUFycmF5Xy5ieXRlTGVuZ3RoICksIENvbnN0YW50cy5MQVNUX0lEWCwgMSApLnNldFVzYWdlKCBEeW5hbWljRHJhd1VzYWdlICk7XG5cblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDMsIENvbnN0YW50cy5QT1NJVElPTl9TVEFSVF9USU1FX0lEWCkpO1xuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0QXR0cmlidXRlKCAnc3RhcnRUaW1lJywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDEsIDMpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ3V2TGlmZVRpbWVGcmFtZVN0YXJ0JywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDQsIENvbnN0YW50cy5VVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYKSk7XG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5zZXRBdHRyaWJ1dGUoICd2ZWxvY2l0eVN0YXJ0U2l6ZScsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCA0LCBDb25zdGFudHMuVkVMT0NJVFlfU1RBUlRfU0laRV9JRFgpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ2FjY2VsZXJhdGlvbkVuZFNpemUnLCBuZXcgSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUodGhpcy5pbnRlcmxlYXZlZEJ1ZmZlciwgNCwgQ29uc3RhbnRzLkFDQ0VMRVJBVElPTl9FTkRfU0laRV9JRFgpKTtcblx0XHRcdHRoaXMucGFydGljbGVCdWZmZXJfLnNldEF0dHJpYnV0ZSggJ3NwaW5TdGFydFNwaW5TcGVlZCcsIG5ldyBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSh0aGlzLmludGVybGVhdmVkQnVmZmVyLCA0LCBDb25zdGFudHMuU1BJTl9TVEFSVF9TUElOX1NQRUVEX0lEWCkpO1xuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0QXR0cmlidXRlKCAnb3JpZW50YXRpb24nLCBuZXcgSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUodGhpcy5pbnRlcmxlYXZlZEJ1ZmZlciwgNCwgQ29uc3RhbnRzLk9SSUVOVEFUSU9OX0lEWCkpO1xuXHRcdFx0dGhpcy5wYXJ0aWNsZUJ1ZmZlcl8uc2V0QXR0cmlidXRlKCAnY29sb3JNdWx0JywgbmV3IEludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKHRoaXMuaW50ZXJsZWF2ZWRCdWZmZXIsIDQsIENvbnN0YW50cy5DT0xPUl9NVUxUX0lEWCkpO1xuXG5cdFx0XHR0aGlzLnBhcnRpY2xlQnVmZmVyXy5jb21wdXRlQm91bmRpbmdTcGhlcmUoKTtcblxuXHRcdFx0dmFyIHVuaWZvcm1zID0ge1xuXG5cdFx0XHRcdC8vd29ybGQ6IHsgdHlwZTogJ200JywgdmFsdWU6IHRoaXMubWF0cml4V29ybGQgfSxcblx0XHRcdFx0dmlld0ludmVyc2U6IHsgdHlwZTogJ200JywgdmFsdWU6IHRoaXMucGFydGljbGVTeXN0ZW0uY2FtZXJhLm1hdHJpeFdvcmxkIH0sXG5cdFx0XHRcdHdvcmxkVmVsb2NpdHk6IHsgdHlwZTogJ3YzJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0d29ybGRBY2NlbGVyYXRpb246IHsgdHlwZTogJ3YzJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0dGltZVJhbmdlOiB7IHR5cGU6ICdmJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0dGltZTogeyB0eXBlOiAnZicsIHZhbHVlOiBudWxsIH0sXG5cdFx0XHRcdHRpbWVPZmZzZXQ6IHsgdHlwZTogJ2YnLCB2YWx1ZTogbnVsbCB9LFxuXHRcdFx0XHRmcmFtZUR1cmF0aW9uOiB7IHR5cGU6ICdmJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0bnVtRnJhbWVzOiB7IHR5cGU6ICdmJywgdmFsdWU6IG51bGwgfSxcblx0XHRcdFx0cmFtcFNhbXBsZXI6IHsgdHlwZTogXCJ0XCIsIHZhbHVlOiB0aGlzLnJhbXBUZXh0dXJlXyB9LFxuXHRcdFx0XHRjb2xvclNhbXBsZXI6IHsgdHlwZTogXCJ0XCIsIHZhbHVlOiB0aGlzLmNvbG9yVGV4dHVyZV8gfVxuXG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgbWF0ZXJpYWwgPSBuZXcgU2hhZGVyTWF0ZXJpYWwoe1xuXG5cdFx0XHRcdHVuaWZvcm1zOiB1bmlmb3Jtcyxcblx0XHRcdFx0dmVydGV4U2hhZGVyOiAoIHBhcmFtZXRlcnMuYmlsbGJvYXJkICkgPyBiaWxsYm9hcmRQYXJ0aWNsZUluc3RhbmNlZFZlcnRleFNoYWRlciA6IG9yaWVudGVkUGFydGljbGVJbnN0YW5jZWRWZXJ0ZXhTaGFkZXIsXG5cdFx0XHRcdGZyYWdtZW50U2hhZGVyOiBwYXJ0aWNsZUZyYWdtZW50U2hhZGVyLFxuXHRcdFx0XHRzaWRlOiAodGhpcy5iaWxsYm9hcmRfKT8gRG91YmxlU2lkZSA6IEZyb250U2lkZSxcblx0XHRcdFx0YmxlbmRpbmc6IHRoaXMuYmxlbmRGdW5jXyxcblx0XHRcdFx0ZGVwdGhUZXN0OiB0cnVlLFxuXHRcdFx0XHRkZXB0aFdyaXRlOiBmYWxzZSxcblx0XHRcdFx0dHJhbnNwYXJlbnQ6IHRydWVcblxuXHRcdFx0fSk7XG5cblxuXHRcdFx0dGhpcy5nZW9tZXRyeSA9IHRoaXMucGFydGljbGVCdWZmZXJfO1xuXHRcdFx0dGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuXG5cdFx0fVxuXG5cdH1cblxuXHRzZXRQYXJhbWV0ZXJzICggcGFyYW1ldGVycywgb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKSB7XG5cblx0XHR0aGlzLnZhbGlkYXRlUGFyYW1ldGVycyAoIHBhcmFtZXRlcnMgKTtcblxuXHRcdHZhciBudW1QYXJ0aWNsZXMgPSBwYXJhbWV0ZXJzLm51bVBhcnRpY2xlcztcblxuXHRcdHRoaXMuYWxsb2NhdGVQYXJ0aWNsZXNfICggbnVtUGFydGljbGVzLCBwYXJhbWV0ZXJzICk7XG5cdFx0dGhpcy5jcmVhdGVQYXJ0aWNsZXNfICggMCwgbnVtUGFydGljbGVzLCBwYXJhbWV0ZXJzLCBvcHRfcGVyUGFydGljbGVQYXJhbVNldHRlciApO1xuXG5cdH1cblxuXHRkcmF3ICggd29ybGQsIHZpZXdQcm9qZWN0aW9uLCB0aW1lT2Zmc2V0ICkge1xuXG5cdFx0dmFyIHVuaWZvcm1zID0gdGhpcy5tYXRlcmlhbC51bmlmb3JtcztcblxuXHRcdHVuaWZvcm1zLnRpbWUudmFsdWUgPSB0aGlzLnRpbWVTb3VyY2VfKCk7XG5cdFx0dW5pZm9ybXMudGltZU9mZnNldC52YWx1ZSA9IHRpbWVPZmZzZXQ7XG5cblx0fVxuXG5cdGNyZWF0ZU9uZVNob3QgKCkge1xuXG5cdFx0cmV0dXJuIG5ldyBPbmVTaG90KCB0aGlzLCB0aGlzLnBhcnRpY2xlU3lzdGVtLnNjZW5lICk7XG5cblx0fVxuXG5cdGNsb25lICggb2JqZWN0ICkge1xuXG5cdFx0aWYgKCBvYmplY3QgPT09IHVuZGVmaW5lZCApIG9iamVjdCA9IHRoaXMucGFydGljbGVTeXN0ZW0uY3JlYXRlUGFydGljbGVFbWl0dGVyKCB0aGlzLmNvbG9yVGV4dHVyZV8sIHRoaXMudGltZVNvdXJjZV8pO1xuXG5cdFx0b2JqZWN0Lmdlb21ldHJ5ID0gdGhpcy5nZW9tZXRyeTtcblx0XHRvYmplY3QubWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsLmNsb25lKCk7XG5cdFx0b2JqZWN0Lm1hdGVyaWFsLnVuaWZvcm1zLnZpZXdJbnZlcnNlLnZhbHVlID0gdGhpcy5wYXJ0aWNsZVN5c3RlbS5jYW1lcmEubWF0cml4V29ybGQ7XG5cdFx0b2JqZWN0Lm1hdGVyaWFsLnVuaWZvcm1zLnJhbXBTYW1wbGVyLnZhbHVlID0gdGhpcy5yYW1wVGV4dHVyZV87XG5cdFx0b2JqZWN0Lm1hdGVyaWFsLnVuaWZvcm1zLmNvbG9yU2FtcGxlci52YWx1ZSA9IHRoaXMuY29sb3JUZXh0dXJlXztcblxuXHRcdHN1cGVyLmNvcHkoIG9iamVjdCApO1xuXG5cdFx0cmV0dXJuIG9iamVjdDtcblxuXHR9XG5cbn1cblxuZXhwb3J0IHsgUGFydGljbGVFbWl0dGVyIH0iLCIvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi90ZGwvYmxvYi9tYXN0ZXIvdGRsL3BhcnRpY2xlcy5qc1xuLy8gcG9ydGVkIHRvIHRocmVlLmpzIGJ5IGZhemVhY3Rpb25cblxuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi9lbWl0dGVyLmpzJ1xuXG5jbGFzcyBUcmFpbCBleHRlbmRzIFBhcnRpY2xlRW1pdHRlciB7XG5cdGNvbnN0cnVjdG9yKCBwYXJ0aWNsZVN5c3RlbSwgbWF4UGFydGljbGVzLCBwYXJhbWV0ZXJzLCBvcHRfdGV4dHVyZSwgb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXIsIG9wdF9jbG9jayApXHR7XG5cdFx0c3VwZXIocGFydGljbGVTeXN0ZW0sIG9wdF90ZXh0dXJlLCBvcHRfY2xvY2spO1xuXG5cdFx0dGhpcy5hbGxvY2F0ZVBhcnRpY2xlc18obWF4UGFydGljbGVzLCBwYXJhbWV0ZXJzKTtcblx0XHR0aGlzLnZhbGlkYXRlUGFyYW1ldGVycyhwYXJhbWV0ZXJzKTtcblxuXHRcdHRoaXMucGFyYW1ldGVycyA9IHBhcmFtZXRlcnM7XG5cdFx0dGhpcy5wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyID0gb3B0X3BlclBhcnRpY2xlUGFyYW1TZXR0ZXI7XG5cdFx0dGhpcy5iaXJ0aEluZGV4XyA9IDA7XG5cdFx0dGhpcy5tYXhQYXJ0aWNsZXNfID0gbWF4UGFydGljbGVzO1xuXHR9XG5cblx0YmlydGhQYXJ0aWNsZXMgKCBwb3NpdGlvbiApIHtcblxuXHRcdHZhciBudW1QYXJ0aWNsZXMgPSB0aGlzLnBhcmFtZXRlcnMubnVtUGFydGljbGVzO1xuXHRcdHRoaXMucGFyYW1ldGVycy5zdGFydFRpbWUgPSB0aGlzLnRpbWVTb3VyY2VfKCk7XG5cdFx0dGhpcy5wYXJhbWV0ZXJzLnBvc2l0aW9uID0gcG9zaXRpb247XG5cblx0XHR3aGlsZSAoIHRoaXMuYmlydGhJbmRleF8gKyBudW1QYXJ0aWNsZXMgPj0gdGhpcy5tYXhQYXJ0aWNsZXNfICkge1xuXG5cdFx0XHR2YXIgbnVtUGFydGljbGVzVG9FbmQgPSB0aGlzLm1heFBhcnRpY2xlc18gLSB0aGlzLmJpcnRoSW5kZXhfO1xuXG5cdFx0XHR0aGlzLmNyZWF0ZVBhcnRpY2xlc18oIHRoaXMuYmlydGhJbmRleF8sIG51bVBhcnRpY2xlc1RvRW5kLFx0dGhpcy5wYXJhbWV0ZXJzLCB0aGlzLnBlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKTtcblx0XHRcdG51bVBhcnRpY2xlcyAtPSBudW1QYXJ0aWNsZXNUb0VuZDtcblxuXHRcdFx0dGhpcy5iaXJ0aEluZGV4XyA9IDA7XG5cblx0XHR9XG5cblx0XHR0aGlzLmNyZWF0ZVBhcnRpY2xlc18oIHRoaXMuYmlydGhJbmRleF8sIG51bVBhcnRpY2xlcywgdGhpcy5wYXJhbWV0ZXJzLCB0aGlzLnBlclBhcnRpY2xlUGFyYW1TZXR0ZXIgKTtcblxuXHRcdGlmICggdGhpcy5iaXJ0aEluZGV4XyA9PT0gMCApIHtcblxuXHRcdFx0dGhpcy5wYXJ0aWNsZVN5c3RlbS5zY2VuZS5hZGQoIHRoaXMgKTtcblxuXHRcdH1cblxuXHRcdHRoaXMuYmlydGhJbmRleF8gKz0gbnVtUGFydGljbGVzO1xuXG5cblx0fVxuXG59XG5cbmV4cG9ydCB7IFRyYWlsIH0iLCIvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi90ZGwvYmxvYi9tYXN0ZXIvdGRsL3BhcnRpY2xlcy5qc1xuLy8gcG9ydGVkIHRvIHRocmVlLmpzIGJ5IGZhemVhY3Rpb25cbmltcG9ydHtcblx0RGF0YVRleHR1cmUsXG5cdFJHQkFGb3JtYXQsXG5cdExpbmVhckZpbHRlclxufSBmcm9tICd0aHJlZSdcbmltcG9ydCB7IGNyZWF0ZURlZmF1bHRDbG9ja18gfSBmcm9tICcuL2NvbnN0YW50cy5qcydcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4vZW1pdHRlcidcbmltcG9ydCB7IFRyYWlsIH0gZnJvbSAnLi90cmFpbCdcblxuY2xhc3MgUGFydGljbGVTeXN0ZW0gIHtcblx0Y29uc3RydWN0b3IoIHNjZW5lLCBjYW1lcmEsIG9wdF9jbG9jaywgb3B0X3JhbmRvbUZ1bmN0aW9uICkge1xuXHRcdHRoaXMuc2NlbmUgPSBzY2VuZTtcblx0XHR0aGlzLmNhbWVyYSA9IGNhbWVyYTtcblxuXHRcdHRoaXMuZHJhd2FibGVzXyA9IFtdO1xuXG5cdFx0dmFyIHBpeGVsQmFzZSA9IFswLCAwLjIwLCAwLjcwLCAxLCAwLjcwLCAwLjIwLCAwLCAwXTtcblx0XHR2YXIgcGl4ZWxzID0gW107XG5cblx0XHRmb3IgKHZhciB5eSA9IDA7IHl5IDwgODsgKyt5eSkge1xuXG5cdFx0XHRmb3IgKHZhciB4eCA9IDA7IHh4IDwgODsgKyt4eCkge1xuXG5cdFx0XHRcdHZhciBwaXhlbCA9IHBpeGVsQmFzZVt4eF0gKiBwaXhlbEJhc2VbeXldO1xuXHRcdFx0XHRwaXhlbHMucHVzaChwaXhlbCwgcGl4ZWwsIHBpeGVsLCBwaXhlbCk7XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHZhciBjb2xvclRleHR1cmUgPSB0aGlzLmNyZWF0ZVRleHR1cmVGcm9tRmxvYXRzKDgsIDgsIHBpeGVscyk7XG5cdFx0dmFyIHJhbXBUZXh0dXJlID0gdGhpcy5jcmVhdGVUZXh0dXJlRnJvbUZsb2F0cygyLCAxLCBbMSwgMSwgMSwgMSwgMSwgMSwgMSwgMF0pO1xuXG5cdFx0dGhpcy5ub3dfID0gbmV3IERhdGUoKTtcblx0XHR0aGlzLnRpbWVCYXNlXyA9IG5ldyBEYXRlKCk7XG5cblx0XHRpZiAob3B0X2Nsb2NrKSB7XG5cblx0XHRcdHRoaXMudGltZVNvdXJjZV8gPSBvcHRfY2xvY2s7XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHR0aGlzLnRpbWVTb3VyY2VfID0gY3JlYXRlRGVmYXVsdENsb2NrXyh0aGlzKTtcblxuXHRcdH1cblxuXHRcdHRoaXMucmFuZG9tRnVuY3Rpb25fID0gb3B0X3JhbmRvbUZ1bmN0aW9uIHx8IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0cmV0dXJuIE1hdGgucmFuZG9tKCk7XG5cblx0XHR9O1xuXG5cdFx0dGhpcy5kZWZhdWx0Q29sb3JUZXh0dXJlID0gY29sb3JUZXh0dXJlO1xuXHRcdHRoaXMuZGVmYXVsdFJhbXBUZXh0dXJlID0gcmFtcFRleHR1cmU7XG5cdH1cblxuXHRjcmVhdGVUZXh0dXJlRnJvbUZsb2F0cyAoIHdpZHRoLCBoZWlnaHQsIHBpeGVscywgb3B0X3RleHR1cmUgKSB7XG5cblx0XHR2YXIgdGV4dHVyZSA9IG51bGw7XG5cdFx0aWYgKCBvcHRfdGV4dHVyZSAhPSBudWxsICkge1xuXG5cdFx0XHR0ZXh0dXJlID0gb3B0X3RleHR1cmU7XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHR2YXIgZGF0YSA9IG5ldyBVaW50OEFycmF5KCBwaXhlbHMubGVuZ3RoICk7XG5cdFx0XHR2YXIgdDtcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHBpeGVscy5sZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0dCA9IHBpeGVsc1sgaSBdICogMjU1Ljtcblx0XHRcdFx0ZGF0YVsgaSBdID0gdDtcblxuXHRcdFx0fVxuXG5cdFx0XHR0ZXh0dXJlID0gbmV3IERhdGFUZXh0dXJlKCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBSR0JBRm9ybWF0ICk7XG5cdFx0XHR0ZXh0dXJlLm1pbkZpbHRlciA9IExpbmVhckZpbHRlcjtcblx0XHRcdHRleHR1cmUubWFnRmlsdGVyID0gTGluZWFyRmlsdGVyO1xuXHRcdFx0dGV4dHVyZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHRcdHJldHVybiB0ZXh0dXJlO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRleHR1cmU7XG5cblx0fVxuXG5cdGNyZWF0ZVBhcnRpY2xlRW1pdHRlciAoIG9wdF90ZXh0dXJlLCBvcHRfY2xvY2sgKSB7XG5cdFx0dmFyIGVtaXR0ZXIgPSBuZXcgUGFydGljbGVFbWl0dGVyKCB0aGlzLCBvcHRfdGV4dHVyZSwgb3B0X2Nsb2NrICk7XG5cdFx0dGhpcy5kcmF3YWJsZXNfLnB1c2goIGVtaXR0ZXIgKTtcblxuXHRcdHJldHVybiBlbWl0dGVyO1xuXG5cdH1cblxuXHRjcmVhdGVUcmFpbCAoIG1heFBhcnRpY2xlcywgcGFyYW1ldGVycywgb3B0X3RleHR1cmUsIG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyLCBvcHRfY2xvY2sgKSB7XG5cblx0XHR2YXIgdHJhaWwgPSBuZXcgVHJhaWwoIHRoaXMsIG1heFBhcnRpY2xlcywgcGFyYW1ldGVycywgb3B0X3RleHR1cmUsIG9wdF9wZXJQYXJ0aWNsZVBhcmFtU2V0dGVyLFx0b3B0X2Nsb2NrICk7XG5cdFx0dGhpcy5kcmF3YWJsZXNfLnB1c2goIHRyYWlsICk7XG5cblx0XHRyZXR1cm4gdHJhaWw7XG5cblx0fVxuXG5cdGRyYXcgKCB2aWV3UHJvamVjdGlvbiwgd29ybGQsIHZpZXdJbnZlcnNlICkge1xuXG5cdFx0dGhpcy5ub3dfID0gbmV3IERhdGUoKTtcblxuXHRcdGZvciAoIHZhciBpaSA9IDA7IGlpIDwgdGhpcy5kcmF3YWJsZXNfLmxlbmd0aDsgKysgaWkgKSB7XG5cblx0XHRcdHRoaXMuZHJhd2FibGVzX1sgaWkgXS5kcmF3KCB3b3JsZCwgdmlld1Byb2plY3Rpb24sIDAgKTtcblxuXHRcdH1cblxuXHR9XG5cbn1cblxuZXhwb3J0IHsgUGFydGljbGVTeXN0ZW0gfVxuIl0sIm5hbWVzIjpbIkNPUk5FUlNfIiwiY3JlYXRlRGVmYXVsdENsb2NrXyIsInBhcnRpY2xlU3lzdGVtIiwiUE9TSVRJT05fU1RBUlRfVElNRV9JRFgiLCJVVl9MSUZFX1RJTUVfRlJBTUVfU1RBUlRfSURYIiwiVkVMT0NJVFlfU1RBUlRfU0laRV9JRFgiLCJBQ0NFTEVSQVRJT05fRU5EX1NJWkVfSURYIiwiU1BJTl9TVEFSVF9TUElOX1NQRUVEX0lEWCIsIk9SSUVOVEFUSU9OX0lEWCIsIkNPTE9SX01VTFRfSURYIiwiTEFTVF9JRFgiLCJzaW5nbGVQYXJ0aWNsZUFycmF5XyIsIkZsb2F0MzJBcnJheSIsIlBhcnRpY2xlU3BlYyIsIk9uZVNob3QiLCJNZXNoIiwiY29uc3RydWN0b3IiLCJpZHgiLCJ0cmlnZ2VyIiwiYWRkIiwiZHJhdyIsIlBhcnRpY2xlRW1pdHRlciIsIm9wdF9jbG9jayIsInNldFRyYW5zbGF0aW9uIiwieCIsInkiLCJ6Iiwic2V0U3RhdGUiLCJzZXRDb2xvclJhbXAiLCJ2YWxpZGF0ZVBhcmFtZXRlcnMiLCJrZXkiLCJwYXJhbWV0ZXJzIiwiY3JlYXRlUGFydGljbGVzXyIsInYiLCJwdXNoIiwiaWkiLCJvcHRfcGVyUGFydGljbGVQYXJhbVNldHRlciIsImludGVybGVhdmVCdWZmZXJEYXRhIiwiQ29uc3RhbnRzLkNPUk5FUlNfIiwiamoiLCJhbGxvY2F0ZVBhcnRpY2xlc18iLCJ1dnMiLCJDb25zdGFudHMuc2luZ2xlUGFydGljbGVBcnJheV8iLCJDb25zdGFudHMuTEFTVF9JRFgiLCJDb25zdGFudHMuUE9TSVRJT05fU1RBUlRfVElNRV9JRFgiLCJDb25zdGFudHMuVVZfTElGRV9USU1FX0ZSQU1FX1NUQVJUX0lEWCIsIkNvbnN0YW50cy5WRUxPQ0lUWV9TVEFSVF9TSVpFX0lEWCIsIkNvbnN0YW50cy5BQ0NFTEVSQVRJT05fRU5EX1NJWkVfSURYIiwiQ29uc3RhbnRzLlNQSU5fU1RBUlRfU1BJTl9TUEVFRF9JRFgiLCJDb25zdGFudHMuT1JJRU5UQVRJT05fSURYIiwiQ29uc3RhbnRzLkNPTE9SX01VTFRfSURYIiwidmlld0ludmVyc2UiLCJ0eXBlIiwidmFsdWUiLCJ3b3JsZFZlbG9jaXR5Iiwid29ybGRBY2NlbGVyYXRpb24iLCJ0aW1lUmFuZ2UiLCJ0aW1lIiwidGltZU9mZnNldCIsImZyYW1lRHVyYXRpb24iLCJudW1GcmFtZXMiLCJyYW1wU2FtcGxlciIsImNvbG9yU2FtcGxlciIsInVuaWZvcm1zIiwidmVydGV4U2hhZGVyIiwiZnJhZ21lbnRTaGFkZXIiLCJzaWRlIiwiYmxlbmRpbmciLCJkZXB0aFRlc3QiLCJkZXB0aFdyaXRlIiwidHJhbnNwYXJlbnQiLCJzZXRQYXJhbWV0ZXJzIiwiY3JlYXRlT25lU2hvdCIsImNsb25lIiwib2JqZWN0IiwiVHJhaWwiLCJiaXJ0aFBhcnRpY2xlcyIsIm51bVBhcnRpY2xlcyIsIlBhcnRpY2xlU3lzdGVtIiwieXkiLCJwaXhlbHMiLCJjcmVhdGVUZXh0dXJlRnJvbUZsb2F0cyIsInRleHR1cmUiLCJpIiwidCIsImRhdGEiLCJMaW5lYXJGaWx0ZXIiLCJjcmVhdGVQYXJ0aWNsZUVtaXR0ZXIiLCJjcmVhdGVUcmFpbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NB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
