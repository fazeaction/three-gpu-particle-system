// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction
import {
	Mesh,
	Matrix4,
	Vector3
} from 'three'

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

export {OneShot}
