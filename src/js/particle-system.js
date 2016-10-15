import {createDefaultClock_} from './constants.js'
import {ParticleEmitter} from './emitter'
import {Trail} from './trail'

function ParticleSystem (opt_clock, opt_randomFunction) {


        // Entities which can be drawn -- emitters or OneShots
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
        var rampTexture = this.createTextureFromFloats(2, 1, [1, 1, 1, 1,
            1, 1, 1, 0]);

        this.now_ = new Date();
        this.timeBase_ = new Date();
        if (opt_clock) {
            this.timeSource_ = opt_clock;
        } else {
            this.timeSource_ = createDefaultClock_(this);
        }

        this.randomFunction_ = opt_randomFunction || function() {
                return Math.random();
            };

        this.defaultColorTexture = colorTexture;
        this.defaultRampTexture = rampTexture;
    }

ParticleSystem.prototype.createTextureFromFloats = function (width, height, pixels, opt_texture) {
        var texture = null;
        if (opt_texture != null) {
            texture = opt_texture;
        } else {
            var data = new Uint8Array(pixels.length);
            for (var i = 0; i < pixels.length; i++) {
                var t = pixels[i] * 255.;
                data[i] = t;
            }

            var texture = new THREE.DataTexture( data, width, height, THREE.RGBAFormat );
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;

            return texture;

        }

        return texture;
    }

ParticleSystem.prototype.createParticleEmitter = function (opt_texture, opt_clock) {
        var emitter = new ParticleEmitter(this, opt_texture, opt_clock);
        this.drawables_.push(emitter);
        return emitter;
    }

ParticleSystem.prototype.createTrail = function (maxParticles,parameters,opt_texture,opt_perParticleParamSetter,opt_clock) {

        var trail = new Trail(
            this,
            maxParticles,
            parameters,
            opt_texture,
            opt_perParticleParamSetter,
            opt_clock);
        this.drawables_.push(trail);
        return trail;
    }

ParticleSystem.prototype.draw = function (viewProjection, world, viewInverse) {
        // Update notion of current time
        this.now_ = new Date();

        for (var ii = 0; ii < this.drawables_.length; ++ii) {
            this.drawables_[ii].draw(world, viewProjection, 0);
        }
    }

export {ParticleSystem}