// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

export var CORNERS_ = [

	[ - 0.5, - 0.5 ],
	[ + 0.5, - 0.5 ],
	[ + 0.5, + 0.5 ],
	[ - 0.5, + 0.5 ]

];

export function createDefaultClock_ ( particleSystem ) {

	return function () {

		var now = particleSystem.now_;
		var base = particleSystem.timeBase_;

		return ( now.getTime() - base.getTime() ) / 1000.0;

	}

}

export var POSITION_START_TIME_IDX = 0;
export var UV_LIFE_TIME_FRAME_START_IDX = 4;
export var VELOCITY_START_SIZE_IDX = 8;
export var ACCELERATION_END_SIZE_IDX = 12;
export var SPIN_START_SPIN_SPEED_IDX = 16;
export var ORIENTATION_IDX = 20;
export var COLOR_MULT_IDX = 24;
export var LAST_IDX = 28;
export var singleParticleArray_ = new Float32Array( 4 * LAST_IDX );