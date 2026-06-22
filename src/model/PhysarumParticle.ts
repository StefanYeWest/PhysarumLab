/**
 * PhysarumParticle — класс частицы-агента (раздел 6.2.3, 11 ТЗ).
 *
 * Частица принимает решения только по локальным сигналам: проверяет
 * сенсоры впереди / слева / справа, доворачивает к сильнейшему сигналу,
 * двигается и оставляет след. При столкновении со стеной меняет
 * направление, при длительном застревании перерождается в старте.
 */
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

  /**
   * Сенсорная стадия: чтение трёх сенсоров и поворот к сильнейшему
   * сигналу (раздел 11.1).
   */
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

    // Правило поворота по модели Jones (2010):
    // - впереди сильнее всего → сохранить направление;
    // - впереди слабее обоих боковых → случайный поворот (исследование,
    //   разрушает паразитные петли);
    // - иначе доворачиваем к более сильному боковому сенсору.
    if (front > left && front > right) {
      // сохраняем направление
    } else if (front < left && front < right) {
      this.angleRadians += rng.next() < 0.5 ? -turnAngle : turnAngle;
    } else if (left > right) {
      this.angleRadians -= turnAngle;
    } else if (right > left) {
      this.angleRadians += turnAngle;
    }
  }

  /** Читает суммарный сигнал в сенсорной точке. */
  private readSensor(world: WorldGrid, angle: number, dist: number): number {
    const sx = this.x + Math.cos(angle) * dist;
    const sy = this.y + Math.sin(angle) * dist;
    return world.getSignalAt(sx, sy);
  }

  /**
   * Двигательная стадия (раздел 11.2). Возвращает true, если частица
   * успешно переместилась.
   */
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

    // Столкновение: остаёмся на месте, меняем направление случайно.
    this.angleRadians = rng.angle();
    this.stuckTicks++;

    if (this.stuckTicks > config.stuckParticleRespawnTicks) {
      this.respawn(world.startArea, rng);
    }
    return false;
  }

  /** Оставляет след в текущей клетке (раздел 11.3). */
  depositTrail(world: WorldGrid, amount: number): void {
    world.depositTrail(this.x, this.y, amount);
  }

  /** Переносит частицу в случайную точку стартовой области (раздел 11.2). */
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
