/**
 * Детерминированный генератор псевдослучайных чисел.
 *
 * Используется алгоритм Mulberry32: быстрый, компактный и воспроизводимый
 * при одинаковом seed (требование воспроизводимости через seed, раздел 6.2.1).
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Приводим seed к 32-битному беззнаковому целому.
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  /** Возвращает число в диапазоне [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Случайное число в диапазоне [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Случайный угол в радианах [0, 2π). */
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  /** Сброс состояния генератора на новый seed. */
  reset(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }
}
