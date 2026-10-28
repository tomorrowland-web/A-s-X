import RAPIER from '@dimforge/rapier3d-compat';

export interface CollisionWall { x: number; z: number; w: number; d: number }
export interface GroundPosition { x: number; z: number }

let initialization: Promise<void> | undefined;

/** Grounded kinematic capsule. Movement arguments are metres per second. */
export class PhysicsController {
  private world: RAPIER.World | null = null;
  private character: RAPIER.KinematicCharacterController | null = null;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;

  static async create(): Promise<PhysicsController> {
    initialization ??= RAPIER.init();
    await initialization;
    const controller = new PhysicsController();
    controller.reset([], { x: 0, z: 0 });
    return controller;
  }

  reset(walls: CollisionWall[], spawn: GroundPosition): void {
    this.clear();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.25, 100).setTranslation(0, -0.25, 0));
    for (const wall of walls) {
      if (![wall.x, wall.z, wall.w, wall.d].every(Number.isFinite) || wall.w <= 0 || wall.d <= 0) continue;
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(wall.w / 2, 2.5, wall.d / 2).setTranslation(wall.x, 2.5, wall.z));
    }
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, 0.83, spawn.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), this.body);
    this.character = this.world.createCharacterController(0.02);
    this.character.setSlideEnabled(true);
    this.character.enableSnapToGround(0.12);
    this.character.setApplyImpulsesToDynamicBodies(false);
    this.world.step();
  }

  get position(): GroundPosition {
    const p = this.body?.translation();
    return p ? { x: p.x, z: p.z } : { x: 0, z: 0 };
  }

  /** Substeps prevent large frame deltas from crossing a wall or thin obstacle. */
  move(dx: number, dz: number, dt: number): GroundPosition {
    if (!this.world || !this.character || !this.body || !this.collider || !Number.isFinite(dt) || dt <= 0) return this.position;
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return this.position;
    const duration = Math.min(dt, 0.1);
    const count = Math.max(1, Math.ceil(duration * 60));
    const step = duration / count;
    for (let i = 0; i < count; i++) {
      this.world.timestep = step;
      this.character.computeColliderMovement(this.collider, { x: dx * step, y: -0.01, z: dz * step });
      const movement = this.character.computedMovement();
      const p = this.body.translation();
      this.body.setNextKinematicTranslation({ x: p.x + movement.x, y: p.y + movement.y, z: p.z + movement.z });
      this.world.step();
    }
    return this.position;
  }

  teleport(x: number, z: number): void {
    if (!this.body || !this.world || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const next = { x, y: 0.83, z };
    this.body.setTranslation(next, true);
    this.body.setNextKinematicTranslation(next);
    this.world.step();
  }

  clear(): void {
    this.world?.free();
    this.world = null;
    this.character = null;
    this.body = null;
    this.collider = null;
  }

  dispose(): void { this.clear(); }
}
