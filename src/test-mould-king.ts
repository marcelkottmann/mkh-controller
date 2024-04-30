import { MKH40Controller, Motor } from "./controller";

export async function start(controller: MKH40Controller) {
  await controller.setLimits(Motor.A, 30, 100);
  await controller.resetMotorPosition(Motor.A);
  console.log(await controller.getCurrentPosition(Motor.A));
  await controller.driveMotorToPosition({
    speed: 0x7fff,
    position: 200,
  });

  console.log(await controller.getCurrentPosition(Motor.A));
  // console.log(await controller.getCurrentPosition(tm));
  // await controller.resetMotorPosition(Motor.A, Motor.B, Motor.C, Motor.D);
  // console.log(await controller.getCurrentPosition(tm));

  // const isResolved = createIsResolved(
  //   controller.driveMotorToPosition({
  //     speed: 0x7fff / 16,
  //     position: 20,
  //   })
  // );

  // while (!isResolved()) {
  //   console.log(await controller.getCurrentPosition(Motor.A));
  //   // await delay(500);
  // }

  // await delay(1000);
  // await controller.driveMotorToPosition({ speed: 0x7fff / 16, position: 0 });
  console.log("done");
  // console.log(await controller.getCurrentPosition(Motor.D));
  // await controller.driveMotorToPosition({ speed: 0x7fff / 8, position: -10 });

  // await controller.driveMotorToPosition(
  //   { speed: 0x7fff / 4, position: 40 },
  //   { speed: 0x7fff / 8, position: 20 }
  // );
  // await controller.driveMotorToPosition(
  //   { speed: 0x7fff / 4, position: 0 },
  //   { speed: 0x7fff / 8, position: 0 }
  // );
}
