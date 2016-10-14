import ParticleEmitter from './emitter.js'

class Trail extends ParticleEmitter  {

    constructor(
        particleSystem,
        maxParticles,
        parameters,
        opt_texture,
        opt_perParticleParamSetter,
        opt_clock) {

        super(particleSystem, opt_texture, opt_clock);

        this.allocateParticles_(maxParticles,parameters);
        this.validateParameters(parameters);

        this.parameters = parameters;
        this.perParticleParamSetter = opt_perParticleParamSetter;
        this.birthIndex_ = 0;
        this.maxParticles_ = maxParticles;

    }

    birthParticles (position) {

        var numParticles = this.parameters.numParticles;
        this.parameters.startTime = this.timeSource_();
        this.parameters.position = position;
        while (this.birthIndex_ + numParticles >= this.maxParticles_) {
            var numParticlesToEnd = this.maxParticles_ - this.birthIndex_;

            this.createParticles_(this.birthIndex_,
                numParticlesToEnd,
                this.parameters,
                this.perParticleParamSetter);
            numParticles -= numParticlesToEnd;

            this.birthIndex_ = 0;
        }
        this.createParticles_(this.birthIndex_,
            numParticles,
            this.parameters,
            this.perParticleParamSetter);
        if(this.birthIndex_===0) {
            scene.add(this);
        }
        this.birthIndex_ += numParticles;


    }

}

export default Trail