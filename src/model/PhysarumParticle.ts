import type { SimulationConfig } from '../types/simulation';
import type { StartArea } from '../types/grid';
import type { WorldGrid } from './WorldGrid';
import type { SeededRandom } from '../algorithms/random';

const DEG_TO_RAD = Math.PI / 180;

export class PhysarumParticle {
  id: number;
  x: number;
  y: number;
  angleRadians: number;
  speed: number;
  ageTicks = 0;
  stuckTicks = 0;

  constructor(
    id: number,
    x: number,
    y: number,
    angleRadians: number,
    speed: number,
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.angleRadians = angleRadians;
    this.speed = speed;
  }

  senseAndTurn(
    world: WorldGrid,
    config: SimulationConfig,
    rng: SeededRandom,
  ): void {
    const sensorAngle = config.sensorAngleDegrees * DEG_TO_RAD;
    const turnAngle = config.turnAngleDegrees * DEG_TO_RAD;
    const dist = config.sensorDistance;

    const front = this.readSensor(world, this.angleRadians, dist);
    const left = this.readSensor(world, this.angleRadians - sensorAngle, dist);
    const right = this.readSensor(world, this.angleRadians + sensorAngle, dist);

    if (front > left && front > right) {
      return;
    }
    if (front < left && front < right) {
      this.angleRadians += rng.next() < 0.5 ? -turnAngle : turnAngle;
    } else if (left > right) {
      this.angleRadians -= turnAngle;
    } else if (right > left) {
      this.angleRadians += turnAngle;
    }
  }

  private readSensor(world: WorldGrid, angle: number, dist: number): number {
    const sx = this.x + Math.cos(angle) * dist;
    const sy = this.y + Math.sin(angle) * dist;
    return world.getSignalAt(sx, sy);
  }

  move(
    world: WorldGrid,
    config: SimulationConfig,
    rng: SeededRandom,
  ): boolean {
    this.ageTicks++;
    const newX = this.x + Math.cos(this.angleRadians) * this.speed;
    const newY = this.y + Math.sin(this.angleRadians) * this.speed;

    if (world.isWalkable(newX, newY)) {
      this.x = newX;
      this.y = newY;
      this.stuckTicks = 0;
      return true;
    }

    this.angleRadians = rng.angle();
    this.stuckTicks++;

    if (this.stuckTicks > config.stuckParticleRespawnTicks) {
      this.respawn(world.startArea, rng);
    }
    return false;
  }

  depositTrail(world: WorldGrid, amount: number): void {
    world.depositTrail(this.x, this.y, amount);
  }

  respawn(startArea: StartArea, rng: SeededRandom): void {
    const r = rng.next() * startArea.radius;
    const a = rng.angle();
    this.x = startArea.x + Math.cos(a) * r;
    this.y = startArea.y + Math.sin(a) * r;
    this.angleRadians = rng.angle();
    this.stuckTicks = 0;
    this.ageTicks = 0;
  }
}
