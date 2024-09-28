import { Direction, MKH40Controller, Motor } from "./controller";
import { initializeMKHController } from "./start";
import { delay } from "./util";

export async function start(controller: MKH40Controller) {
  await delay(1000);
  await controller.resetMotorPosition(Motor.A, Motor.B, Motor.C, Motor.D);
  await delay(1000);
  await controller.driveMotorToPosition([
    { motor: Motor.A, target: { position: -150 * 10000, speed: 0x7fff / 4 } },
    { motor: Motor.C, target: { position: 150 * 10000, speed: 0x7fff / 8 } },
  ]);
}

initializeMKHController(start);
