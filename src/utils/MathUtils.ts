import * as THREE from 'three';

export class MathUtils {
  public static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public static getForwardVector(quaternion: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  }

  public static getRightVector(quaternion: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  }

  public static getUpVector(quaternion: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  }
}
