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

export {ParticleSpec}