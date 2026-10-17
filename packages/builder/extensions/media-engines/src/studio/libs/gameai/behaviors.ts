/*
  Two steering behaviours `s.lib.gameai` supplies itself (game libraries, 2026-10-12).

  - SeededWanderBehavior: yuka's wander (Reynolds' wander circle projected ahead of the vehicle,
    jitter scaled by the time slice) with the scene's seeded random instead of Math.random, so a
    seed replays the same wandering.
  - SpacingBehavior: separation in pixels. yuka's SeparationBehavior pushes with 1/distance,
    which suits its metre-scale examples but is a whisper at Pixi scale; this one asks for up to
    the vehicle's top speed away from each neighbour inside its neighbourhood radius, fading to
    nothing at the edge.
*/

import { SteeringBehavior, Vector3, type Vehicle } from 'yuka';

const displacement = new Vector3();
const targetWorld = new Vector3();
const away = new Vector3();

export class SeededWanderBehavior extends SteeringBehavior {
  private readonly targetLocal = new Vector3();

  constructor(
    private readonly random: () => number,
    public radius = 1,
    public distance = 5,
    public jitter = 5,
  ) {
    super();
    const angle = random() * Math.PI * 2;
    this.targetLocal.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }

  override calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3 {
    const slice = this.jitter * delta;
    displacement.set((this.random() * 2 - 1) * slice, 0, (this.random() * 2 - 1) * slice);
    this.targetLocal.add(displacement).normalize().multiplyScalar(this.radius);
    targetWorld.copy(this.targetLocal);
    targetWorld.z += this.distance;
    targetWorld.applyMatrix4(vehicle.worldMatrix);
    return force.subVectors(targetWorld, vehicle.position);
  }
}

export class SpacingBehavior extends SteeringBehavior {
  override calculate(vehicle: Vehicle, force: Vector3): Vector3 {
    const reach = vehicle.neighborhoodRadius;
    for (const neighbor of vehicle.neighbors) {
      away.subVectors(vehicle.position, neighbor.position);
      const distance = away.length();
      if (distance >= reach) continue;
      if (distance === 0) away.set(1, 0, 0);
      away.normalize().multiplyScalar((vehicle.maxSpeed * (reach - distance)) / reach);
      force.add(away);
    }
    return force;
  }
}
