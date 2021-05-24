// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction
import{
	DataTexture,
	RGBAFormat,
	LinearFilter
} from 'three'
import { createDefaultClock_ } from './constants.js'
import { ParticleEmitter } from './emitter'
import { Trail } from './trail'

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

export { ParticleSystem }
