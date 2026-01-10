
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

class SoundService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private _muted: boolean = false;

  constructor() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  }

  public get muted() { return this._muted; }

  public toggleMute() {
    this._muted = !this._muted;
    return this._muted;
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public play(type: 'place' | 'break' | 'ui' | 'paint' | 'undo' | 'redo' | 'error' | 'success' | 'hover') {
    if (!this.enabled || this._muted || !this.ctx) return;

    // Attempt to resume if suspended (requires user interaction in stack)
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    switch (type) {
      case 'place': // High pop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.08);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.08);
        break;

      case 'break': // Low crunch
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'paint': // Fluid sweep
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;

      case 'ui': // Gentle tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
        osc.start(t);
        osc.stop(t + 0.03);
        break;
      
      case 'hover': // Subtle tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
        osc.start(t);
        osc.stop(t + 0.01);
        break;

      case 'undo': // Descending
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(200, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'redo': // Ascending
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(400, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
        
      case 'success': // Major chord arpeggio
        this.playTone(523.25, t, 0.1); // C5
        this.playTone(659.25, t + 0.1, 0.1); // E5
        this.playTone(783.99, t + 0.2, 0.2); // G5
        break;
        
      case 'error': // Low buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
    }
  }

  private playTone(freq: number, time: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.start(time);
    osc.stop(time + duration);
  }
}

export const Sound = new SoundService();
