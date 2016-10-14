import THREE from 'three'

class OneShot extends THREE.Mesh  {

    constructor( emitter ) {

        super();

        this.emitter_ = emitter.clone();

        this.world_ = new THREE.Matrix4();
        this.tempWorld_ = new THREE.Matrix4();
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

    trigger (opt_world) {
        //if(!this.visible_) scene.add(this.emitter_.mesh);
        if(!this.visible_) {

            scene.add(this.emitter_);

        }
        if (opt_world) {
            this.world_.setPosition(new THREE.Vector3().fromArray(opt_world));
        }
        this.visible_ = true;
        this.timeOffset_ = this.emitter_.timeSource_();
    }

    draw (world, viewProjection, timeOffset) {
        if (this.visible_) {
            //this.tempWorld_.multiplyMatrices(this.world_, world);
            this.emitter_.draw(this.world_, viewProjection, this.timeOffset_);
        }
    }

}

export default OneShot