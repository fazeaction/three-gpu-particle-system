// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

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

        this.emitter_.position.copy( new THREE.Vector3().fromArray( opt_world ) );

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

export {OneShot}
