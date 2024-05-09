import { MKH40Controller, Motor } from "./controller";
import { initializeMKHController } from "./start";

export async function start(controller: MKH40Controller) {
  await controller.driveMotorToPosition(
    {
      speed: 0x7fff / 3,
      position: 0,
    },
    {
      speed: 0,
      position: 0,
    }
  );
  console.log("nullpositin");

  await controller.driveMotorToPosition(
    {
      speed: 0x7fff / 3,
      position: -314,
    },
    {
      speed: 0,
      position: 0,
    }
  );
  console.log("done");
}

initializeMKHController(start);
